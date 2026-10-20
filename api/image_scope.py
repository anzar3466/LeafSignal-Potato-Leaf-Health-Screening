"""Best-effort zero-shot gate for uploads that are not potato-leaf photos."""

from functools import lru_cache
import os
from pathlib import Path

# Keep model weights in a project-local cache so sandboxed/local runs can write
# them and so repeated uploads never trigger another download.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("KAGGLEHUB_CACHE", str(PROJECT_ROOT / ".cache" / "kagglehub"))

import keras_hub
import numpy as np


PRESET = "siglip_base_patch16_224"
POTATO_PROMPTS = (
    "a close-up photograph of a potato plant leaf",
    "a photograph of potato foliage with visible leaf veins",
    "a potato leaf showing early blight or late blight spots",
    "a healthy green potato leaf photographed outdoors",
)
OTHER_PROMPTS = (
    "a photograph of a tomato plant leaf",
    "a photograph of a pepper plant leaf",
    "a photograph of a different kind of green plant leaf",
    "a photograph of a tree leaf",
    "a photograph of a flower",
    "a photograph of a person or animal",
    "a photograph of food or a potato tuber",
    "a photograph of a building, object, or landscape",
)
PROMPTS = POTATO_PROMPTS + OTHER_PROMPTS


@lru_cache(maxsize=1)
def _load_detector():
    """Load once, and let KerasHub cache the pretrained weights outside the dataset."""
    model = keras_hub.models.SigLIPBackbone.from_preset(PRESET)
    tokenizer = keras_hub.models.SigLIPTokenizer(
        proto=str(PROJECT_ROOT / "models" / "siglip" / "vocabulary.spm")
    )
    image_converter = keras_hub.layers.SigLIPImageConverter(
        image_size=(224, 224),
        scale=1 / 127.5,
        offset=-1.0,
        crop_to_aspect_ratio=False,
    )
    preprocessor = keras_hub.models.SigLIPPreprocessor(
        tokenizer=tokenizer,
        image_converter=image_converter,
        sequence_length=64,
    )
    prompt_inputs = preprocessor({
        "images": np.zeros((1, 224, 224, 3), dtype=np.uint8),
        "prompts": list(PROMPTS),
    })
    # Prompt text is constant, so encode it once instead of on every upload.
    text_embeddings = model.get_text_embeddings(prompt_inputs["token_ids"])
    return model, image_converter, text_embeddings


def is_potato_leaf(image: np.ndarray) -> tuple[bool, float, float]:
    """Compare potato-leaf prompts to out-of-scope prompts.

    The returned scores are relative SigLIP logits, not probabilities. This is
    a best-effort upload filter and cannot guarantee that every image is valid.
    """
    model, image_converter, text_embeddings = _load_detector()
    images = image_converter(np.asarray(image, dtype=np.uint8)[None, ...])
    image_embeddings = model.get_vision_embeddings(images)
    _, text_logits = model.siglip_head(image_embeddings, text_embeddings)
    # Compare cached prompt embeddings against this single image embedding.
    logits = np.asarray(text_logits)[:, 0]
    potato_score = float(np.max(logits[: len(POTATO_PROMPTS)]))
    other_score = float(np.max(logits[len(POTATO_PROMPTS) :]))
    return potato_score > other_score, potato_score, other_score


def warm_up_detector() -> None:
    """Load the large pretrained weights before the first user upload."""
    _load_detector()
    is_potato_leaf(np.zeros((224, 224, 3), dtype=np.uint8))
