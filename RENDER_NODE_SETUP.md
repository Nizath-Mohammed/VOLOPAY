# Render Node Deployment Setup ✅

## Configuration for Node Runtime

Your project is now configured to deploy on Render using **Node runtime** (simpler than Docker).

---

## What to Enter in Render Dashboard

When creating your Web Service on Render, use these exact values:

### Basic Settings

**Name:** `volopay-revenue-intelligence-inbox` (or your choice)  
**Region:** Oregon (Free) or your preferred region  
**Branch:** `main`  
**Runtime:** `Node`

### Build & Deploy Settings

**Root Directory:** Leave blank  
**Build Command:** 
```bash
cd app && npm install && npm run build
```

**Start Command:**
```bash
npx serve -s app/dist -p $PORT
```

---

## How It Works

### 1. Build Phase
```bash
cd app                  # Navigate to app directory
npm install             # Install all dependencies
npm run build          # Run TypeScript compile + Vite build
```

**Output:** Production-ready files in `app/dist/`

### 2. Start Phase
```bash
npx serve -s app/dist -p $PORT
```

**What `serve` does:**
- ✅ Serves static files from `app/dist/`
- ✅ Handles SPA routing (all routes → index.html)
- ✅ Listens on Render's dynamic `$PORT` variable
- ✅ Gzip compression enabled by default
- ✅ Cache headers for assets

---

## render.yaml Configuration

Your `render.yaml` now contains:

```yaml
services:
  - type: web
    name: volopay-revenue-intelligence-inbox
    runtime: node
    region: oregon
    plan: free
    branch: main
    buildCommand: cd app && npm install && npm run build
    startCommand: npx serve -s app/dist -p $PORT
    healthCheckPath: /
    pullRequestPreviewsEnabled: true
```

---

## Deployment Steps

### Option 1: Automatic (Blueprint - Recommended)

1. Go to Render Dashboard: https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your repository: `Nizath-Mohammed/VOLOPAY`
4. Render detects `render.yaml` automatically
5. Click **"Apply"**
6. Wait 3-5 minutes for build and deployment

### Option 2: Manual Web Service

1. Go to Render Dashboard: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect repository: `Nizath-Mohammed/VOLOPAY`
4. Configure:
   - **Runtime:** Node
   - **Build Command:** `cd app && npm install && npm run build`
   - **Start Command:** `npx serve -s app/dist -p $PORT`
5. Click **"Create Web Service"**
6. Wait for deployment

---

## Verify Deployment

### Check Build Logs

Watch the deployment logs in Render Dashboard:

```
==> Installing dependencies
npm install (in app/)

==> Building application
npm run build
  - TypeScript compilation
  - Vite bundling
  - Output: app/dist/

==> Starting server
npx serve -s app/dist -p $PORT
INFO: Accepting connections at http://0.0.0.0:10000

==> Your service is live
```

### Test Your Application

1. **Main app:** `https://volopay-revenue-intelligence-inbox.onrender.com`
2. **Load Initial Batch** button → Should import 44 records
3. **Verify dashboard** → Shows metrics correctly
4. **Open drawer** → Record details display
5. **Generate analysis** → Works correctly
6. **Browser refresh** → Data persists (localStorage)

---

## Troubleshooting

### Build Fails

**Error: `npm install` fails**
```
Check app/package.json is valid
Verify all dependencies exist on npm registry
Review build logs for specific error
```

**Error: `npm run build` fails**
```
Check for TypeScript errors locally:
cd app
npm install
npm run build

If successful, commit and push:
git add .
git commit -m "Fix build errors"
git push origin main
```

### Start Command Fails

**Error: `serve` not found**
- Already fixed! We added `"serve": "^14.2.1"` to dependencies
- Render will install it automatically during `npm install`

**Error: Port binding fails**
- Ensure start command uses `$PORT` variable
- Render assigns port dynamically
- Current command: `npx serve -s app/dist -p $PORT` ✅

### App Loads But Routes Don't Work

**404 on refresh or direct URL access:**
- `serve -s` handles this automatically (SPA routing)
- All requests are rewritten to `/index.html`
- No additional configuration needed ✅

