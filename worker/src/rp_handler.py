"""
DroneShot - RunPod Serverless Handler
Accepts a property photo, generates a drone flyby video via ComfyUI.
"""

import runpod
import json
import urllib.request
import urllib.parse
import time
import base64
import os
import random
import subprocess
import sys

COMFY_URL = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
WORKFLOW_PATH = os.getenv("WORKFLOW_PATH", "/app/workflow.json")
COMFY_OUTPUT_DIR = os.getenv("COMFY_OUTPUT_DIR", "/app/ComfyUI/output")
MAX_WAIT_SECS = int(os.getenv("MAX_WAIT_SECS", "600"))


def wait_for_comfyui(timeout=120):
    """Wait for ComfyUI to become available."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f"{COMFY_URL}/system_stats")
            urllib.request.urlopen(req, timeout=5)
            return True
        except Exception:
            time.sleep(2)
    return False


def upload_image(image_bytes: bytes, filename: str) -> dict:
    """Upload an image to ComfyUI's input directory."""
    boundary = "----WebKitFormBoundary" + str(random.randint(10**15, 10**16))
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode() + image_bytes + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{COMFY_URL}/upload/image",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())


def queue_prompt(workflow: dict) -> str:
    """Submit workflow to ComfyUI and return prompt_id."""
    payload = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(
        f"{COMFY_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    return result["prompt_id"]


def poll_completion(prompt_id: str, timeout: int = MAX_WAIT_SECS) -> dict:
    """Poll ComfyUI /history until the prompt completes or times out."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            req = urllib.request.Request(f"{COMFY_URL}/history/{prompt_id}")
            resp = urllib.request.urlopen(req)
            history = json.loads(resp.read())
            if prompt_id in history:
                status = history[prompt_id].get("status", {})
                if status.get("completed", False) or status.get("status_str") == "success":
                    return history[prompt_id]
                if status.get("status_str") == "error":
                    raise RuntimeError(f"ComfyUI execution failed: {status}")
        except urllib.error.HTTPError:
            pass
        time.sleep(3)
    raise TimeoutError(f"ComfyUI did not complete within {timeout}s")


def get_output_video(history: dict) -> bytes:
    """Extract the output video from ComfyUI history and return as bytes."""
    outputs = history.get("outputs", {})

    # Find the VHS_VideoCombine output (node 80)
    for node_id, output in outputs.items():
        if "gifs" in output:
            for gif_info in output["gifs"]:
                filename = gif_info["filename"]
                subfolder = gif_info.get("subfolder", "")
                filetype = gif_info.get("type", "output")

                params = urllib.parse.urlencode({
                    "filename": filename,
                    "subfolder": subfolder,
                    "type": filetype,
                })
                req = urllib.request.Request(f"{COMFY_URL}/view?{params}")
                resp = urllib.request.urlopen(req)
                return resp.read()

    # Fallback: look for video files in output directory
    for root, dirs, files in os.walk(COMFY_OUTPUT_DIR):
        for f in sorted(files, key=lambda x: os.path.getmtime(os.path.join(root, x)), reverse=True):
            if f.endswith(".mp4") and "droneshot" in f:
                with open(os.path.join(root, f), "rb") as fh:
                    return fh.read()

    raise FileNotFoundError("No output video found in ComfyUI history")


def handler(event):
    """RunPod serverless handler."""
    job_input = event.get("input", {})

    # Accept either old format (image) or new format (start_image + optional end_image)
    start_b64 = job_input.get("start_image") or job_input.get("image")
    if not start_b64:
        return {"error": "Missing 'start_image' field (base64 encoded image)"}

    end_b64 = job_input.get("end_image")

    # Optional parameters
    horizontal_angle = job_input.get("horizontal_angle", 30)
    vertical_angle = job_input.get("vertical_angle", 10)
    zoom = job_input.get("zoom", 5)
    prompt = job_input.get("prompt", "smooth cinematic drone flyby of a real estate property, aerial photography, steady camera movement, professional real estate video, 4k quality")
    width = job_input.get("width", 832)
    height = job_input.get("height", 480)
    length = job_input.get("length", 81)

    # Wait for ComfyUI
    if not wait_for_comfyui():
        return {"error": "ComfyUI failed to start"}

    # Upload start image
    start_bytes = base64.b64decode(start_b64)
    start_result = upload_image(start_bytes, "droneshot_start.png")
    start_name = start_result.get("name", "droneshot_start.png")

    # Upload end image if provided
    end_name = None
    if end_b64:
        end_bytes = base64.b64decode(end_b64)
        end_result = upload_image(end_bytes, "droneshot_end.png")
        end_name = end_result.get("name", "droneshot_end.png")

    # Load and parameterize workflow
    with open(WORKFLOW_PATH) as f:
        workflow = json.load(f)

    # Set start image
    workflow["1"]["inputs"]["image"] = start_name

    if end_name:
        # Dual frame mode: add second LoadImage, skip Qwen
        workflow["2"] = {
            "inputs": {"image": end_name},
            "class_type": "LoadImage",
            "_meta": {"title": "Load End Frame"},
        }
        workflow["65"]["inputs"]["end_image"] = ["2", 0]
        for nid in ["10", "11", "12", "13", "14", "15", "16",
                     "20", "21", "22", "23", "24", "25", "26",
                     "27", "28", "29"]:
            workflow.pop(nid, None)
    else:
        # Single frame: set Qwen angle parameters
        workflow["10"]["inputs"]["horizontal_angle"] = horizontal_angle
        workflow["10"]["inputs"]["vertical_angle"] = vertical_angle
        workflow["10"]["inputs"]["zoom"] = zoom
        workflow["27"]["inputs"]["seed"] = random.randint(0, 2**53)

    # Set random seeds for video gen
    workflow["70"]["inputs"]["noise_seed"] = random.randint(0, 2**53)

    # Set video parameters
    workflow["55"]["inputs"]["text"] = prompt
    workflow["65"]["inputs"]["width"] = width
    workflow["65"]["inputs"]["height"] = height
    workflow["65"]["inputs"]["length"] = length

    # Submit and wait
    prompt_id = queue_prompt(workflow)

    try:
        history = poll_completion(prompt_id)
    except (TimeoutError, RuntimeError) as e:
        return {"error": str(e)}

    # Get output video
    try:
        video_bytes = get_output_video(history)
        video_b64 = base64.b64encode(video_bytes).decode()
        return {
            "video": video_b64,
            "format": "mp4",
            "prompt_id": prompt_id,
        }
    except FileNotFoundError as e:
        return {"error": str(e)}


# Start ComfyUI as background process
def start_comfyui():
    """Launch ComfyUI in the background."""
    comfy_cmd = [
        sys.executable, "-u", "/app/ComfyUI/main.py",
        "--listen", "0.0.0.0",
        "--port", "8188",
        "--reserve-vram", "4",
        "--disable-cuda-malloc",
    ]
    return subprocess.Popen(comfy_cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


if __name__ == "__main__":
    # Start ComfyUI
    comfy_proc = start_comfyui()
    print("Starting ComfyUI...")

    # Start RunPod serverless
    runpod.serverless.start({"handler": handler})
