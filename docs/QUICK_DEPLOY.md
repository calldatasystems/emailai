# Quick Deploy Guide

## One-Command Deployment Options

### Local Development
```bash
bash scripts/setup.sh
```
→ Installs everything locally, runs on `localhost:3000`

---

### Vercel Deployment (Production)
```bash
bash scripts/setup.sh --vercel
```
→ Deploys to Vercel automatically, returns live URL

---

## What's Different?

### Local Setup (`bash scripts/setup.sh`)

**Installs:**
- PostgreSQL locally
- Redis (optional, local or Upstash)
- All dependencies

**Creates:**
- `.env.local` file
- Local database
- Sample data

**Result:**
- App runs at `http://localhost:3000`
- Development environment ready

**Time:** ~10-15 minutes

---

### Vercel Setup (`bash scripts/setup.sh --vercel`)

**Prompts for:**
- Cloud database (Supabase/Neon/Railway)
- Cloud Redis (Upstash - optional)
- Google OAuth credentials
- AI provider (Ollama on Vast.ai, OpenAI, etc.)

**Automatically:**
- Installs Vercel CLI
- Logs into Vercel
- Creates/links Vercel project
- Adds ALL environment variables to Vercel
- Runs database migrations
- Deploys to production

**Result:**
- App live on Vercel (e.g., `https://emailai-xxx.vercel.app`)
- Production environment ready
- All env vars configured

**Time:** ~20-30 minutes (including external service setup)

---

## Prerequisites

### For Local Setup
- Linux/macOS/WSL
- ~2GB disk space
- Internet connection

### For Vercel Setup
- GitHub account (for Vercel login)
- Free tier accounts on:
  - Supabase or Neon (database)
  - Upstash (Redis - optional)
  - Google Cloud (OAuth)
- Vast.ai instance with Ollama (if using Ollama)

---

## Step-by-Step: Vercel Deployment

### 1. Prepare External Services (5-10 min)

**Database - Supabase (Free):**
1. Go to https://supabase.com
2. Create new project
3. Wait 2 minutes for provisioning
4. Copy connection strings (you'll need these)

**Redis - Upstash (Free, Optional):**
1. Go to https://upstash.com
2. Create Redis database
3. Copy REST URL and token

**Google OAuth:**
1. Go to https://console.cloud.google.com
2. Enable Gmail API
3. Create OAuth credentials
4. Copy Client ID and Secret

### 2. Run Setup Script (15-20 min)

```bash
cd /path/to/emailai
bash scripts/setup.sh --vercel
```

**Follow the prompts:**
- Choose Supabase (option 1)
- Paste database URLs when asked
- Choose Upstash for Redis (option 1)
- Paste Redis credentials
- Enter Google OAuth credentials
- Choose AI provider (e.g., Ollama)
- Enter Vast.ai Ollama URL

**Script will:**
- Install Vercel CLI
- Log you into Vercel
- Create Vercel project
- Add all environment variables
- Run database migrations
- Deploy to production

### 3. Post-Deployment (2-3 min)

**Update Google OAuth:**
1. Go back to Google Cloud Console
2. Add Vercel URL to redirect URIs:
   ```
   https://emailai-xxx.vercel.app/api/auth/callback/google
   ```

**Test:**
1. Visit your Vercel URL
2. Sign in with Google
3. Connect Gmail
4. Test features

---

## Example Run: Vercel Deployment

```bash
$ bash scripts/setup.sh --vercel

╔════════════════════════════════════════╗
║   EmailAI Setup Script                 ║
║   Environment: production              ║
║   Target: vercel                       ║
╚════════════════════════════════════════╝

[*] Setting up for Vercel deployment...

[✓] Node.js: v18.20.0
[✓] Vercel CLI installed

[*] Setting up cloud database...

━━━ Database Configuration (Cloud) ━━━

Recommended options:
  1. Supabase - Free tier
  2. Neon - Free tier
  3. Railway - Pay as you go
  4. I already have a database

Choose option (1-4): 1

Database URL: postgresql://postgres:pass@db.supabase.co:5432/postgres
Direct URL: postgresql://postgres:pass@db.direct.supabase.co:5432/postgres

[✓] Database configured

[*] Setting up Redis...
Upstash REST URL: https://xxx.upstash.io
Upstash REST Token: AXX...

[✓] Redis configured

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         Environment Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Application URL: https://emailai.vercel.app
Google Client ID: xxx.apps.googleusercontent.com
Google Client Secret: ***

Choose AI provider:
  1. Ollama
  2. Groq
  3. OpenAI

Choice: 1
Ollama URL: https://vast-instance.ai:11434/api
Model: llama3.3:70b

[✓] Configuration complete

[*] Installing dependencies...
[✓] Dependencies installed

[*] Deploying to Vercel...
[*] Logging into Vercel...
> Success! GitHub authentication complete

[*] Linking to Vercel project...
? Project name: emailai
[✓] Linked to emailai

[*] Adding environment variables...
[✓] 15 environment variables added

[*] Running database migrations...
[✓] Migration complete

[*] Deploying to production...
[✓] Build completed
[✓] Deployment ready

[✓] Deployed to Vercel!

Your application is now live!

Deployment URL: https://emailai-abc123.vercel.app

Next steps:
1. Update Google OAuth redirect URI
2. Visit deployment URL
3. Sign in and test
```

---

## Troubleshooting

### "Vercel login failed"
```bash
# Try logging in manually first
npm install -g vercel
vercel login

# Then run setup again
bash scripts/setup.sh --vercel
```

### "Database connection failed"
- Verify you used the **Connection Pooling** URL for `DATABASE_URL`
- Verify you used the **Direct Connection** URL for `DIRECT_URL`
- Check database isn't paused (free tier auto-pauses)

### "Build failed on Vercel"
```bash
# Test build locally first
cd apps/web
pnpm install
pnpm build

# Fix any errors, then redeploy
vercel --prod
```

### "Can't reach Ollama on Vast.ai"
- Verify Vast.ai instance is running
- Check port 11434 is exposed
- Use full URL with `/api`: `https://instance.ai:11434/api`
- Test with curl first

---

## What Gets Deployed?

### With Local Setup:
- PostgreSQL database (local)
- Redis (optional, local)
- Next.js app (localhost:3000)
- Development environment

### With Vercel Setup:
- PostgreSQL database (Supabase/Neon)
- Redis (Upstash)
- Next.js app (Vercel edge network)
- Production environment
- SSL certificates (automatic)
- Custom domain support
- Automatic deployments from Git

---

## Cost Comparison

### Local Development
- **Cost:** $0/month (free)
- **Requires:** Your machine running
- **Best for:** Development, testing

### Vercel Deployment
- **Cost:** $0-25/month
  - Vercel: Free tier
  - Supabase: Free tier
  - Upstash: Free tier
  - Vast.ai: ~$0.30-0.80/hr (only when using AI)
- **Requires:** Cloud services
- **Best for:** Production, sharing with others

---

## Next Steps

After deployment:
1. ✅ Create automation rules
2. ✅ Set up guardrails
3. ✅ Test email features
4. ✅ Monitor usage
5. ✅ Consider custom domain
6. ✅ Set up monitoring (optional)

See full documentation: `docs/SETUP_SCRIPT_USAGE.md`
