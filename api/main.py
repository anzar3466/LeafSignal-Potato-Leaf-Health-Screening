from fastapi import FastAPI, File, UploadFile
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError
import os
import numpy as np
from io import BytesIO
from pathlib import Path
import logging
import tensorflow as tf
import uvicorn
from image_scope import is_potato_leaf, warm_up_detector

app = FastAPI(
    title="LeafSignal API",
    description="Potato-leaf image screening for Early Blight, Late Blight, and Healthy classes.",
)
logger = logging.getLogger(__name__)

default_origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]
origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", ",".join(default_origins)).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "potatoes.keras"
MODEL = tf.keras.models.load_model(MODEL_PATH)

CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]
MIN_CONFIDENCE = float(os.getenv("MIN_CONFIDENCE", "0.90"))
if not 0.0 <= MIN_CONFIDENCE <= 1.0:
    raise ValueError("MIN_CONFIDENCE must be between 0 and 1")
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", "12000000"))
if MAX_UPLOAD_SIZE <= 0:
    raise ValueError("MAX_UPLOAD_SIZE must be greater than 0")

@app.get("/ping")
async def ping():
    return "Hello, I am alive"


@app.on_event("startup")
async def warm_up_models():
    # Avoid making the first upload pay the one-time cost of loading SigLIP.
    try:
        await run_in_threadpool(warm_up_detector)
    except Exception:
        # Keep the health endpoint available if first-run weight setup fails;
        # /predict will report that its required validator is unavailable.
        logger.exception("Could not warm up the potato-leaf image validator")

def read_file_as_image(data: bytes) -> np.ndarray:
    """Decode uploads consistently with the model's RGB input contract."""
    input_shape = MODEL.input_shape
    if isinstance(input_shape, list):
        input_shape = input_shape[0]
    height, width = input_shape[1:3]
    if height is None or width is None:
        raise RuntimeError("The model must define fixed image height and width")

    with Image.open(BytesIO(data)) as uploaded_image:
        image = ImageOps.exif_transpose(uploaded_image).convert("RGB")
        image = image.resize((width, height), Image.Resampling.BILINEAR)
        return np.asarray(image)

@app.post("/predict")
async def predict(
        file: UploadFile = File(...)
):
    contents = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"The uploaded image exceeds the {MAX_UPLOAD_SIZE // 1_000_000} MB size limit",
        )
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    try:
        image = read_file_as_image(contents)
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a supported image")

    try:
        potato_leaf, _, _ = await run_in_threadpool(is_potato_leaf, image)
    except Exception as error:
        # Never fall back to a disease label if the out-of-scope guard is unavailable.
        raise HTTPException(
            status_code=503,
            detail="Image validation is unavailable. Check the network connection and try again.",
        ) from error

    if not potato_leaf:
        return {
            "wrong_image": True,
            "message": "This is not potato leaf image, please upload potato leaf images only.",
        }

    img_batch = np.expand_dims(image, 0)
    # Calling the model directly avoids predict()'s dataset adapter overhead
    # for this single-image request. Keep the TensorFlow call off the event loop.
    predictions = await run_in_threadpool(lambda: MODEL(img_batch, training=False).numpy()[0])
    predicted_class = CLASS_NAMES[np.argmax(predictions)]
    confidence = np.max(predictions)
    return {
        'class': predicted_class,
        'confidence': float(confidence),
        'is_confident': bool(confidence >= MIN_CONFIDENCE),
    }

if __name__ == "__main__":
    uvicorn.run(app, host='localhost', port=8000)
