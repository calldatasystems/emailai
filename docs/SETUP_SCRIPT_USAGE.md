# EmailAI Setup Script - Usage Guide

The `scripts/setup.sh` script now supports both local development and automated Vercel deployment.

## Usage Options

### 1. Local Development Setup (Default)

For local development on your machine:

```bash
bash scripts/setup.sh
```

**What it does:**
- ✅ Installs Node.js (if needed)
- ✅ Installs PostgreSQL locally
- ✅ Creates local database
- ✅ Prompts for configuration (Google OAuth, AI provider, etc.)
- ✅ Generates `.env.local` file
- ✅ Installs dependencies
- ✅ Runs database migrations
- ✅ Seeds database with sample data
- ✅ Sets up Git hooks

**When ready:**
```bash
npm run dev
# Open http://localhost:3000
```

---

### 2. Vercel Deployment (Automated)

For one-command Vercel deployment:

```bash
bash scripts/setup.sh --vercel
```

**What it does:**
- ✅ Installs Node.js (if needed)
- ✅ Installs Vercel CLI
- ✅ Prompts for cloud database (Supabase/Neon/Railway)
- ✅ Prompts for cloud Redis (Upstash)
- ✅ Prompts for configuration (Google OAuth, AI provider, etc.)
- ✅ Logs into Vercel
- ✅ Links/creates Vercel project
- ✅ Adds ALL environment variables to Vercel automatically
- ✅ Runs database migrations
- ✅ Deploys to production
- ✅ Returns deployment URL

**Result:**
Your app is live on Vercel with all environment variables configured!

---

### 3. Local Production Setup

For self-hosted production deployment:

```bash
bash scripts/setup.sh --production
```

**What it does:**
- Same as development but:
  - ✅ Uses `.env.production` instead of `.env.local`
  - ✅ Generates secure passwords
  - ✅ Production database name
  - ✅ Skips seeding and Git hooks

---

## Comparison: Local vs Vercel

| Feature | Local (`bash scripts/setup.sh`) | Vercel (`bash scripts/setup.sh --vercel`) |
|---------|--------------------------------|-------------------------------------------|
| **PostgreSQL** | Installs locally | Prompts for Supabase/Neon/Railway |
| **Redis** | Local or Upstash | Upstash only |
| **Environment File** | `.env.local` created | `.env.production` created |
| **Vercel Env Vars** | ❌ Not added | ✅ Automatically added |
| **Deployment** | ❌ Manual | ✅ Automatic (`vercel --prod`) |
| **Database Migrations** | ✅ Runs locally | ✅ Runs before deployment |
| **Result** | App runs on localhost:3000 | App live on Vercel URL |

---

## Detailed Vercel Deployment Flow

When you run `bash scripts/setup.sh --vercel`:

### Step 1: Prerequisites
```
Checking Node.js...
✓ Node.js: v18.x.x

Installing Vercel CLI...
✓ Vercel CLI installed
```

### Step 2: Cloud Database Setup
```
━━━ Database Configuration (Cloud) ━━━

Recommended options:
  1. Supabase (https://supabase.com) - Free tier
  2. Neon (https://neon.tech) - Free tier
  3. Railway (https://railway.app) - Pay as you go
  4. I already have a database

Choose option (1-4): 1

Setting up with Supabase:
  1. Go to https://supabase.com and create a project
  2. Wait for database to provision (~2 minutes)
  3. Go to Project Settings → Database
  4. Copy the Connection Pooling string

Press Enter when ready to continue...

Database URL (Connection Pooling): postgresql://...
Direct URL (Direct Connection): postgresql://...

✓ Database configured
```

### Step 3: Redis Setup (Optional)
```
━━━ Redis Configuration (Optional) ━━━

Options:
  1. Upstash Redis (https://upstash.com) - Free tier
  2. Skip Redis for now

Choose option (1-2): 1

Setting up with Upstash:
  1. Go to https://upstash.com and create a Redis database
  2. Choose region closest to your Vercel deployment
  3. Copy the REST URL and REST Token

Upstash REST URL: https://xxx.upstash.io
Upstash REST Token: AXX...

✓ Redis configured
```

### Step 4: Configuration Wizard
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         Environment Configuration Wizard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ Basic Configuration ━━━
Application URL: https://emailai.vercel.app

━━━ Google OAuth Setup ━━━
Google Client ID: xxx.apps.googleusercontent.com
Google Client Secret: ***

━━━ AI Provider ━━━
Choose an AI provider:
  1. Ollama (Vast.ai)
  2. Groq
  3. OpenAI
  4. Anthropic
  5. Google Gemini
  6. Skip

Choice: 1

Ollama Base URL: https://your-vast.ai:11434/api
Ollama Model: llama3.3:70b

✓ Configuration complete
```

### Step 5: Vercel Login & Link
```
Logging into Vercel...
> Success! GitHub authentication complete

Linking to Vercel project...
? Set up and deploy? Yes
? Which scope? your-account
? Link to existing project? No
? Project name: emailai
? In which directory? apps/web

