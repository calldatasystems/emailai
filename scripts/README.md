# Deployment Scripts

Automated deployment scripts for EmailAI to production using the calldata.app domain structure.

## Overview

These scripts automate the entire deployment process:

1. **`deploy-config.sh`** - Interactive configuration collector
2. **`deploy.sh`** - Automated deployment executor

## Architecture

```
Production Stack:
├── Vercel: Web application (emailai.calldata.app)
├── Neon/Supabase: PostgreSQL database
├── Upstash: Redis cache
├── Vast.ai/AWS EC2: Ollama AI server (ai.calldata.app)
└── Cloudflare: DNS and CDN
```

---

## Quick Start

### Step 1: Collect Configuration

```bash
bash scripts/deploy-config.sh
```

This will interactively collect:
- Domain configuration (calldata.app)
- Vercel account details
- Database credentials (Neon/Supabase/AWS RDS)
- Redis credentials (Upstash/ElastiCache)
- AI server configuration (Vast.ai/Self-hosted/AWS EC2)
- Google OAuth credentials
- Optional services (Sentry, PostHog, etc.)

**Output files:**
- `deployment.config` - Deployment configuration
- `apps/web/.env.production` - Environment variables for production

### Step 2: Run Deployment

```bash
bash scripts/deploy.sh
```

This will automatically:
- ✅ Provision AWS resources (if configured)
- ✅ Run database migrations
- ✅ Build the application
- ✅ Deploy to Vercel
- ✅ Configure custom domain
- ✅ Setup DNS records (if configured)
- ✅ Verify deployment

**Output files:**
- `deployment.log` - Detailed deployment log
- `deployment-info.txt` - Deployment summary

---

## Prerequisites

### Required Tools

```bash
# Vercel CLI
npm install -g vercel

# AWS CLI (if using AWS services)
# macOS:
brew install awscli

# Linux:
sudo apt install awscli

# jq (JSON processor)
# macOS:
brew install jq

# Linux:
sudo apt install jq
```

### Required Accounts

1. **Vercel** - https://vercel.com (Free tier available)
2. **Database** (choose one):
   - Neon - https://neon.tech (Free tier: 0.5GB)
   - Supabase - https://supabase.com (Free tier: 0.5GB)
   - AWS RDS (Paid, ~$15-30/month)

3. **Redis** (choose one):
   - Upstash - https://upstash.com (Free tier: 10k requests/day)
   - AWS ElastiCache (Paid, ~$12-25/month)

4. **AI Server** (choose one):
   - Vast.ai - https://vast.ai (Pay-as-you-go, ~$84-250/month)
   - Self-hosted (Your own GPU server)
   - AWS EC2 with GPU (Paid, ~$350-3000/month)

5. **DNS** (choose one):
   - Cloudflare - https://cloudflare.com (Free)
   - AWS Route 53 (Paid, ~$0.50-1/month)
   - Your existing DNS provider

6. **Google Cloud** - https://console.cloud.google.com
   - OAuth credentials for Gmail integration
   - PubSub (optional, for real-time updates)

---

## Configuration Script Details

### `deploy-config.sh`

**Interactive prompts:**

1. **Domain Configuration**
   - Root domain (default: calldata.app)
   - Product subdomain (default: emailai)
   - Generates: emailai.calldata.app, api.calldata.app, ai.calldata.app

2. **Vercel Configuration**
   - Vercel login check
   - Project name
   - Organization/team (optional)

3. **Database Configuration**
   - Provider selection (Neon/Supabase/AWS RDS/Custom)
   - Connection string
   - If AWS RDS: instance class, credentials

4. **Redis Configuration**
   - Provider selection (Upstash/ElastiCache/Custom)
   - Connection details
   - If ElastiCache: node type

5. **AI Server Configuration**
   - Provider selection (Vast.ai/Self-hosted/AWS EC2)
   - IP/hostname or create new EC2 instance
   - Model selection (default: llama3.3:70b)

6. **Google OAuth**
   - Client ID and Secret
   - Auto-generates encryption keys

7. **Google PubSub** (Optional)
   - Topic name
   - Auto-generates verification token

8. **Security Secrets**
   - Auto-generates:
     - NEXTAUTH_SECRET
     - INTERNAL_API_KEY
     - API_KEY_SALT

9. **Optional Services**
   - Sentry (error tracking)
   - PostHog (analytics)
   - Axiom (logging)
   - Resend (transactional emails)
   - Loops (marketing emails)

10. **DNS Configuration**
    - Provider selection (Cloudflare/Route 53/Other)
    - API credentials for auto-configuration

**Generated files:**
```
deployment.config              # Deployment settings
apps/web/.env.production       # Production environment variables
```

---

## Deployment Script Details

### `deploy.sh`

**Execution steps:**

1. **Pre-flight Checks**
   - Load configuration
   - Verify required tools
   - Check authentication (Vercel, AWS)

