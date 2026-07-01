# Automated Video Editor

Automated Video Editor is an AI-powered highlight generator that detects high-energy moments in long-form video and converts them into short highlight reels.

It combines audio analysis, computer vision, and a modern web UI so users can upload video, process highlights, and publish results with a token-based billing flow.

## Features

- Audio-based cheer detection with machine learning
- Automatic highlight reel generation
- URL and file upload support
- Token-based access control
- Free trial, free daily allowance, and paid plan upgrades
- YouTube publishing for eligible users

## Project Structure

- `backend/` FastAPI API, token billing, auth, processing, and deployment config
- `frontend/` Vite React app with the editor, pricing, tokens, and account UI
- `Model Training/` training assets and experimental code

## Local Development

Quick start (Windows PowerShell)

1) Clone the repository (do this from a real git clone so Git LFS objects can be fetched):

```powershell
git clone https://github.com/Ghostcoder59/AutoEditor-AI AutoEditor-AI-main
cd AutoEditor-AI-main\backend
```

2) Create and activate a Python virtual environment, install backend deps, and start the API:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
# Start the API (runs Uvicorn)
\.venv\Scripts\python.exe main.py
```

Notes:
- If you prefer the explicit Uvicorn command: `.venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`.
- The default backend port is `8000`. If it is in use, the terminal will show the alternate port or an error.

3) Fetch large model assets (Git LFS) — required for the trained cheer detector model:

```powershell
# Run this in the repository root (the folder created by git clone)
git lfs install --local
git lfs pull
```

4) Start the frontend (from the `frontend` folder):

```powershell
cd ..\frontend
npm install
# Use --host so other devices on the network can connect if needed
npm run dev -- --host
```

Open the Local URL shown by Vite in your browser (typically `http://localhost:5173` — if that port is busy Vite will use the next free port, e.g. `5174`).

Where files and state are stored

- SQLite DB (user accounts, sessions, tokens) is created by default at `backend/app.db`. You can override the path with the `AUTH_DB_PATH` environment variable.
- Uploaded videos and output are stored under `backend/uploads/` and `backend/output/<job-id>/` respectively.
- The cheer detector model file expected at `backend/cheer_detector_rf.pkl` is provided via Git LFS; without it the backend will run in a degraded audio-only mode and may produce no highlights.

Configuring email (password reset):

- To send real emails, set SMTP env vars in a `.env` file in `backend/` or in your environment: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
- For Gmail use an app password (recommended) and enable `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=587`.

YouTube publishing (OAuth):

- To enable publishing to YouTube you must create OAuth client credentials in Google Cloud and download the JSON. Place it at `backend/client_secrets.json`.
- If `client_secrets.json` is missing you will see: "YouTube API is not configured on the server (missing client_secrets.json)".
- Tokens and refresh tokens are saved per-user into the local DB in the `youtube_token` column. If the token expires you can re-connect from the account UI — the app saves credentials into the DB via the `save_youtube_token` helper.

Troubleshooting

- "No cheers detected" or no `highlight_reel.mp4`: either the model wasn't available (Git LFS pointer) or the analyzer fell back to audio-only. Verify `backend/cheer_detector_rf.pkl` is a real file (not a small LFS pointer).
- DB seems empty / users not persisting: confirm you're running the `backend` server from the same folder where `app.db` is located — `AUTH_DB_PATH` can change the file location. Look for `backend/app.db` after starting the API.
- YouTube "API expired" / token errors: tokens can expire — reconnect via the account -> Connect YouTube flow. Ensure `client_secrets.json` is valid and the redirect URIs match (see `YOUTUBE_BACKEND_REDIRECT_URI` env var in `backend/main.py`).

If you want, I can patch the README further to include sample `.env` values and a one-line script to start both backend + frontend.

## Deployment

See [DEPLOY_FREE.md](DEPLOY_FREE.md) for the free Vercel + Render + Supabase deployment path.
