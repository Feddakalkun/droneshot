"""
DroneShot API - FastAPI backend
Local mode: talks directly to ComfyUI on localhost.
RunPod mode: dispatches to RunPod Serverless (when RUNPOD_API_KEY is set).
"""

import os
import json
import base64
import uuid
import random
import asyncio
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional

import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

app = FastAPI(title="DroneShot API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Config
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "")
RUNPOD_ENDPOINT_ID = os.getenv("RUNPOD_ENDPOINT_ID", "")
RUNPOD_BASE = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}"
COMFY_URL = os.getenv("COMFY_URL", "http://127.0.0.1:8188")
WORKFLOW_DIR = Path(__file__).parent.parent / "worker" / "src"
MAX_IMAGE_SIZE = 10 * 1024 * 1024

USE_LOCAL = not RUNPOD_API_KEY

# In-memory job store for local mode
jobs: dict[str, dict] = {}


def runpod_headers():
    return {"Authorization": f"Bearer {RUNPOD_API_KEY}"}


# ── ComfyUI helpers (local mode) ──────────────────────────────────────────

def comfy_upload_image(image_bytes: bytes, filename: str) -> str:
    """Upload image to ComfyUI, return the stored filename."""
    boundary = "----DroneShot" + str(random.randint(10**15, 10**16))
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
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    return result.get("name", filename)


