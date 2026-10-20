# LeafSignal Frontend

The React interface for uploading potato-leaf photos and reviewing screening results. See the [project README](../README.md) for the API setup, model details, and complete run instructions.

## Run on Windows

From this directory, install dependencies and start the development server:

```powershell
npm.cmd install
.\start.ps1
```

The app opens at `http://localhost:3000`. By default it sends uploads to `http://localhost:8000/predict`. To change that endpoint, set `REACT_APP_API_URL` in `.env.local` before starting the app.

## Build

```powershell
npm.cmd run build
```
