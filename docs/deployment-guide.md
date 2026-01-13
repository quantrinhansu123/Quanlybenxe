# Deployment Guide: Vercel + Render (Free Tier)

## Overview

| Service | Platform | URL Pattern |
|---------|----------|-------------|
| Frontend | Vercel | `https://<project>.vercel.app` |
| Backend | Render | `https://<service>.onrender.com` |
| Database | Supabase | Already configured |
| Images | Cloudinary | Already configured |

---

## Step 1: Deploy Backend to Render

### 1.1 Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub account

### 1.2 Connect Repository
1. Click **New** > **Web Service**
2. Connect your GitHub repository
3. Select the `Quanlybenxe` repository

### 1.3 Configure Service
- **Name:** `ben-xe-backend`
- **Region:** Singapore (closest to Vietnam)
- **Branch:** `master`
- **Root Directory:** (leave empty - uses monorepo config)
- **Runtime:** Node
- **Build Command:** `cd server && npm install && npm run build`
- **Start Command:** `cd server && npm start`

### 1.4 Set Environment Variables

Add these in Render Dashboard > Environment:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Supabase connection string (pooler, port 6543) | Yes |
| `JWT_SECRET` | Random 32+ char string | Yes |
| `CORS_ORIGIN` | Your Vercel URL (after deploy) | Yes |
| `CLOUDINARY_CLOUD_NAME` | From Cloudinary dashboard | Yes |
| `CLOUDINARY_API_KEY` | From Cloudinary dashboard | Yes |
| `CLOUDINARY_API_SECRET` | From Cloudinary dashboard | Yes |
| `SUPABASE_URL` | https://xxx.supabase.co | Optional |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase settings | Optional |
| `GEMINI_API_KEY` | For AI chat feature | Optional |

### 1.5 Deploy
1. Click **Create Web Service**
2. Wait for build (~3-5 minutes)
3. Note the URL: `https://ben-xe-backend.onrender.com`

### 1.6 Verify
```bash
curl https://ben-xe-backend.onrender.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub account

### 2.2 Import Project
1. Click **Add New** > **Project**
2. Import from GitHub
3. Select the `Quanlybenxe` repository

### 2.3 Configure Project
- **Framework Preset:** Vite
- **Root Directory:** `client`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### 2.4 Set Environment Variables

Add in Vercel Dashboard > Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://ben-xe-backend.onrender.com/api` |

### 2.5 Deploy
1. Click **Deploy**
2. Wait for build (~1-2 minutes)
3. Note the URL: `https://<project>.vercel.app`

### 2.6 Update Backend CORS
Go back to Render and update `CORS_ORIGIN`:
```
https://<your-project>.vercel.app
```

---

## Step 3: Post-Deployment Verification

### 3.1 Health Checks
```bash
# Backend
curl https://ben-xe-backend.onrender.com/health

# Frontend (should load React app)
curl -I https://<your-project>.vercel.app
```

### 3.2 Test Login
1. Open frontend URL in browser
2. Try logging in with existing credentials
3. Verify API calls work (check Network tab)

---

## Important Notes

### Free Tier Limitations

**Render Free:**
- Service sleeps after 15 minutes of inactivity
- Cold start takes ~30 seconds
- 750 hours/month (enough for 1 service 24/7)

**Vercel Free:**
- 100GB bandwidth/month
- Serverless function limits (not used in this setup)
- Unlimited static deployments

### Upgrade Path
When ready for production:
- Render Starter: $7/month (always-on, no sleep)
- Vercel Pro: $20/month (if needed for team features)

---

## Troubleshooting

### Backend won't start
1. Check Render logs
2. Verify `DATABASE_URL` is correct (use pooler URL)
3. Ensure `JWT_SECRET` is set

### CORS errors
1. Verify `CORS_ORIGIN` matches exact Vercel URL
2. Check for trailing slashes
3. Backend auto-allows `.vercel.app` domains

### API calls fail
1. Check `VITE_API_URL` in Vercel env vars
2. Redeploy frontend after changing env vars
3. Check browser console for errors

### Cold start issues (Render free tier)
- First request after 15min idle takes ~30s
- Consider Render Starter ($7/mo) for always-on

---

## Environment Variables Reference

### Backend (Render)
```env
# Required
DATABASE_URL=postgresql://user:pass@db.xxx.supabase.co:6543/postgres?pgbouncer=true
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
CORS_ORIGIN=https://your-project.vercel.app

# Image uploads
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Optional
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
```

### Frontend (Vercel)
```env
VITE_API_URL=https://ben-xe-backend.onrender.com/api
```

---

**Last Updated:** 2026-01-13