2. **Database Provisioning** (if AWS RDS)
   - Create RDS instance
   - Wait for availability
   - Get endpoint
   - Update environment variables

3. **Redis Provisioning** (if AWS ElastiCache)
   - Create ElastiCache cluster
   - Wait for availability
   - Get endpoint
   - Update environment variables

4. **AI Server Provisioning** (if AWS EC2)
   - Launch GPU instance
   - Get public IP
   - Update environment variables
   - Print setup instructions

5. **Build Application**
   - Install dependencies (`pnpm install`)
   - Run database migrations (`pnpm prisma migrate deploy`)
   - Build application (`pnpm run build`)

6. **Deploy to Vercel**
   - Upload environment variables
   - Deploy application
   - Get deployment URL

7. **Configure Custom Domain**
   - Add domain to Vercel project
   - Verify domain

8. **Configure DNS**
   - Cloudflare: Create CNAME record via API
   - Route 53: Create CNAME record via AWS CLI
   - Other: Print manual instructions

9. **Verify Deployment**
   - Test deployment URL
   - Test custom domain
   - Check HTTP status codes

10. **Post-Deployment**
    - Print summary
    - List pending tasks
    - Save deployment info

**Generated files:**
```
deployment.log                 # Detailed deployment log
deployment-info.txt            # Deployment summary
```

---

## Usage Examples

### Example 1: Full Automated Deployment

Using Neon (database), Upstash (Redis), Vast.ai (AI), Cloudflare (DNS):

```bash
# Step 1: Configure
bash scripts/deploy-config.sh

# Answer prompts:
# - Domain: calldata.app
# - Product: emailai
# - Vercel: login and select org
# - Database: (1) Neon → paste connection string
# - Redis: (1) Upstash → paste URL and token
# - AI: (1) Vast.ai → enter IP and port
# - Google OAuth: paste client ID and secret
# - DNS: (1) Cloudflare → paste API token and zone ID

# Step 2: Deploy
bash scripts/deploy.sh

# Wait for completion (~5-10 minutes)
# Access: https://emailai.calldata.app
```

### Example 2: AWS-Heavy Deployment

Using AWS RDS, ElastiCache, EC2 GPU:

```bash
# Step 1: Configure
bash scripts/deploy-config.sh

# Select AWS options:
# - Database: (3) AWS RDS → create new
# - Redis: (2) AWS ElastiCache → create new
# - AI: (3) AWS EC2 → create new

# Step 2: Deploy
bash scripts/deploy.sh

# Script will:
# - Create RDS instance (~10 min)
# - Create ElastiCache cluster (~5 min)
# - Launch EC2 GPU instance (~2 min)
# - Deploy to Vercel (~2 min)
# Total: ~20 minutes
```

### Example 3: Minimal Free Tier

Using all free tiers:

```bash
# Providers:
# - Vercel: Free tier
# - Neon: Free tier (0.5GB database)
# - Upstash: Free tier (10k requests/day)
# - Vast.ai: Pay-as-you-go (~$0.35/hour)
# - Cloudflare: Free

# Total cost: ~$84/month (8h/day Vast.ai usage)

bash scripts/deploy-config.sh
# Select option 1 for all providers

bash scripts/deploy.sh
```

---

## Manual Steps

### Before Running Scripts

1. **Register domain** (calldata.app)
2. **Create Vercel account**: https://vercel.com
3. **Create database**: Neon/Supabase account
4. **Create Redis**: Upstash account
5. **Setup Google OAuth**:
   - Go to https://console.cloud.google.com/apis/credentials
   - Create OAuth 2.0 Client ID
   - Add redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://emailai.calldata.app/api/auth/callback/google`

### After Running Scripts

1. **Setup AI server** (if Vast.ai or EC2):
   ```bash
   ssh root@INSTANCE_IP
   git clone https://github.com/your-org/emailai.git
   cd emailai/ollama-server/scripts
   sudo bash setup.sh prod
   ```

2. **Verify DNS propagation**:
   ```bash
   dig emailai.calldata.app
   # Should return CNAME to vercel
   ```

3. **Test application**:
   ```bash
   curl https://emailai.calldata.app
   # Should return 200 OK
   ```

4. **Test Gmail OAuth flow**:
   - Visit https://emailai.calldata.app
   - Click "Sign in with Google"
   - Authorize Gmail access
   - Should redirect back to app

---

## Troubleshooting

### Configuration Script Issues

**"Missing required tools"**
```bash
# Install missing tools
npm install -g vercel
brew install awscli jq  # macOS
sudo apt install awscli jq  # Linux
```

**"Not logged in to Vercel"**
```bash
vercel login
# Follow browser authentication
```

**"AWS credentials not configured"**
```bash
aws configure
# Enter: Access Key ID, Secret Access Key, Region
```

### Deployment Script Issues

**"Configuration file not found"**
```bash
# Run config script first
bash scripts/deploy-config.sh
```

**"Database migration failed"**
```bash
# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Or run migrations manually
pnpm prisma migrate deploy
```

