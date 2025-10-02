# EmailAI - Quick Start Guide 🚀

Get EmailAI running in under 5 minutes with our lazy setup script!

## One-Command Setup

### Linux / macOS / WSL

```bash
# Clone the repository
git clone https://github.com/calldatasystems/emailai.git
cd emailai

# Run the setup script (installs everything automatically)
bash scripts/setup.sh
```

### Windows (PowerShell)

```powershell
# Clone the repository
git clone https://github.com/calldatasystems/emailai.git
cd emailai

# Run the setup script
.\scripts\setup.ps1
```

That's it! The script will **interactively guide you** through:
- ✅ Install Node.js 18+ (if needed)
- ✅ Install PostgreSQL (if needed)
- ✅ Create the database
- ✅ **Ask for credentials** (Google OAuth, Stripe, etc.) with helpful explanations
- ✅ Generate environment variables with sensible defaults
- ✅ Install npm dependencies
- ✅ Run database migrations
- ✅ Set up Git hooks
- ✅ Verify the setup

**The script is fully interactive!** It will:
- Explain what each credential is used for
- Provide direct links to get credentials
- Offer sensible defaults for all values
- Let you skip optional services
- Work idempotently (safe to run multiple times)

## What the Script Does

The setup script is **idempotent** - you can run it multiple times safely. It will:

1. **Check Prerequisites**
   - Node.js 18+ (installs via nvm if missing)
   - PostgreSQL 14+ (prompts for installation if missing)

2. **Setup Database**
   - Creates database (`emailai_dev`)
   - Creates database user
   - Enables required PostgreSQL extensions

3. **Configure Environment**
   - Generates `.env.local` with secure secrets
   - Sets up database connection
   - Creates NEXTAUTH_SECRET

4. **Install Dependencies**
   - Runs `npm install`
   - Installs all packages from monorepo

5. **Run Migrations**
   - Generates Prisma Client
   - Runs all database migrations
   - Sets up schema

6. **Verify Setup**
   - Checks all components are working
   - Reports any issues

## After Setup

The setup wizard will guide you through all configuration interactively!

### Interactive Configuration Wizard

When you run the setup script, it will walk you through:

**1. Google OAuth (Required)**
- The wizard explains why it's needed
- Provides step-by-step instructions
- Shows you the exact redirect URI to use
- Lets you enter credentials or skip for later

**2. Payment Provider (Optional)**
- Choose between Stripe, LemonSqueezy, or skip
- Direct links to get API keys
- Webhook setup instructions

**3. Email Service (Optional)**
- Configure Resend for transactional emails
- Or skip and configure later

**4. Monitoring (Optional)**
- Sentry for error tracking
- PostHog for analytics
- Both with helpful signup links

**All with sensible defaults!** Just press Enter to use defaults, or enter your own values.

### If You Skipped OAuth Setup

The app won't work without Google OAuth. To add it after setup:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials (Web application type)
3. Add redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Update `apps/web/.env.local` with your credentials
5. Restart the dev server

### 2. Start the Development Server

```bash
npm run dev
```

The app will be available at: **http://localhost:3000**

### 3. Create Your First Account

1. Open http://localhost:3000
2. Click "Sign in with Google"
3. Authorize the application
4. You're in! 🎉

## Optional Configuration

### Payment Provider (Stripe or LemonSqueezy)

For billing features, configure one of:

**Stripe:**
```bash
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

**LemonSqueezy:**
```bash
LEMON_SQUEEZY_API_KEY="..."
LEMON_SQUEEZY_WEBHOOK_SECRET="..."
LEMON_SQUEEZY_STORE_ID="..."
```

### Email Service (Resend)

For sending emails:
```bash
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### Monitoring (Optional)

**Sentry (Error Tracking):**
```bash
SENTRY_DSN="https://xxx@sentry.io/xxx"
```

**PostHog (Analytics):**
```bash
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"
```

## Troubleshooting

### Setup script fails on PostgreSQL

**Option 1: Manual Installation**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
- Download installer: https://www.postgresql.org/download/windows/
- Or use Docker: `docker run -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:15`

**Option 2: Use Docker**
```bash
docker-compose up -d db
```

Then re-run the setup script.

### Node.js version too old

Install Node.js 18+ using nvm:

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 18
nvm install 18
nvm use 18
```

### Database connection fails

Check PostgreSQL is running:

```bash
# Linux
sudo systemctl status postgresql

# macOS
brew services list

# All platforms
psql -U postgres -c "SELECT 1"
```

If not running, start it:

```bash
# Linux
sudo systemctl start postgresql

# macOS
brew services start postgresql@15
```

### OAuth redirect URI mismatch

Make sure your Google Cloud Console redirect URI **exactly** matches:
```
http://localhost:3000/api/auth/callback/google
```

Note: No trailing slash!

### Port 3000 already in use

Find and kill the process using port 3000:

```bash
# Linux/macOS
lsof -ti:3000 | xargs kill -9

# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
```

Or change the port in `package.json`:
```json
"dev": "next dev -p 3001"
```

## Manual Setup (Without Script)

If you prefer to set up manually:

### 1. Install Prerequisites

- Node.js 18+: https://nodejs.org/
- PostgreSQL 14+: https://www.postgresql.org/download/

### 2. Create Database

```bash
createdb emailai_dev
psql emailai_dev -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql emailai_dev -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"
```

### 3. Configure Environment

Create `apps/web/.env.local`:

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/emailai_dev"
DIRECT_URL="postgresql://postgres:password@localhost:5432/emailai_dev"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
NODE_ENV="development"
NEXT_PUBLIC_ENABLE_ORGANIZATIONS="true"
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Migrations

```bash
cd apps/web
npx prisma migrate dev
cd ../..
```

### 6. Start Development Server

```bash
npm run dev
```

## Production Deployment

EmailAI uses a modern production architecture with calldata.app domain structure:

```
Production Stack:
- Vercel: Web application (emailai.calldata.app)
- Neon/Supabase: PostgreSQL database
- Upstash: Redis cache
- Vast.ai: Ollama AI server (ai.calldata.app)
- Cloudflare: DNS and CDN
```

### Automated Production Deployment

Use our automated deployment scripts for one-command production setup:

```bash
# Step 1: Collect all configuration (interactive)
bash scripts/deploy-config.sh

# This will ask for:
# - Domain configuration (calldata.app)
# - Vercel account details
# - Database credentials (Neon/Supabase/AWS RDS)
# - Redis credentials (Upstash/ElastiCache)
# - AI server setup (Vast.ai/Self-hosted/AWS EC2)
# - Google OAuth credentials
# - Optional services (Sentry, PostHog, etc.)

# Step 2: Deploy everything automatically
bash scripts/deploy.sh

# Done! Access at https://emailai.calldata.app
```

**What the deployment scripts do:**
- ✅ Provision cloud resources (if using AWS)
- ✅ Run database migrations
- ✅ Build and deploy to Vercel
- ✅ Configure custom domains
- ✅ Setup DNS records (Cloudflare/Route 53)
- ✅ Upload environment variables
- ✅ Verify deployment

**Cost estimates:**
- **Free tier**: $0-84/month (Vercel Free + Neon Free + Upstash Free + Vast.ai GPU)
- **Production**: $300-500/month (Vercel Pro + paid database/Redis + 24/7 GPU)
- **Enterprise**: $1000+/month (AWS-hosted everything)

### Manual Production Deployment

If you prefer manual deployment:

**Vercel Deployment:**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod

# Add custom domain
vercel domains add emailai.calldata.app
```

**AWS Deployment:**
See [docs/DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md](docs/DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md) for complete AWS deployment guide.

**Important Docs:**
- **Deployment Scripts**: See [scripts/README.md](scripts/README.md) for detailed script usage
- **Domain Setup**: See [docs/DOMAIN_CONFIGURATION_GUIDE.md](docs/DOMAIN_CONFIGURATION_GUIDE.md) for DNS configuration
- **Deployment Comparison**: See [docs/DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md](docs/DEPLOYMENT_COMPARISON_AWS_VS_VERCEL.md) for Vercel vs AWS comparison
- **Domain Structure**: See [docs/DOMAIN_STRUCTURE.md](docs/DOMAIN_STRUCTURE.md) for calldata.app architecture

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:migrate       # Create new migration
npm run db:reset         # Reset database (WARNING: deletes all data)
npm run db:seed          # Seed with sample data

# Code Quality
npm run lint             # Lint code
npm run lint:fix         # Fix lint errors
npm run type-check       # Check TypeScript types
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode

# Migration Scripts
npm run migrate:multi-tenant  # Run multi-tenant migration
npm run rollback:multi-tenant # Rollback multi-tenant migration
```

## Project Structure

```
emailai/
├── apps/
│   ├── web/                    # Main Next.js application
│   │   ├── app/               # App router pages
│   │   ├── components/        # React components
│   │   ├── utils/             # Utility functions
│   │   ├── prisma/            # Database schema and migrations
│   │   └── .env.local         # Environment variables (gitignored)
│   ├── mcp-server/            # MCP server (optional)
│   └── unsubscriber/          # Unsubscriber CLI (optional)
├── packages/                   # Shared packages
├── docs/                      # Documentation
│   ├── USER_GUIDE_ORGANIZATIONS.md
│   ├── ADMIN_GUIDE.md
│   ├── API_DOCUMENTATION.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── MONITORING_SETUP.md
├── scripts/                   # Utility scripts
│   ├── setup.sh              # Linux/macOS setup
│   ├── setup.ps1             # Windows setup
│   └── migrate-to-multi-tenant-complete.ts
└── QUICK_START.md            # This file
```

## Next Steps

- **User Guide**: Read [docs/USER_GUIDE_ORGANIZATIONS.md](docs/USER_GUIDE_ORGANIZATIONS.md)
- **Admin Guide**: Read [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) for advanced features
- **API Docs**: Check [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for API integration
- **Deploy**: See [docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for production deployment

## Getting Help

- **GitHub Issues**: https://github.com/calldatasystems/emailai/issues
- **Documentation**: https://docs.emailai.com
- **Community**: https://community.emailai.com
- **Email Support**: support@emailai.com

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

**Happy Coding! 🚀**

If the setup script worked for you, please star the repo on GitHub! ⭐
