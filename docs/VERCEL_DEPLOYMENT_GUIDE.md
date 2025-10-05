# EmailAI Deployment Guide - Vercel Option

## Prerequisites

- ✅ Ollama running on Vast.ai (you have this)
- GitHub account
- Vercel account (free tier works)
- Google Cloud account (for Gmail OAuth)

## Step 1: Set Up External Services (Before Deployment)

### A. PostgreSQL Database - Choose One:

#### Option 1: Supabase (Recommended - Free Tier Available)

1. Go to https://supabase.com
2. Click "Start your project"
3. Create new project
4. Wait for database to provision (~2 minutes)
5. Go to Project Settings → Database
6. Copy **Connection Pooling** string (Transaction mode):
   ```
   postgresql://postgres.xxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
7. Save this as `DATABASE_URL`
8. Copy **Direct Connection** string:
   ```
   postgresql://postgres.xxx:password@db.xxx.supabase.co:5432/postgres
   ```
9. Save this as `DIRECT_URL`

#### Option 2: Neon (Alternative Free Tier)

1. Go to https://neon.tech
2. Sign up and create new project
3. Copy connection string
4. Use same string for both `DATABASE_URL` and `DIRECT_URL`

### B. Redis Cache - Choose One:

#### Option 1: Upstash (Recommended - Free Tier)

1. Go to https://upstash.com
2. Create account → Create Redis Database
3. Choose region closest to your Vercel deployment
4. Copy:
   - REST URL → `UPSTASH_REDIS_REST_URL`
   - REST Token → `UPSTASH_REDIS_REST_TOKEN`

#### Option 2: Skip Redis (Optional)

EmailAI can run without Redis, but performance will be reduced.

### C. Gmail OAuth Setup

1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search "Gmail API" → Enable
4. Create OAuth credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Name: "EmailAI"
   - Authorized redirect URIs:
     ```
     https://your-app.vercel.app/api/auth/callback/google
     http://localhost:3000/api/auth/callback/google
     ```
   - Click "Create"
5. Copy:
   - Client ID → `GOOGLE_CLIENT_ID`
   - Client Secret → `GOOGLE_CLIENT_SECRET`

## Step 2: Prepare Your Local Repository

```bash
# Clone the repo (if you haven't already)
cd /mnt/c/Users/aqorn/Documents/CODE/emailai

# Make sure you're on the correct branch
git status

# Push to your GitHub if not already
git remote -v  # Check your remote
git push origin rebrand-to-emailai
```

## Step 3: Deploy to Vercel

### A. Install Vercel CLI

```bash
npm i -g vercel
```

### B. Link to Vercel

```bash
cd apps/web
vercel login  # Login with GitHub/Email
vercel link   # Link to new or existing project
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? Select your account
- Link to existing project? **N** (for new deployment)
- Project name? **emailai** (or your choice)
- Directory? **apps/web** (should auto-detect)

### C. Configure Environment Variables

Create a `.env.production` file locally first to organize your variables:

```bash
# In apps/web/.env.production

# Database (from Step 1A)
DATABASE_URL="postgresql://postgres.xxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxx:password@db.xxx.supabase.co:5432/postgres"

# Redis (from Step 1B)
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXX..."

# Gmail OAuth (from Step 1C)
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

# NextAuth
NEXTAUTH_URL="https://emailai.vercel.app"  # Your Vercel URL
NEXTAUTH_SECRET="$(openssl rand -base64 32)"  # Generate random secret

# AI Provider - Ollama on Vast.ai
DEFAULT_LLM_PROVIDER="ollama"
OLLAMA_BASE_URL="https://your-vast-instance.vast.ai:11434/api"
NEXT_PUBLIC_OLLAMA_MODEL="llama3.3:70b"

# App Settings
NEXT_PUBLIC_BASE_URL="https://emailai.vercel.app"
NEXT_PUBLIC_CALL_BASE_URL="https://emailai.vercel.app"

# Internal API (generate random key)
INTERNAL_API_KEY="$(openssl rand -base64 32)"

# Optional: Disable features you don't need
DISABLE_TINYBIRD="true"
DISABLE_POSTHOG="true"
```

### D. Add Environment Variables to Vercel

**Option 1: Via CLI (Recommended)**

```bash
# Add each variable from your .env.production
vercel env add DATABASE_URL production
# Paste the value when prompted

vercel env add DIRECT_URL production
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add DEFAULT_LLM_PROVIDER production
vercel env add OLLAMA_BASE_URL production
vercel env add NEXT_PUBLIC_OLLAMA_MODEL production
vercel env add NEXT_PUBLIC_BASE_URL production
vercel env add NEXT_PUBLIC_CALL_BASE_URL production
vercel env add INTERNAL_API_KEY production
```

**Option 2: Via Vercel Dashboard**

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable from `.env.production`
5. Make sure to select "Production" environment

## Step 4: Run Database Migrations

Before deploying, set up the database schema:

```bash
# Set your DATABASE_URL temporarily for migration
export DIRECT_URL="postgresql://postgres.xxx:password@db.xxx.supabase.co:5432/postgres"

# Run migrations
cd apps/web
npx prisma migrate deploy

# Verify tables were created
npx prisma studio  # Opens GUI to view database
```

## Step 5: Deploy

```bash
# From apps/web directory
vercel --prod
```

This will:
1. Build your application
2. Upload to Vercel
3. Deploy to production URL
4. Return deployment URL (e.g., `https://emailai.vercel.app`)

## Step 6: Update OAuth Redirect URL

1. Go back to Google Cloud Console
2. Edit OAuth credentials
3. Update redirect URI with your actual Vercel URL:
   ```
   https://emailai-xxx.vercel.app/api/auth/callback/google
   ```
