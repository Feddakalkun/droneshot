FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# System packages
RUN apt-get update && apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    git wget curl ffmpeg libgl1-mesa-glx libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Python packages
RUN pip install --no-cache-dir --no-build-isolation \
    torch==2.6.0+cu124 torchvision==0.21.0+cu124 torchaudio==2.6.0+cu124 \
    --index-url https://download.pytorch.org/whl/cu124

RUN pip install --no-cache-dir \
    runpod \
    xformers \
    accelerate \
    transformers \
    safetensors \
    einops \
    scipy \
    numpy \
    Pillow \
    aiohttp

WORKDIR /app

# Clone ComfyUI
RUN git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git /app/ComfyUI \
    && cd /app/ComfyUI && pip install --no-cache-dir -r requirements.txt

# Install required custom nodes
RUN cd /app/ComfyUI/custom_nodes \
    && git clone --depth 1 https://github.com/jtydhr88/ComfyUI-qwenmultiangle.git \
    && git clone --depth 1 https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git \
    && git clone --depth 1 https://github.com/kijai/ComfyUI-KJNodes.git

# Install node dependencies
RUN cd /app/ComfyUI/custom_nodes/ComfyUI-VideoHelperSuite && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
RUN cd /app/ComfyUI/custom_nodes/ComfyUI-KJNodes && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true
RUN cd /app/ComfyUI/custom_nodes/ComfyUI-qwenmultiangle && pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Copy handler and workflow
COPY src/rp_handler.py /app/rp_handler.py
COPY src/workflow.json /app/workflow.json

ENV COMFY_URL=http://127.0.0.1:8188
ENV WORKFLOW_PATH=/app/workflow.json
ENV COMFY_OUTPUT_DIR=/app/ComfyUI/output

# Copy model download script
COPY scripts/download_models.sh /app/download_models.sh
RUN chmod +x /app/download_models.sh

# Startup: check for network volume models OR download to local cache, then run handler
RUN echo '#!/bin/bash\n\
set -e\n\
MODELS="/app/ComfyUI/models"\n\
\n\
# If network volume has models, symlink them\n\
if [ -d "/runpod-volume/models" ]; then\n\
    echo "Using network volume models..."\n\
    for dir in /runpod-volume/models/*/; do\n\
        dirname=$(basename "$dir")\n\
        target="$MODELS/$dirname"\n\
        rm -rf "$target" 2>/dev/null\n\
        ln -sf "$dir" "$target"\n\
        echo "  Linked: $dirname"\n\
    done\n\
elif [ -d "/workspace/models" ]; then\n\
    echo "Using workspace models..."\n\
    for dir in /workspace/models/*/; do\n\
        dirname=$(basename "$dir")\n\
        target="$MODELS/$dirname"\n\
        rm -rf "$target" 2>/dev/null\n\
        ln -sf "$dir" "$target"\n\
        echo "  Linked: $dirname"\n\
    done\n\
else\n\
    echo "No volume found — downloading models to local cache..."\n\
    export MODELS_DIR="$MODELS"\n\
    mkdir -p "$MODELS"/{unet,clip,vae,loras}\n\
    bash /app/download_models.sh\n\
fi\n\
\n\
echo "Starting handler..."\n\
exec python3 /app/rp_handler.py\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