def comfy_queue_prompt(workflow: dict) -> str:
    """Submit workflow to ComfyUI, return prompt_id."""
    payload = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(
        f"{COMFY_URL}/prompt",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    resp = urllib.request.urlopen(req, timeout=30)
    result = json.loads(resp.read())
    return result["prompt_id"]


def comfy_check_history(prompt_id: str) -> Optional[dict]:
    """Check if a prompt has completed. Returns history entry or None."""
    try:
        req = urllib.request.Request(f"{COMFY_URL}/history/{prompt_id}")
        resp = urllib.request.urlopen(req, timeout=10)
        history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
    except Exception:
        pass
    return None


def comfy_get_video(history: dict) -> Optional[bytes]:
    """Extract video bytes from ComfyUI history outputs."""
    outputs = history.get("outputs", {})
    for node_id, output in outputs.items():
        if "gifs" in output:
            for gif_info in output["gifs"]:
                params = urllib.parse.urlencode({
                    "filename": gif_info["filename"],
                    "subfolder": gif_info.get("subfolder", ""),
                    "type": gif_info.get("type", "output"),
                })
                req = urllib.request.Request(f"{COMFY_URL}/view?{params}")
                resp = urllib.request.urlopen(req, timeout=60)
                return resp.read()
    return None


def build_workflow(start_image_name: str, end_image_name: Optional[str] = None) -> dict:
    """Build the ComfyUI workflow.

    If end_image_name is None: runs full pipeline (Qwen angle gen → video).
    If end_image_name is provided: skips Qwen, goes straight to video with both frames.
    """
    with open(WORKFLOW_DIR / "workflow.json") as f:
        workflow = json.load(f)

    # Set start image
    workflow["1"]["inputs"]["image"] = start_image_name

    # Random seeds
    workflow["27"]["inputs"]["seed"] = random.randint(0, 2**53)
    workflow["70"]["inputs"]["noise_seed"] = random.randint(0, 2**53)

    if end_image_name:
        # Dual frame mode: skip Qwen entirely, load end image directly
        # Add a second LoadImage node for the end frame
        workflow["2"] = {
            "inputs": {"image": end_image_name},
            "class_type": "LoadImage",
            "_meta": {"title": "Load End Frame"},
        }
        # Point WanFirstLastFrameToVideo end_image to the uploaded end frame
        workflow["65"]["inputs"]["end_image"] = ["2", 0]

        # Remove Qwen nodes (10-29) — they're not needed
        for node_id in ["10", "11", "12", "13", "14", "15", "16",
                        "20", "21", "22", "23", "24", "25", "26",
                        "27", "28", "29"]:
            workflow.pop(node_id, None)
    else:
        # Single frame mode: Qwen generates the panned image, use it as end_image
        # (workflow already wired: node 28 output → node 65 end_image)
        pass

    return workflow


async def run_local_job(job_id: str, start_bytes: bytes, end_bytes: Optional[bytes]):
    """Background task: upload images, queue workflow, poll for result."""
    try:
        jobs[job_id]["status"] = "IN_PROGRESS"

        # Upload start image
        start_name = comfy_upload_image(start_bytes, f"droneshot_start_{job_id[:8]}.png")

        # Upload end image if provided
        end_name = None
        if end_bytes:
            end_name = comfy_upload_image(end_bytes, f"droneshot_end_{job_id[:8]}.png")

        # Build and submit workflow
        workflow = build_workflow(start_name, end_name)
        prompt_id = comfy_queue_prompt(workflow)
        jobs[job_id]["prompt_id"] = prompt_id

        # Poll for completion (up to 10 minutes)
        for _ in range(200):
            await asyncio.sleep(3)
            history = comfy_check_history(prompt_id)
            if history:
                status_info = history.get("status", {})
                if status_info.get("status_str") == "error":
                    jobs[job_id]["status"] = "FAILED"
                    msgs = status_info.get("messages", [])
                    err_msg = str(msgs) if msgs else "ComfyUI execution error"
                    jobs[job_id]["error"] = err_msg
                    return

                if status_info.get("completed", False) or status_info.get("status_str") == "success":
                    video_bytes = comfy_get_video(history)
                    if video_bytes:
                        jobs[job_id]["status"] = "COMPLETED"
                        jobs[job_id]["video"] = base64.b64encode(video_bytes).decode()
                        return
                    else:
                        jobs[job_id]["status"] = "FAILED"
                        jobs[job_id]["error"] = "No video output found"
                        return

        jobs[job_id]["status"] = "FAILED"
        jobs[job_id]["error"] = "Timed out waiting for ComfyUI"

    except Exception as e:
        jobs[job_id]["status"] = "FAILED"
        jobs[job_id]["error"] = str(e)


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    mode = "local" if USE_LOCAL else "runpod"
    ok = True
    if USE_LOCAL:
        try:
            req = urllib.request.Request(f"{COMFY_URL}/system_stats")
            urllib.request.urlopen(req, timeout=5)
        except Exception:
            ok = False
    return {"status": "ok" if ok else "comfyui_offline", "mode": mode}


@app.post("/api/generate")
async def generate_droneshot(
    start_frame: UploadFile = File(...),
    end_frame: Optional[UploadFile] = File(None),
):
    """Accept property photo(s) and create a drone flyby video."""
    start_bytes = await start_frame.read()
    if len(start_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(400, "Image too large (max 10MB)")
    if not (start_frame.content_type or "").startswith("image/"):
        raise HTTPException(400, "File must be an image")

    end_bytes = None
    if end_frame:
        end_bytes = await end_frame.read()
        if len(end_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(400, "End frame too large (max 10MB)")
        if not (end_frame.content_type or "").startswith("image/"):
            raise HTTPException(400, "End frame must be an image")

    if USE_LOCAL:
        # Local mode: talk directly to ComfyUI
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"status": "IN_QUEUE"}
        asyncio.create_task(run_local_job(job_id, start_bytes, end_bytes))
        return {"job_id": job_id, "status": "IN_QUEUE"}
    else:
        # RunPod mode
        payload = {"start_image": base64.b64encode(start_bytes).decode()}
        if end_bytes:
            payload["end_image"] = base64.b64encode(end_bytes).decode()

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{RUNPOD_BASE}/run",
                headers=runpod_headers(),
                json={"input": payload},
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"RunPod error: {resp.text}")
        data = resp.json()
        return {"job_id": data["id"], "status": "IN_QUEUE"}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Poll for job status."""
    if USE_LOCAL:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        result = {"job_id": job_id, "status": job["status"]}
        if job["status"] == "COMPLETED":
            result["has_video"] = True
        elif job["status"] == "FAILED":
            result["error"] = job.get("error", "Unknown error")
        return result
    else:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{RUNPOD_BASE}/status/{job_id}",
                headers=runpod_headers(),
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"RunPod error: {resp.text}")
        data = resp.json()
        status = data.get("status", "UNKNOWN")
        result = {"job_id": job_id, "status": status}
        if status == "COMPLETED":
            output = data.get("output", {})
            if "error" in output:
                result["status"] = "FAILED"
                result["error"] = output["error"]
            else:
                result["has_video"] = "video" in output
        elif status == "FAILED":
            result["error"] = data.get("error", "Unknown error")
        return result


@app.get("/api/download/{job_id}")
async def download_video(job_id: str):
    """Download the completed video."""
    if USE_LOCAL:
        job = jobs.get(job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        if job.get("status") != "COMPLETED":
            raise HTTPException(400, "Job not completed yet")
        video_b64 = job.get("video")
        if not video_b64:
            raise HTTPException(404, "No video in output")
        video_bytes = base64.b64decode(video_b64)
        return Response(
            content=video_bytes,
            media_type="video/mp4",
            headers={"Content-Disposition": f"attachment; filename=property-flyby-{job_id[:8]}.mp4"},
        )
    else:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(
                f"{RUNPOD_BASE}/status/{job_id}",
                headers=runpod_headers(),
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"RunPod error: {resp.text}")
        data = resp.json()
        if data.get("status") != "COMPLETED":
            raise HTTPException(400, "Job not completed yet")
        output = data.get("output", {})
        video_b64 = output.get("video")
        if not video_b64:
            raise HTTPException(404, "No video in output")
        video_bytes = base64.b64decode(video_b64)
        return Response(
            content=video_bytes,
            media_type="video/mp4",
            headers={"Content-Disposition": f"attachment; filename=property-flyby-{job_id[:8]}.mp4"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
