# Render Deployment Guide

This guide explains how to deploy the Volopay Revenue Intelligence Inbox application to Render.com.

## Prerequisites

1. **GitHub Account**: Your code is already pushed to https://github.com/Nizath-Mohammed/VOLOPAY.git
2. **Render Account**: Sign up at https://render.com (free tier available)

---

## Deployment Steps

### Step 1: Create Render Account

1. Go to https://render.com
2. Click **"Get Started"** or **"Sign Up"**
3. Sign up with your GitHub account (recommended) or email
4. Verify your email address if required

### Step 2: Connect GitHub Repository

1. Log in to your Render dashboard: https://dashboard.render.com
2. Click **"New +"** button in the top right
3. Select **"Static Site"** from the dropdown menu
4. Click **"Connect a repository"**
5. If this is your first time:
   - Click **"Connect GitHub"**
   - Authorize Render to access your GitHub account
   - Select "Only select repositories" or "All repositories"
   - Choose or search for **"VOLOPAY"** repository
   - Click **"Install"**
6. If already connected:
   - Find **"VOLOPAY"** in the repository list
   - Click **"Connect"**

### Step 3: Configure Deployment Settings

Render will auto-detect the `render.yaml` file. Verify or manually configure:

**Basic Settings:**
- **Name**: `volopay-revenue-intelligence-inbox` (or your preferred name)
- **Region**: Oregon (Free) or your preferred region
- **Branch**: `main`
- **Root Directory**: Leave blank (uses repository root)

**Build Settings:**
- **Build Command**: `cd app && npm install && npm run build`
- **Publish Directory**: `./app/dist`

**Advanced Settings (Optional):**
- **Auto-Deploy**: Yes (deploys automatically on git push)
- **Pull Request Previews**: Enabled (optional, creates preview deployments for PRs)

### Step 4: Deploy

1. Review all settings
2. Click **"Create Static Site"** button
3. Render will start building your application
4. Wait 2-5 minutes for the initial build and deployment

### Step 5: Monitor Deployment

Watch the build logs in real-time:
- **Building**: Installing dependencies and running build
- **Publishing**: Uploading static files to Render's CDN
- **Live**: Deployment complete, URL becomes active

---

## Deployment URL

After successful deployment, your application will be available at:

```
https://volopay-revenue-intelligence-inbox.onrender.com
```

Or your custom URL if you chose a different name:
```
https://[your-chosen-name].onrender.com
```

---

## Configuration Files

### `render.yaml` (Blueprint Specification)

Defines the infrastructure as code:

```yaml
services:
  - type: web
    name: volopay-revenue-intelligence-inbox
    runtime: node
    region: oregon
    plan: free
    branch: main
    buildCommand: cd app && npm install && npm run build
    staticPublishPath: ./app/dist
    pullRequestPreviewsEnabled: true
```

**Key Configuration:**
- **type: web** - Static web service (serves HTML/CSS/JS)
- **runtime: node** - Uses Node.js for build process
- **buildCommand** - Installs dependencies and builds production bundle
- **staticPublishPath** - Serves files from `app/dist/` directory
- **plan: free** - Uses Render's free tier (100GB bandwidth/month)

### `.renderignore` (Excludes Files)

Prevents unnecessary files from being uploaded:
- `node_modules/` - Dependencies (reinstalled during build)
- `app/src/test/` - Test files (not needed in production)
- Documentation files - Kept in repo but not deployed
- Build artifacts - Regenerated during deployment

---

## Post-Deployment Verification

### 1. Check Application Loads

Visit your Render URL and verify:
- ✅ Dashboard displays metrics correctly
- ✅ "Load Initial Batch" button works
- ✅ Records appear in inbox table
- ✅ Drawer opens when clicking records
- ✅ Analysis generation functions
- ✅ Export buttons trigger downloads

### 2. Test Data Replay Workflow

Follow the README.md verification steps:
1. Load Initial Batch → 44 records, 17 transcripts
2. Reimport Shuffled → No duplicates
3. Apply manual route correction → Saves successfully
4. Apply Update Batch → M07 gains transcript (18 total)
5. Verify manual correction persists → Override preserved
6. Refresh browser → Data persists in localStorage

### 3. Check Browser Console

Open DevTools (F12) and verify:
- ✅ No JavaScript errors
- ✅ All assets load successfully (CSS, JS bundles)
- ✅ localStorage operations work correctly

---

## Troubleshooting

### Build Fails

**Error: `npm install` fails**
- Check `app/package.json` is valid JSON
- Verify all dependencies are published to npm registry
- Review build logs for specific error messages

**Error: `npm run build` fails**
- Check TypeScript compilation errors
- Verify `app/vite.config.ts` is correct
- Ensure `app/tsconfig.json` has proper configuration

