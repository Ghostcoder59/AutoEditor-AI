# Free Deployment Guide (Vercel + Render + Supabase)

This guide deploys your app as a real public website for $0/month using free tiers.

## Architecture

- Frontend: Vercel (free)
- Backend API: Render Web Service (free)
- Database: Supabase Postgres (free)

## 1) Prerequisites

Create free accounts:
- GitHub
- Vercel
- Render
- Supabase
- Google Cloud Console (for YouTube OAuth)

Install locally:
- Git
- Node.js 20+
- Python 3.10+

## 2) Push code to GitHub

From project root:

```powershell
git init
git add .
git commit -m "prepare free deployment"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

## 3) Create Supabase database

1. In Supabase, create a new project.
2. Open Project Settings -> Database.
3. Copy the Postgres connection string (Transaction Pooler URI recommended).
4. Save it for Render env var `DATABASE_URL`.

No manual SQL is required. The backend auto-creates required tables on startup.

## 4) Deploy backend on Render (free)

1. Render -> New -> Web Service.
2. Connect your GitHub repo.
3. Set:
- Root Directory: `backend`
- Runtime: `Python 3`
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

4. Add environment variables in Render:
- `DATABASE_URL` = your Supabase Postgres URI
- `FRONTEND_BASE_URL` = temporary placeholder, e.g. `https://example.vercel.app` (update after frontend deploy)
- `YOUTUBE_BACKEND_REDIRECT_URI` = `https://<render-service>.onrender.com/auth/youtube/callback`
- `TRIAL_DAYS` = `60`

Optional env vars:
- `STRIPE_SECRET_KEY`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

5. Deploy and copy backend URL, e.g.:
- `https://autoeditor-api.onrender.com`

## 5) Deploy frontend on Vercel (free)

1. Vercel -> Add New Project -> import your GitHub repo.
2. Set:
- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

3. Add env var in Vercel:
- `VITE_API_BASE_URL` = your Render backend URL

4. Deploy and copy frontend URL, e.g.:
- `https://autoeditor-pro.vercel.app`

## 6) Final env updates on Render

After Vercel is live, update Render env var:
- `FRONTEND_BASE_URL=https://autoeditor-pro.vercel.app`

Redeploy backend after saving.

## 7) Configure Google OAuth for YouTube publish

In Google Cloud Console (OAuth 2.0 Client):
- Authorized redirect URI:
  - `https://<render-service>.onrender.com/auth/youtube/callback`

In your backend `client_secrets.json`, ensure the same client is used.

## 8) Verify deployment

1. Open frontend URL.
2. Register user and login.
3. Open the app and process a video.
4. Confirm trial countdown and plan behavior.
5. YouTube publish should work for trial/pro users only.

## 9) Notes about free tiers

- Render free sleeps when idle. First request may take 30-60 seconds.
- Free tiers have compute/storage limits.
- Uploaded and processed files on Render are ephemeral. For long-term media storage, later move files to Supabase Storage.

## 10) Local development still works

If `DATABASE_URL` is not set, backend uses local SQLite (`AUTH_DB_PATH` / `app.db`).
