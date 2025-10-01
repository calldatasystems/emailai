<p align="center">
  <a href="https://www.emailai.com">
    <h1 align="center">EmailAI - Your AI Email Assistant</h1>
  </a>
  <p align="center">
    AI email assistant to automate and manage email inboxes.
  </p>
</p>

## Features

### Core Features
- **AI Personal Assistant** - Manages your email based on plain text prompts. Takes any action a human assistant can (Draft, Reply, Archive, Label, Forward, Mark Spam, Call Webhooks)
- **Reply Tracker** - Track emails that need your reply and those awaiting responses
- **Smart Categories** - Automatically categorize everyone that's ever emailed you
- **Bulk Unsubscriber** - Quickly unsubscribe from emails you never read in one-click
- **Cold Email Blocker** - Automatically block cold emails
- **Email Analytics** - Track your email activity with daily, weekly, and monthly stats
- **Multi-Tenant Organizations** - Team collaboration, shared email accounts, role-based access control, seat-based billing

### AI Features
- **Multiple AI Models** - OpenAI, Anthropic, Google Gemini, Groq, or local Ollama
- **Local AI Deployment** - Run Llama 3.1/3.3 models on your own hardware (no cloud costs, 100% private)
- **Fine-Tuned Models** - Train custom models on each user's email history to write in their unique voice
- **AI Automation** - Create rules from natural language, auto-categorize, smart replies with knowledge base
- **Writing Style Learning** - AI learns your tone, formality, and communication patterns

📖 [Full AI Features Documentation](./AI_FEATURES_OVERVIEW.md)

---

## Quick Start

### 1. Deploy EmailAI Application

**One-command setup:**
```bash
git clone https://github.com/your-org/emailai.git
cd emailai
bash scripts/setup.sh  # Interactive setup wizard
```

**Or manual setup:**
```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp apps/web/.env.example apps/web/.env

# 3. Configure .env (see Configuration section below)
# Set: NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, etc.

# 4. Start database
docker-compose up -d

# 5. Run migrations
pnpm prisma migrate dev

# 6. Start application
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000)

📖 [Detailed Setup Guide](./QUICK_START.md)

---

### 2. Deploy Local AI (Optional but Recommended)

**For cost savings and privacy, deploy Ollama on separate server:**

```bash
# On your AI server (or Vast.ai GPU instance)
cd ollama-server/scripts
sudo bash setup.sh prod  # Installs Ollama + Llama 3.3 70B

# Configure EmailAI to use it (.env):
# OLLAMA_BASE_URL=http://your-ollama-server:11434/api
# NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
# DEFAULT_LLM_PROVIDER=ollama
```

📖 [Ollama Deployment Guide](./ollama-server/README.md)
📖 [Vast.ai GPU Rental Guide](./ollama-server/docs/VASTAI_DEPLOYMENT.md)

**Cost comparison:**
- **Local Ollama on Vast.ai**: ~$84/month (8h/day) or ~$150/month (24/7)
- **OpenAI/Anthropic APIs**: ~$300-500/month for moderate usage
- **Self-hosted on existing hardware**: $0/month

---

### 3. Fine-Tune for User Voice (Optional - Premium Feature)

**Train AI to write emails in each user's unique style:**

```bash
cd ollama-server/fine-tuning

# 1. Extract training data from user's sent emails
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data

# 2. Fine-tune model (2-4 hours on Vast.ai RTX 4090, ~$1-2 cost)
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml

# 3. Deploy to Ollama
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id "user123"

# 4. Configure EmailAI to use it
# NEXT_PUBLIC_OLLAMA_MODEL=emailai-user123
```

**Before fine-tuning:**
> Dear Team, I am writing to provide an update on the project status...

**After fine-tuning:**
> Hey team! Quick update - we finished design yesterday and starting dev next week. Pretty excited! 🚀

📖 [Fine-Tuning Guide](./ollama-server/fine-tuning/README.md)
📖 [Complete Workflow](./ollama-server/fine-tuning/docs/FINE_TUNING_GUIDE.md)

---

## Configuration

### Required Environment Variables

**Create `apps/web/.env` with:**

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/emailai"
DIRECT_URL="postgresql://postgres:password@localhost:5432/emailai"

# Auth (generate with: openssl rand -hex 32)
NEXTAUTH_SECRET="your-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_ENCRYPT_SECRET="your-encrypt-secret"  # openssl rand -hex 32
GOOGLE_ENCRYPT_SALT="your-encrypt-salt"      # openssl rand -hex 16

# Google PubSub (for real-time email updates)
GOOGLE_PUBSUB_TOPIC_NAME="projects/abc/topics/xyz"
GOOGLE_PUBSUB_VERIFICATION_TOKEN="your-token"

# AI Provider (choose one or use local Ollama)
DEFAULT_LLM_PROVIDER=ollama  # or: openai, anthropic, google, groq

# Option 1: Local Ollama (recommended for cost/privacy)
OLLAMA_BASE_URL=http://localhost:11434/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b

# Option 2: Cloud API (Groq is fastest/cheapest)
# GROQ_API_KEY=your-groq-api-key

# Option 3: OpenAI
# OPENAI_API_KEY=your-openai-api-key

# Option 4: Anthropic
# ANTHROPIC_API_KEY=your-anthropic-api-key

# Redis
UPSTASH_REDIS_URL="http://localhost:8079"
UPSTASH_REDIS_TOKEN="your-token"

# Internal
INTERNAL_API_KEY="your-internal-key"  # openssl rand -hex 32
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Add scopes:
   ```
   https://www.googleapis.com/auth/userinfo.profile
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/gmail.modify
   https://www.googleapis.com/auth/gmail.settings.basic
   https://www.googleapis.com/auth/contacts
   ```
5. Add yourself as test user
6. Copy Client ID and Secret to `.env`

📖 [Full Configuration Guide](./apps/web/.env.example)

---

## Architecture

```
┌──────────────────┐
│   EmailAI App    │  ← Main application (Next.js)
│   (Port 3000)    │
└────────┬─────────┘
         │
         ├─→ PostgreSQL (Database)
         ├─→ Redis (Cache/Queue)
         ├─→ Google Gmail API
         └─→ AI Provider
              │
              ├─→ Ollama Server (Local AI) ← Recommended
              ├─→ OpenAI API
              ├─→ Anthropic API
              └─→ Groq API