✓ Linked to emailai
```

### Step 6: Environment Variables
```
Adding environment variables to Vercel...
✓ DATABASE_URL added
✓ DIRECT_URL added
✓ NEXTAUTH_URL added
✓ NEXTAUTH_SECRET added
✓ GOOGLE_CLIENT_ID added
✓ GOOGLE_CLIENT_SECRET added
✓ DEFAULT_LLM_PROVIDER added
✓ OLLAMA_BASE_URL added
✓ NEXT_PUBLIC_OLLAMA_MODEL added
✓ UPSTASH_REDIS_REST_URL added
✓ UPSTASH_REDIS_REST_TOKEN added
✓ NEXT_PUBLIC_BASE_URL added
✓ INTERNAL_API_KEY added
✓ NEXT_PUBLIC_ENABLE_ORGANIZATIONS added
✓ NEXT_PUBLIC_ENABLE_COLD_EMAIL_BLOCKER added

✓ Environment variables added to Vercel
```

### Step 7: Database Migrations
```
Running database migrations...
Applying migrations...
✓ Migration complete
```

### Step 8: Deployment
```
Deploying to production...
Building...
✓ Build completed
Deploying...
✓ Deployment ready

✓ Deployed to Vercel!

Your application is now live!

Next steps:
1. Update Google OAuth redirect URI with your Vercel URL
2. Visit your deployment URL to test
3. Sign in with Google and connect your Gmail

Deployment URL: https://emailai-xxx.vercel.app
```

---

## Environment Variables Added to Vercel

The script automatically adds these variables to Vercel:

### Required
- `DATABASE_URL` - PostgreSQL connection (pooling)
- `DIRECT_URL` - PostgreSQL direct connection
- `NEXTAUTH_URL` - Your Vercel app URL
- `NEXTAUTH_SECRET` - Auto-generated secret
- `GOOGLE_CLIENT_ID` - Gmail OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Gmail OAuth secret
- `DEFAULT_LLM_PROVIDER` - AI provider choice
- `NEXT_PUBLIC_BASE_URL` - App base URL
- `INTERNAL_API_KEY` - Auto-generated internal key

### AI Provider Specific
**If Ollama:**
- `OLLAMA_BASE_URL`
- `NEXT_PUBLIC_OLLAMA_MODEL`

**If OpenAI:**
- `OPENAI_API_KEY`

**If Anthropic:**
- `ANTHROPIC_API_KEY`

**If Groq:**
- `GROQ_API_KEY`

**If Google:**
- `GOOGLE_AI_API_KEY`

### Optional
**If Redis configured:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### Feature Flags
- `NEXT_PUBLIC_ENABLE_ORGANIZATIONS=true`
- `NEXT_PUBLIC_ENABLE_COLD_EMAIL_BLOCKER=true`
- `DISABLE_TINYBIRD=true`
- `DISABLE_POSTHOG=true`

---

## Post-Deployment Steps

### 1. Update Google OAuth Redirect URI

After deployment, you need to update your Google OAuth credentials:

1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add to Authorized redirect URIs:
   ```
   https://your-actual-vercel-url.vercel.app/api/auth/callback/google
   ```
4. Save

### 2. Test Your Deployment

1. Visit your Vercel URL
2. Click "Sign in with Google"
3. Authorize Gmail access
4. Should redirect to your inbox

### 3. Verify Ollama Connection

If using Vast.ai Ollama:
1. Go to Settings → AI Model
2. Should show "Connected to Ollama"
3. Test by creating an automation rule

---

## Troubleshooting

### Vercel CLI Not Installing

**Error**: `npm install -g vercel` fails

**Solution**:
```bash
# Install manually first
npm install -g vercel

# Then run setup
bash scripts/setup.sh --vercel
```

### Database Connection Fails

**Error**: Can't connect to Supabase/Neon

**Solution**:
1. Verify connection string is correct
2. Check database isn't paused (free tier)
3. Use **Connection Pooling** URL for `DATABASE_URL`
4. Use **Direct Connection** URL for `DIRECT_URL`

### Vercel Environment Variables Not Working

**Error**: Variables not showing in Vercel dashboard

**Solution**:
```bash
# Manually add if needed
cd apps/web
vercel env add VARIABLE_NAME production
```

### Build Fails on Vercel

**Error**: TypeScript or build errors

**Solution**:
```bash
# Test build locally first
cd apps/web
pnpm build

# Fix errors, then redeploy
vercel --prod
```

---

## Re-running the Script

If you need to reconfigure or redeploy:

```bash
# Reconfigure environment variables
bash scripts/setup.sh --vercel

# The script will:
# 1. Ask if you want to overwrite .env.production
# 2. Skip database migrations (already done)
# 3. Redeploy with updated config
```

---

## Manual Deployment (Alternative)

If you prefer manual control:

```bash
# 1. Run setup without deployment
bash scripts/setup.sh --production

# 2. Manually deploy
cd apps/web
vercel --prod

# 3. Manually add env vars via dashboard
# Go to Vercel dashboard → Settings → Environment Variables
```

---

## Cost Estimate (Vercel Deployment)

**Free Tier:**
- Vercel: $0/month (Hobby tier)
- Supabase: $0/month (500MB database)
- Upstash: $0/month (10k commands/day)
- Vast.ai: ~$0.30-0.80/hour (only when running)

**Total: $0-25/month** (mostly Vast.ai if running 24/7)

---

## Next Steps After Deployment

1. ✅ App is live on Vercel
2. Set up guardrails (Settings → Auto-Send Guardrails)
3. Create automation rules
4. Connect Gmail and test features
5. Consider custom domain (Vercel dashboard)
6. Monitor usage and costs
7. Set up alerts (optional)

The script handles everything else automatically!