---

## Dependencies Added

Added `serve` to `app/package.json`:

```json
"dependencies": {
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "serve": "^14.2.1"  ← Added this
}
```

**What is `serve`?**
- Lightweight static file server
- Perfect for React/Vite production deployments
- Built-in SPA routing support
- ~6MB install size
- Zero configuration needed

---

## Comparison: Node vs Docker

### Node Runtime (Current - ✅ Recommended)

**Pros:**
- ✅ Simpler configuration
- ✅ Faster builds (no Docker layer overhead)
- ✅ No Dockerfile needed
- ✅ Works with Render's free tier
- ✅ Auto-detects Node version
- ✅ Easy to debug

**Cons:**
- ⚠️ Less control over server configuration
- ⚠️ Uses `serve` instead of nginx

### Docker Runtime (Alternative)

**Pros:**
- ✅ Full control with nginx
- ✅ Production-grade web server
- ✅ Custom caching rules
- ✅ More control over security headers

**Cons:**
- ⚠️ Longer build times
- ⚠️ More complex configuration
- ⚠️ Requires Dockerfile maintenance
- ⚠️ Larger deployment size

**Verdict:** Node runtime is perfect for this React app. Docker is overkill.

---

## Performance

### Build Time
- First build: ~2-3 minutes (npm install + build)
- Cached builds: ~1-2 minutes (reuses node_modules cache)

### Runtime Performance
- Small memory footprint (~100MB)
- Fast response times (<100ms for cached assets)
- Handles Render free tier perfectly

### Cold Start (Free Tier)
- Service sleeps after 15 minutes inactivity
- First request wakes it up (~10-30 seconds)
- Subsequent requests: immediate

---

## Auto-Deploy

Every `git push` to `main` branch triggers automatic deployment:

```bash
cd "c:\Users\nizat\Downloads\candidate-v1.0 (3)_layout_fixed (1)(2) (3)\candidate"

# Make changes to your code
git add .
git commit -m "Update feature"
git push origin main

# Render automatically:
# 1. Detects the push
# 2. Runs build command
# 3. Runs start command
# 4. Deploys new version
```

---

## Environment Variables

If you need to add environment variables later:

1. Go to Render Dashboard → Your Service → "Environment"
2. Click "Add Environment Variable"
3. Add variables (must start with `VITE_` to be available in React):
   ```
   VITE_API_URL=https://api.example.com
   VITE_ANALYTICS_ID=abc123
   ```
4. Redeploy to apply changes

**Access in code:**
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

---

## Free Tier Limits

Render Free Tier with Node runtime:

- ✅ 750 hours/month uptime
- ✅ 512 MB RAM (sufficient for this app)
- ✅ 0.1 CPU (adequate for web server)
- ✅ Automatic HTTPS/SSL
- ✅ Auto-deploy on git push
- ⚠️ Spins down after 15 min inactivity

**Upgrade to keep always-on:** $7/month for Starter plan

---

## Quick Reference

### Render Configuration
```yaml
Runtime: node
Build: cd app && npm install && npm run build
Start: npx serve -s app/dist -p $PORT
```

### Local Testing
```bash
cd app
npm install
npm run build
npx serve -s dist -p 3000
# Visit http://localhost:3000
```

### Git Deploy
```bash
git add .
git commit -m "Changes"
git push origin main
```

---

## Deployment Checklist

- ✅ render.yaml configured for Node runtime
- ✅ `serve` package added to dependencies
- ✅ Build command tested locally
- ✅ All changes pushed to GitHub
- 🔄 Ready to create Render Web Service

---

## Expected Deployment URL

```
https://volopay-revenue-intelligence-inbox.onrender.com
```

**Test URLs:**
- Main app: `/`
- Dashboard: `/` (after loading data)
- Inbox: `/` (scroll down after loading)

---

**Last Updated:** 2024-12-19  
**Runtime:** Node with serve  
**Repository:** https://github.com/Nizath-Mohammed/VOLOPAY  
**Status:** ✅ Ready to deploy