**Fix**: Push fix to GitHub main branch → Render auto-deploys

### Application Doesn't Load

**Blank page after deployment**
- Check browser console for errors
- Verify `staticPublishPath: ./app/dist` matches actual build output
- Ensure `index.html` exists in `app/dist/` after build

**404 on routes**
- Verify `routes` configuration in `render.yaml` rewrites all paths to `/index.html`
- Single-page applications need this for client-side routing

### localStorage Not Working

**Data doesn't persist**
- Check browser settings allow localStorage
- Verify no incognito/private browsing mode
- Check browser console for storage quota errors
- Ensure domain is not blocking cookies/storage

### Slow Initial Load

**Expected behavior:**
- First visit: ~331KB JavaScript bundle loads
- Uses browser caching for subsequent visits
- Import operations load JSON data client-side

---

## Updating Your Deployment

### Automatic Deployment (Recommended)

Every `git push` to `main` branch triggers auto-deploy:

```bash
cd "c:\Users\nizat\Downloads\candidate-v1.0 (3)_layout_fixed (1)(2) (3)\candidate"
git add .
git commit -m "Your commit message"
git push origin main
```

Render automatically:
1. Detects the push
2. Rebuilds the application
3. Deploys the new version
4. Zero-downtime deployment

### Manual Deployment

From Render Dashboard:
1. Go to your service page
2. Click **"Manual Deploy"** dropdown
3. Select **"Deploy latest commit"**
4. Wait for build to complete

---

## Custom Domain (Optional)

### Add Your Own Domain

1. In Render Dashboard, go to your service
2. Click **"Settings"** tab
3. Scroll to **"Custom Domains"**
4. Click **"Add Custom Domain"**
5. Enter your domain (e.g., `volopay.yourdomain.com`)
6. Add the provided DNS records to your domain registrar:
   - **CNAME**: `volopay` → `volopay-revenue-intelligence-inbox.onrender.com`
7. Wait for DNS propagation (5 minutes - 48 hours)
8. Render auto-provisions free SSL certificate

---

## Environment Variables (If Needed)

Currently, this application runs entirely client-side with no backend or API keys. If you add external services in the future:

1. Go to **"Environment"** tab in Render Dashboard
2. Click **"Add Environment Variable"**
3. Add key-value pairs
4. Access in code via `import.meta.env.VITE_YOUR_KEY`
5. Prefix with `VITE_` for Vite to expose to client-side code

**Security Note**: Never commit API keys or secrets to GitHub. Use Render's environment variables instead.

---

## Monitoring & Logs

### View Logs

1. Go to your service in Render Dashboard
2. Click **"Logs"** tab
3. View build logs and deployment events
4. Filter by date/time or search keywords

### Check Service Status

- **Live**: Application is running and accessible
- **Building**: Deployment in progress
- **Failed**: Build or deployment error (check logs)
- **Suspended**: Free tier inactive for 90 days (auto-resumes on access)

---

## Free Tier Limits

Render Free Tier includes:
- ✅ 100GB bandwidth per month
- ✅ Automatic SSL certificates
- ✅ CDN for global distribution
- ✅ Unlimited builds and deployments
- ⚠️ Service sleeps after 15 minutes of inactivity (resumes on first request)
- ⚠️ 750 hours/month of uptime (approximately 31 days)

**Note**: Static sites don't "sleep" like web services. Your site remains fast and available.

---

## Support & Resources

- **Render Documentation**: https://render.com/docs/static-sites
- **Render Status**: https://status.render.com
- **Community Forum**: https://community.render.com
- **GitHub Repository**: https://github.com/Nizath-Mohammed/VOLOPAY

---

## Deployment Checklist

Before marking deployment complete:

- ✅ Application builds successfully on Render
- ✅ Deployment URL is accessible
- ✅ Dashboard displays metrics correctly
- ✅ Data import workflow functions
- ✅ Analysis generation works
- ✅ Export downloads trigger successfully
- ✅ localStorage persistence verified
- ✅ Manual route corrections persist through updates
- ✅ Browser refresh preserves state
- ✅ No console errors
- ✅ README.md updated with deployment URL

---

## Next Steps After Deployment

1. **Update README.md**: Add "Live Demo" link with your Render URL
2. **Test Thoroughly**: Run through all replay verification steps on production URL
3. **Share Link**: Include deployment URL in assignment submission
4. **Monitor Performance**: Check Render logs for any runtime issues
5. **Document Any Issues**: Note browser compatibility or performance observations

---

**Deployment Created**: 2024-12-19  
**Repository**: https://github.com/Nizath-Mohammed/VOLOPAY.git  
**Expected URL**: https://volopay-revenue-intelligence-inbox.onrender.com

