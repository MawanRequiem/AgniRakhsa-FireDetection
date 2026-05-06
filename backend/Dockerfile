FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and AI libraries
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libxcb1 \
    && rm -rf /var/lib/apt/lists/*

# ============================================================
# CRITICAL: Install CPU-only PyTorch FIRST (~150MB vs ~2.5GB CUDA)
# This prevents ultralytics from pulling the massive CUDA version
# ============================================================
RUN pip install --no-cache-dir \
    torch torchvision \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining project dependencies
# Since torch is already satisfied (CPU), pip will NOT re-download CUDA version
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "pydantic-settings>=2.0.0" \
    "python-dotenv>=1.0.0" \
    "supabase>=2.0.0" \
    "httpx>=0.27.0" \
    "bcrypt>=4.2.0" \
    "python-multipart>=0.0.9" \
    "ultralytics>=8.1.0" \
    "Pillow>=10.2.0" \
    "numpy>=1.26.0" \
    "opencv-python-headless>=4.9.0" \
    "email-validator>=2.1.0" \
    "websockets>=12.0" \
    "scikit-learn>=1.4.0" \
    "joblib>=1.3.0" \
    "pandas>=2.1.0" \
    "tensorflow-cpu>=2.15.0" \
    "Sastrawi>=1.0.1"

COPY . .

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