4. Save

## Step 7: Verify Deployment

### A. Check Deployment Status

```bash
# View deployment logs
vercel logs https://emailai-xxx.vercel.app
```

### B. Test the Application

1. Visit your Vercel URL: `https://emailai-xxx.vercel.app`
2. You should see the landing page
3. Click "Sign in with Google"
4. Authorize Gmail access
5. Should redirect to your inbox

### C. Test Ollama Connection

Check Vercel can reach your Vast.ai Ollama:

1. Go to Settings in your deployed app
2. Look for AI Model section
3. Should show "Connected to Ollama"
4. If errors, check Vercel logs:
   ```bash
   vercel logs --follow
   ```

## Step 8: Set Up Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `emailai.yourdomain.com`)
3. Update DNS records as instructed by Vercel
4. Wait for DNS propagation (~5-10 minutes)
5. Update environment variables:
   ```bash
   vercel env add NEXTAUTH_URL production
   # Value: https://emailai.yourdomain.com

   vercel env add NEXT_PUBLIC_BASE_URL production
   # Value: https://emailai.yourdomain.com
   ```
6. Redeploy: `vercel --prod`
7. Update Google OAuth redirect URI with new domain

## Troubleshooting

### Build Fails on Vercel

**Error**: `Module not found` or TypeScript errors

**Solution**:
```bash
# Test build locally first
cd apps/web
pnpm build

# Fix any errors, then deploy again
vercel --prod
```

### Database Connection Fails

**Error**: `Can't reach database server`

**Solution**:
1. Verify `DATABASE_URL` is correct (use pooling URL for Supabase)
2. Check Supabase/Neon isn't paused (free tier auto-pauses)
3. Ensure IP isn't blocked (Vercel IPs should be allowed by default)
4. Test connection:
   ```bash
   npx prisma db pull
   ```

### OAuth Redirect Mismatch

**Error**: `redirect_uri_mismatch`

**Solution**:
1. Check `NEXTAUTH_URL` matches your actual Vercel URL
2. Verify Google OAuth has exact redirect URI:
   ```
   https://your-actual-url.vercel.app/api/auth/callback/google
   ```
3. No trailing slashes
4. HTTPS (not HTTP)

### Can't Connect to Ollama on Vast.ai

**Error**: `ECONNREFUSED` or `ETIMEDOUT`

**Solution**:
1. Verify Vast.ai instance is running
2. Check port 11434 is exposed
3. Use public URL (not localhost)
4. Test from Vercel:
   ```bash
   # Add test endpoint temporarily
   # Then check logs
   vercel logs --follow
   ```
5. Verify `OLLAMA_BASE_URL` includes `/api`:
   ```
   https://vast-instance.com:11434/api  ✅
   https://vast-instance.com:11434      ❌
   ```

### Redis Connection Issues

**Error**: `Redis connection failed`

**Solution**:
1. Verify Upstash URL and token are correct
2. Check Upstash region matches Vercel region
3. EmailAI can run without Redis if needed:
   ```bash
   # Remove Redis env vars to disable
   vercel env rm UPSTASH_REDIS_REST_URL production
   vercel env rm UPSTASH_REDIS_REST_TOKEN production
   ```

### Prisma Client Issues

**Error**: `PrismaClient is unable to be run in the browser`

**Solution**:
```bash
# Regenerate Prisma client
cd apps/web
npx prisma generate

# Rebuild and deploy
vercel --prod
```

## Post-Deployment Checklist

- [ ] App loads at Vercel URL
- [ ] Can sign in with Google
- [ ] Gmail OAuth works
- [ ] Can view inbox
- [ ] AI features work (test with automation rule)
- [ ] Guardrails feature accessible in settings
- [ ] No errors in Vercel logs

## Monitoring

### View Logs

```bash
# Real-time logs
vercel logs --follow

# Last 100 logs
vercel logs
```

### Check Performance

1. Vercel Dashboard → Analytics
2. Monitor response times
3. Check error rates
4. Review function durations

## Updating After Changes

```bash
# Make changes to code
git add .
git commit -m "Update feature"
git push

# Deploy to Vercel
cd apps/web
vercel --prod
```

Vercel also supports automatic deployments:
1. Connect GitHub repo in Vercel Dashboard
2. Every push to main branch auto-deploys
3. PRs get preview deployments

## Cost Summary

**Free Tier:**
- Vercel: Free (Hobby tier)
- Supabase: Free (up to 500MB database)
- Upstash: Free (10,000 commands/day)
- Vast.ai: ~$0.30-0.80/hour (only while running)
- Google Cloud: Free (Gmail API)

**Estimated Monthly Cost:** $0-25 (mostly Vast.ai GPU usage)

**Production Tier:**
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Upstash: $10/month
- Vast.ai: $200-600/month (if running 24/7)

**Estimated Monthly Cost:** $255-655

## Alternative: Vercel + Local Ollama

If you want to reduce costs, run Ollama locally instead of Vast.ai:

1. Install Ollama on your local machine/server
2. Expose via ngrok or Cloudflare Tunnel:
   ```bash
   # With ngrok
   ngrok http 11434

   # Use ngrok URL as OLLAMA_BASE_URL
   https://abc123.ngrok.io/api
   ```
3. Update `OLLAMA_BASE_URL` in Vercel env vars
4. Keep your machine running for AI features

## Next Steps

1. ✅ Deploy to Vercel
2. Test all features with your Gmail account
3. Set up guardrails (Settings → Auto-Send Guardrails)
4. Create automation rules
5. Monitor usage and costs
6. Consider custom domain
7. Set up monitoring/alerts

Need help with any specific step? Let me know!
