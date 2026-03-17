#!/bin/bash
# Download all required models to RunPod Network Volume
# Run this ONCE on a RunPod pod with the network volume mounted at /workspace
#
# Usage: bash download_models.sh

set -e

MODELS_DIR="/workspace/models"
mkdir -p "$MODELS_DIR"/{unet,clip,vae,loras}

echo "=== DroneShot Model Downloader ==="
echo "Downloading models to $MODELS_DIR"
echo ""

# --- Qwen Image Edit (for angle generation) ---
echo "[1/6] Qwen UNET (Qwen-Image-Edit-2511-FP8)..."
wget -c -O "$MODELS_DIR/unet/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors" \
    "https://huggingface.co/Comfy-Org/Qwen-Image-Edit-2511_comfyui/resolve/main/Qwen-Image-Edit-2511-FP8_e4m3fn.safetensors"

echo "[2/6] Qwen CLIP (qwen_2.5_vl_7b_fp8)..."
wget -c -O "$MODELS_DIR/clip/qwen_2.5_vl_7b_fp8_scaled.safetensors" \
    "https://huggingface.co/Comfy-Org/Qwen-Image-Edit-2511_comfyui/resolve/main/qwen_2.5_vl_7b_fp8_scaled.safetensors"

echo "[3/6] Qwen VAE..."
wget -c -O "$MODELS_DIR/vae/qwen_image_vae.safetensors" \
    "https://huggingface.co/Comfy-Org/Qwen-Image-Edit-2511_comfyui/resolve/main/qwen_image_vae.safetensors"

echo "[4/6] Lightning 4-step LoRA..."
wget -c -O "$MODELS_DIR/loras/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors" \
    "https://huggingface.co/SoloDream/Qwen-Image-Edit-2511-Lightning-4steps/resolve/main/Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors"

echo "[5/6] Multi-angle LoRA..."
wget -c -O "$MODELS_DIR/loras/qwen-image-edit-2511-multiple-angles-lora.safetensors" \
    "https://huggingface.co/jtydhr88/qwen-image-edit-2511-multiple-angles-lora/resolve/main/qwen-image-edit-2511-multiple-angles-lora.safetensors"

# --- Wan 2.2 (for video generation) ---
echo "[6/6] Wan 2.2 models..."

# CLIP
wget -c -O "$MODELS_DIR/clip/umt5_xxl_fp8_e4m3fn_scaled.safetensors" \
    "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors"

# VAE
wget -c -O "$MODELS_DIR/vae/wan_2.1_vae.safetensors" \
    "https://huggingface.co/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors"

# UNET - Wan 2.2 Fun I2V 14B FP8 (SFW version for real estate)
# NOTE: Update this URL to the correct Wan 2.2 FLF2V model when available
# For now, using the standard wan2.1 i2v model
wget -c -O "$MODELS_DIR/unet/wan2.2_fun_i2v_14B_fp8.safetensors" \
    "https://huggingface.co/Kijai/WanVideo_comfy/resolve/main/Wan2.1_FLF2V_720p_bf16.safetensors"

echo ""
echo "=== All models downloaded ==="
echo "Total disk usage:"
du -sh "$MODELS_DIR"
echo ""
echo "Directory structure:"
find "$MODELS_DIR" -type f -exec ls -lh {} \;
