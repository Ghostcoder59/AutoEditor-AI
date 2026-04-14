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

Backend:

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Deployment

See [DEPLOY_FREE.md](DEPLOY_FREE.md) for the free Vercel + Render + Supabase deployment path.
