# LeafSignal — Potato Leaf Health Screening

A local React and FastAPI application that screens potato-leaf photos for **Early Blight**, **Late Blight**, or **Healthy**. The API first uses a pretrained SigLIP image-text model as a best-effort check that the upload looks like a potato leaf. It then passes accepted images to the project's Keras disease classifier.

This is a screening aid, not a diagnosis. It may make incorrect predictions, especially on field photos that differ from the training images.

## What the app does

1. The frontend accepts an image upload up to 12 MB and sends it to `POST /predict`.
2. The API decodes the image, corrects its orientation, converts it to RGB, and resizes it for the models.
3. The pretrained SigLIP model compares potato-leaf descriptions with other leaves and common non-leaf subjects. If a non-potato description scores higher, the API returns `This is not potato leaf image, please upload potato leaf images only.` without running disease classification.
4. Otherwise, `models/potatoes.keras` returns one of the three disease classes and its top softmax score.

The image-scope check is best-effort: it can accept a lookalike image or reject an unusual potato-leaf photo. Its relative text-image scores are not probabilities. The disease score is also not calibrated; `MIN_CONFIDENCE=0.90` is only a display cutoff and does not mean the diagnosis is 90% likely to be correct.

## Project layout

```text
api/
  main.py                 FastAPI routes and disease inference
  image_scope.py          Pretrained potato-leaf upload check
  requirements.txt        Python dependencies
frontend/
  .env.example            Local API URL template
  package.json
  package-lock.json
  public/
  src/
  start.ps1               Windows development launcher
models/
  potatoes.keras          Active three-class disease model
  siglip/vocabulary.spm   Tokenizer vocabulary for the scope check
```

The API loads `models/potatoes.keras` and `models/siglip/vocabulary.spm`. The legacy `potatoes.h5` and `models/1.keras` files are not used by the application and are excluded from the initial publication.

## Dataset

The dataset is not included in this repository. The [Mendeley Data record](https://data.mendeley.com/datasets/tywbtsjrjv/1) describes a 39-class dataset containing 61,486 images, including potato Early Blight, Healthy, and Late Blight classes. Extract those three class folders under `data/PlantVillage/`. The record is marked CC0 1.0; attribution is appreciated.

The current dataset contains 1,000 Early Blight images, 152 Healthy images, and 1,000 Late Blight images. Training uses square-root class weights to give the smaller Healthy class more influence. Keep the model's class order and `CLASS_NAMES` in `api/main.py` aligned with those folder names.

The active model was fine-tuned with balanced class weights. On a fixed, class-stratified 20% holdout from this same dataset, it reached 91.4% accuracy, with per-class recall of 94.5% Early Blight, 90.0% Late Blight, and 80.6% Healthy. About 61.5% of those holdout predictions cleared the UI's 90% score cutoff. These are internal dataset results, not a guarantee for new field photos; uncertain results remain possible.

## Run locally on Windows

Use Python 3.11–3.13 and Node.js with npm. TensorFlow 2.21.0 and KerasHub 0.32.0 were tested with Python 3.13.15 in this project. See the [official TensorFlow installation guide](https://www.tensorflow.org/install/pip) for supported versions and platform details. Open two PowerShell terminals in the project directory.

### 1. Start the API

In the first terminal, run:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r api\requirements.txt
python -m uvicorn main:app --app-dir api --host 127.0.0.1 --port 8000

```

The API is then available at `http://127.0.0.1:8000`. You can check that it is running at `http://127.0.0.1:8000/ping`.

On first startup, KerasHub downloads the SigLIP preset weights (about 776 MiB) into `.cache/kagglehub`. This requires internet access and can take a few minutes. Later startups reuse the cached weights. The tokenizer vocabulary is included at `models/siglip/vocabulary.spm`.

### 2. Start the frontend

In the second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm.cmd install
.\start.ps1
```

Open `http://localhost:3000`. By default, the frontend sends uploads to `http://localhost:8000/predict`. Set `REACT_APP_API_URL` in `.env.local` to use another endpoint.

## API behavior

### `GET /ping`

Returns a simple response indicating that the API is running.

### `POST /predict`

Send one multipart form field named `file`. The maximum upload size is 12,000,000 bytes (12 MB).

For an accepted potato-leaf photo, the response contains:

```json
{
  "class": "Early Blight",
  "confidence": 0.93,
  "is_confident": true
}
```

For an image outside the potato-leaf scope, the response contains:

```json
{
  "wrong_image": true,
  "message": "This is not potato leaf image, please upload potato leaf images only."
}
```

Empty, unsupported, or oversized uploads return HTTP 400 or 413. If the pretrained validator cannot load, the API returns HTTP 503 instead of producing a disease result without the scope check.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MIN_CONFIDENCE` | `0.90` | Score threshold used to mark the disease result confident in the UI. |
| `MAX_UPLOAD_SIZE` | `12000000` | API upload limit in bytes. The frontend dropzone is separately fixed at 12 MB. |
| `CORS_ORIGINS` | Local development origins | Comma-separated frontend origins allowed to call the API. |
| `REACT_APP_API_URL` | `http://localhost:8000/predict` | Prediction endpoint used by the React app. |

For a hosted frontend, set `CORS_ORIGINS` to its exact origin(s) and set `REACT_APP_API_URL` to the hosted API endpoint before building.

## Model and data notices

The PlantVillage dataset record lists CC0 1.0. The Keras-hosted SigLIP preset weights are listed under Apache 2.0. The large SigLIP weights are downloaded into the ignored cache at runtime rather than stored in this repository.

The training notebook is excluded from the initial publication. The included disease model supports inference; the initial repository does not include training code or dataset files.