**"Vercel deployment failed"**
```bash
# Check logs
vercel logs

# Try manual deployment
vercel --prod
```

**"DNS not resolving"**
```bash
# Check DNS records
dig emailai.calldata.app

# Wait for propagation (up to 48 hours)
# Or use Cloudflare proxy (instant)
```

**"Custom domain not accessible"**
```bash
# Verify domain added in Vercel
vercel domains ls

# Check DNS CNAME record
dig emailai.calldata.app CNAME

# Should point to: cname.vercel-dns.com
```

---

## File Structure

```
scripts/
├── deploy-config.sh           # Configuration collector
├── deploy.sh                  # Deployment executor
└── README.md                  # This file

Generated files:
├── deployment.config          # Deployment configuration
├── apps/web/.env.production   # Production environment variables
├── deployment.log             # Deployment log
└── deployment-info.txt        # Deployment summary
```

---

## Environment Variables Reference

All environment variables are configured in `apps/web/.env.production`:

### Required

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Auth
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://emailai.calldata.app"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_ENCRYPT_SECRET="..."
GOOGLE_ENCRYPT_SALT="..."

# Redis
UPSTASH_REDIS_URL="..."
UPSTASH_REDIS_TOKEN="..."

# AI
OLLAMA_BASE_URL="https://ai.calldata.app/api"
NEXT_PUBLIC_OLLAMA_MODEL="llama3.3:70b"
DEFAULT_LLM_PROVIDER="ollama"

# Security
INTERNAL_API_KEY="..."
API_KEY_SALT="..."
```

### Optional

```bash
# Google PubSub
GOOGLE_PUBSUB_TOPIC_NAME="..."
GOOGLE_PUBSUB_VERIFICATION_TOKEN="..."

# Monitoring
NEXT_PUBLIC_SENTRY_DSN="..."
NEXT_PUBLIC_POSTHOG_KEY="..."
NEXT_PUBLIC_AXIOM_DATASET="..."
NEXT_PUBLIC_AXIOM_TOKEN="..."

# Email
RESEND_API_KEY="..."
LOOPS_API_SECRET="..."
```

---

## Security Best Practices

1. **Never commit secrets**:
   ```bash
   # Files are gitignored:
   deployment.config
   apps/web/.env.production
   deployment.log
   ```

2. **Rotate secrets regularly**:
   ```bash
   # Regenerate secrets
   openssl rand -hex 32  # For NEXTAUTH_SECRET
   openssl rand -hex 16  # For salts
   ```

3. **Use environment-specific credentials**:
   - Development: `.env.local`
   - Production: `.env.production`
   - Never mix environments

4. **Limit API access**:
   - Vercel: Use environment-specific tokens
   - AWS: Use least-privilege IAM roles
   - Cloudflare: Limit API token scope

---

## Cost Estimates

### Recommended Stack (Vercel + Neon + Upstash + Vast.ai)

```
Vercel (Free tier):              $0/month
Neon PostgreSQL (Free tier):     $0/month
Upstash Redis (Free tier):       $0/month
Vast.ai GPU (8h/day):            $84/month
-------------------------------------------
Total:                           $84/month
```

### Production Stack (Medium scale)

```
Vercel Pro:                      $20/month
Neon PostgreSQL (Pro):           $19/month
Upstash Redis (Pay-as-go):       $20/month
Vast.ai GPU (24/7):              $250/month
-------------------------------------------
Total:                           $309/month
```

### AWS-Heavy Stack (Enterprise)

```
Vercel Enterprise:               $500+/month
AWS RDS (r5.large, Multi-AZ):    $300+/month
AWS ElastiCache (r5.large):      $200+/month
AWS EC2 (p3.2xlarge GPU):        $3000+/month
-------------------------------------------
Total:                           $4000+/month
```

---

## Next Steps After Deployment

1. **Test all features**:
   - Gmail OAuth flow
   - Email automation rules
   - AI responses
   - Bulk unsubscribe

2. **Setup monitoring**:
   - Configure Sentry for errors
   - Setup PostHog for analytics
   - Enable Vercel Analytics

3. **Configure status page**:
   - Setup BetterUptime
   - Point status.calldata.app to status page

4. **Setup backups**:
   - Database: Automated backups (RDS/Neon/Supabase)
   - Files: Vercel automatic backups

5. **Performance optimization**:
   - Enable Vercel Edge caching
   - Configure Cloudflare caching rules
   - Optimize database queries

---

## Support

**Issues with scripts:**
- Check logs: `cat deployment.log`
- Check configuration: `cat deployment.config`
- Check environment: `cat apps/web/.env.production`

**Need help?**
- See main [README.md](../README.md)
- See [DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md](../docs/DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md)
- See [DOMAIN_CONFIGURATION_GUIDE.md](../docs/DOMAIN_CONFIGURATION_GUIDE.md)

---

**Ready to deploy?** Run: `bash scripts/deploy-config.sh` 🚀