```

### Multi-Tenant Architecture

```
User ──→ Organization ──→ Email Accounts (shared)
  │            │
  │            ├─→ Rules (shared)
  │            ├─→ Knowledge Base (shared)
  │            ├─→ Categories (shared)
  │            └─→ Premium Subscription (seat-based)
  │
  └─→ Fine-Tuned AI Model (personalized)
```

📖 [Architecture Details](./ARCHITECTURE.md)
📖 [Multi-Tenant Implementation](./MULTI_TENANT_IMPLEMENTATION.md)

---

## Documentation

### Setup & Deployment
- [Quick Start](./QUICK_START.md) - One-command setup wizard
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md) - Production deployment
- [Migration Runbook](./docs/MIGRATION_RUNBOOK.md) - Database migrations

### AI & Ollama
- [AI Features Overview](./AI_FEATURES_OVERVIEW.md) - All AI capabilities
- [Ollama Deployment](./ollama-server/README.md) - Local AI setup
- [Vast.ai Guide](./ollama-server/docs/VASTAI_DEPLOYMENT.md) - GPU rental
- [Fine-Tuning Guide](./ollama-server/fine-tuning/README.md) - User voice training

### Administration
- [User Guide](./docs/USER_GUIDE_ORGANIZATIONS.md) - For end users
- [Admin Guide](./docs/ADMIN_GUIDE.md) - For administrators
- [API Documentation](./docs/API_DOCUMENTATION.md) - API reference
- [Monitoring Setup](./docs/MONITORING_SETUP.md) - Observability

### Features
- [Features Status](./docs/FEATURES_STATUS.md) - Implementation status
- [Pricing & Features](./docs/PRICING_AND_FEATURES.md) - Tier comparison

---

## Tech Stack

- **Frontend**: Next.js 14+, React 18+, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL 14+
- **Cache**: Redis (Upstash)
- **Auth**: NextAuth.js with Google OAuth
- **AI**: OpenAI, Anthropic, Google Gemini, Groq, Ollama (local)
- **Payments**: Stripe, LemonSqueezy
- **Monitoring**: Sentry, PostHog, Axiom

---

## Premium Features

**Upgrade yourself to premium (for development):**
```bash
# 1. Set yourself as admin in .env
ADMINS=your-email@gmail.com

# 2. Visit admin panel
http://localhost:3000/admin

# 3. Upgrade yourself to Premium tier
```

**Premium tiers:**
- **Free**: 1 email account, 5 rules, basic features
- **Basic** ($15/month): Unlimited accounts, advanced automation, AI features
- **Business** ($20/month + seats): Multi-tenant organizations, team collaboration
- **Enterprise** (Custom): On-premise, white-label, dedicated support

📖 [Pricing Details](./docs/PRICING_AND_FEATURES.md)

---

## Support & Contributing

- **Issues**: [GitHub Issues](https://github.com/emailai/emailai/issues)
- **Discord**: [Join Discord](https://www.emailai.com/discord)
- **Documentation**: [docs.emailai.com](https://docs.emailai.com)

**Contributing:**
- View open tasks in [GitHub Issues](https://github.com/emailai/emailai/issues)
- Join [Discord](https://www.emailai.com/discord) to discuss
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the codebase

---

## License

MIT License - See LICENSE file for details

**Model Licenses:**
- Llama 3: [Meta Llama License](https://llama.meta.com/llama3/license/)
- Other models: Check individual model licenses

---

## Quick Reference Commands

```bash
# Development
pnpm run dev              # Start dev server
pnpm run build            # Build for production
pnpm start                # Start production server
pnpm test                 # Run tests
pnpm lint                 # Run linter

# Database
pnpm prisma migrate dev   # Run migrations
pnpm prisma studio        # Open DB GUI
docker-compose up -d      # Start local DB + Redis

# Ollama (local AI)
cd ollama-server/scripts
sudo bash setup.sh prod   # Install Ollama + model

# Fine-tuning
cd ollama-server/fine-tuning
python scripts/prepare-email-data.py --user-id "user123" --output ./training-data
python scripts/finetune-lora.py --config configs/lora-config-8b.yaml
bash scripts/deploy-to-ollama.sh --model ./output/llama-3.1-8b-email --user-id "user123"
```

---

**Ready to start?** Run: `bash scripts/setup.sh` 🚀
