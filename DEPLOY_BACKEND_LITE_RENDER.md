# Deploy backend-lite on Render (low space)

This path uses the lightweight backend that avoids heavy AI dependencies and keeps image size/storage lower.

## 1) Push code to GitHub

From project root:

```powershell
git add backend-lite/requirements.txt render-backend-lite.yaml DEPLOY_BACKEND_LITE_RENDER.md
git commit -m "prepare backend-lite render deployment"
git push
```

## 2) Create Postgres in Supabase (free)

1. Create a Supabase project.
2. Copy the Transaction Pooler URI.
3. Keep it for Render `DATABASE_URL`.

## 3) Deploy to Render using Blueprint (fastest)

1. In Render, click New + -> Blueprint.
2. Select this repo.
3. Choose blueprint file: `render-backend-lite.yaml`.
4. Set required env vars in Render UI:
- `DATABASE_URL` = your Supabase Postgres URI
- `FRONTEND_BASE_URL` = your frontend URL (or temporary placeholder)
- `YOUTUBE_BACKEND_REDIRECT_URI` = `https://<your-service>.onrender.com/auth/youtube/callback`

Render will build from `backend-lite/` only.

## 4) Manual Render setup (if you do not use Blueprint)

Create a new Web Service with:
- Root Directory: `backend-lite`
- Runtime: `Python 3`
- Build Command: `pip install --no-cache-dir -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Then set env vars:
- `DATABASE_URL`
- `FRONTEND_BASE_URL`
- `YOUTUBE_BACKEND_REDIRECT_URI`
- `TRIAL_DAYS=60`
- `MAX_UPLOAD_MB=500`

## 5) Keep disk usage low on Render

- Use `backend-lite` only (do not deploy `backend/`).
- Keep uploads temporary; Render disk is ephemeral.
- Do not store long-term media in local disk; move to object storage later.
- Keep `MAX_UPLOAD_MB` conservative (for free tier, 200-500 is practical).

## 6) Verify after deploy

Open:
- `https://<your-service>.onrender.com/`

Expected JSON includes:
- `message`
- `max_upload_mb`

Then test one short upload and confirm `output/<job_id>/highlight_reel.mp4` can be downloaded.

## 7) Update frontend API URL

Set frontend env:
- `VITE_API_BASE_URL=https://<your-service>.onrender.com`

Redeploy frontend after env update.
