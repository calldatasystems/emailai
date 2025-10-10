#!/bin/bash

# EmailAI - One-Command Setup Script
# Usage: ./scripts/setup.sh [--production] [--vercel]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine environment
ENVIRONMENT="development"
DEPLOY_TARGET="local"

# Parse arguments
for arg in "$@"; do
    case $arg in
        --production)
            ENVIRONMENT="production"
            ;;
        --vercel)
            DEPLOY_TARGET="vercel"
            ENVIRONMENT="production"
            ;;
        *)
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EmailAI Setup Script                 ║${NC}"
echo -e "${BLUE}║   Environment: $ENVIRONMENT            ║${NC}"
echo -e "${BLUE}║   Target: $DEPLOY_TARGET               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[*]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node version
check_node_version() {
    if command_exists node; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            return 0
        fi
    fi
    return 1
}

# Function to install Node.js via nvm
install_node() {
    print_status "Installing Node.js 18 via nvm..."

    # Install nvm if not present
    if [ ! -d "$HOME/.nvm" ]; then
        print_status "Installing nvm..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi

    # Install Node 18
    nvm install 18
    nvm use 18
    nvm alias default 18

    print_success "Node.js 18 installed"
}

# Function to install PostgreSQL
install_postgres() {
    if command_exists psql; then
        print_success "PostgreSQL already installed"
        return 0
    fi

    print_status "Installing PostgreSQL..."

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux (Ubuntu/Debian)
        sudo apt update
        sudo apt install -y postgresql postgresql-contrib
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            brew install postgresql@15
            brew services start postgresql@15
        else
            print_error "Homebrew not found. Please install PostgreSQL manually."
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install PostgreSQL manually."
        exit 1
    fi

    print_success "PostgreSQL installed"
}

# Function to create database
setup_database() {
    print_status "Setting up database..."

    DB_NAME="${DB_NAME:-emailai_dev}"
    DB_USER="${DB_USER:-emailai}"
    DB_PASSWORD="${DB_PASSWORD:-emailai_dev_password}"

    if [[ "$ENVIRONMENT" == "production" ]]; then
        DB_NAME="emailai_prod"
        # Generate secure password for production
        DB_PASSWORD=$(openssl rand -base64 32)
        print_warning "Generated database password: $DB_PASSWORD"
        print_warning "Save this password in your password manager!"
    fi

    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        print_success "Database '$DB_NAME' already exists"
    else
        print_status "Creating database '$DB_NAME'..."

        # Create user
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" 2>/dev/null || true

        # Create database
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true

        # Grant privileges
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

        # Enable extensions
        sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
        sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";" 2>/dev/null || true

        print_success "Database created: $DB_NAME"
    fi

    # Export for later use
    export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
}

# Function to prompt for value with default
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local secret="${3:-false}"
    local value

    if [ -n "$default" ]; then
        if [ "$secret" = true ]; then
            read -p "$prompt (default: ***hidden***): " value
        else
            read -p "$prompt (default: $default): " value
        fi
        echo "${value:-$default}"
    else
        if [ "$secret" = true ]; then
            read -s -p "$prompt: " value
            echo ""
            echo "$value"
        else
            read -p "$prompt: " value
            echo "$value"
        fi
    fi
}

# Function to check/install Vercel CLI
setup_vercel_cli() {
    if command_exists vercel; then
        print_success "Vercel CLI already installed"
        return 0
    fi

    print_status "Installing Vercel CLI..."
    npm install -g vercel
    print_success "Vercel CLI installed"
}

# Function to configure cloud database for Vercel
setup_cloud_database() {
    print_status "Setting up cloud database..."
    echo ""
    echo -e "${GREEN}━━━ Database Configuration (Cloud) ━━━${NC}"
    echo ""
    echo "For Vercel deployment, you need a cloud PostgreSQL database."
    echo ""
    echo "Recommended options:"
    echo "  1. Supabase (https://supabase.com) - Free tier available"
    echo "  2. Neon (https://neon.tech) - Free tier available"
    echo "  3. Railway (https://railway.app) - Pay as you go"
    echo "  4. I already have a database"
    echo ""

    read -p "Choose option (1-4): " db_choice

    case $db_choice in
        1)
            echo ""
            echo "Setting up with Supabase:"
            echo "  1. Go to https://supabase.com and create a project"
            echo "  2. Wait for database to provision (~2 minutes)"
            echo "  3. Go to Project Settings → Database → Connection String"
            echo ""
            echo "  4. For DATABASE_URL:"
            echo "     - Mode: Transaction"
            echo "     - Port: 6543"
            echo "     - Copy the 'Transaction pooler' connection string"
            echo ""
            read -p "Press Enter when ready to continue..."
            echo ""
            read -p "Database URL (Transaction Pooler - port 6543): " DATABASE_URL
            echo ""
            echo "  5. For DIRECT_URL:"
            echo "     - Mode: Session"
            echo "     - Port: 5432"
            echo "     - Copy the 'Direct connection' string"
            echo ""
            read -p "Direct URL (Direct Connection - port 5432): " DIRECT_URL
            ;;
        2)
            echo ""
            echo "Setting up with Neon:"
            echo "  1. Go to https://neon.tech and create a project"
            echo "  2. Copy the connection string"
            echo ""
            read -p "Press Enter when ready to continue..."
            echo ""
            read -p "Database URL: " DATABASE_URL
            DIRECT_URL="$DATABASE_URL"
            ;;
        3)
            echo ""
            echo "Setting up with Railway:"
            echo "  1. Go to https://railway.app and create a PostgreSQL database"
            echo "  2. Copy the connection string"
            echo ""
            read -p "Press Enter when ready to continue..."
            echo ""
            read -p "Database URL: " DATABASE_URL
            DIRECT_URL="$DATABASE_URL"
            ;;
        4)
            echo ""
            read -p "Database URL: " DATABASE_URL
            read -p "Direct URL (or press Enter for same as above): " DIRECT_URL
            DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac

    export DATABASE_URL
    export DIRECT_URL

    print_success "Database configured"
}

# Function to setup cloud Redis for Vercel
setup_cloud_redis() {
    print_status "Setting up Redis..."
    echo ""
    echo -e "${GREEN}━━━ Redis Configuration (Optional) ━━━${NC}"
    echo ""
    echo "Redis is optional but recommended for better performance."
    echo ""
    echo "Options:"
    echo "  1. Upstash Redis (https://upstash.com) - Free tier available"
    echo "  2. Skip Redis for now"
    echo ""

    read -p "Choose option (1-2): " redis_choice

    case $redis_choice in
        1)
            echo ""
            echo "Setting up with Upstash:"
            echo "  1. Go to https://upstash.com and create a Redis database"
            echo "  2. Choose region closest to your Vercel deployment"
            echo "  3. Copy the REST URL and REST Token"
            echo ""
            read -p "Press Enter when ready to continue..."
            echo ""
            read -p "Upstash REST URL: " UPSTASH_REDIS_REST_URL
            read -p "Upstash REST Token: " UPSTASH_REDIS_REST_TOKEN
            export UPSTASH_REDIS_REST_URL
            export UPSTASH_REDIS_REST_TOKEN
            print_success "Redis configured"
            ;;
        2)
            print_warning "Skipping Redis - performance may be reduced"
            ;;
        *)
            print_error "Invalid option"
            exit 1
            ;;
    esac
}

# Function to setup environment variables
setup_env_file() {
    print_status "Setting up environment variables..."

    ENV_FILE="apps/web/.env.local"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        ENV_FILE="apps/web/.env.production"
    fi

    if [ -f "$ENV_FILE" ]; then
        print_success "Environment file already exists: $ENV_FILE"

        # Ask if user wants to overwrite
        read -p "Do you want to reconfigure it? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}         Environment Configuration Wizard              ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Generate default secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    # Determine default URL
    if [[ "$ENVIRONMENT" == "production" ]]; then
        DEFAULT_URL="https://yourdomain.com"
    else
        DEFAULT_URL="http://localhost:3000"
    fi

    # Basic Configuration
    echo -e "${GREEN}━━━ Basic Configuration ━━━${NC}"
    echo ""
    echo "The application URL is where your EmailAI instance will be accessible."
    echo "For development, this is typically http://localhost:3000"
    NEXTAUTH_URL=$(prompt_with_default "Application URL" "$DEFAULT_URL")
    echo ""

    # Google OAuth Configuration
    echo -e "${GREEN}━━━ Google OAuth Setup ━━━${NC}"
    echo ""
    echo "Google OAuth is REQUIRED for authentication."
    echo ""
    echo "To get credentials:"
    echo "  1. Go to: https://console.cloud.google.com/apis/credentials"
    echo "  2. Create a new OAuth 2.0 Client ID (or use existing)"
    echo "  3. Application type: Web application"
    echo "  4. Authorized redirect URIs: ${NEXTAUTH_URL}/api/auth/callback/google"
    echo "  5. Copy the Client ID and Client Secret"
    echo ""

    read -p "Do you have Google OAuth credentials ready? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Google Client ID: " GOOGLE_CLIENT_ID
        read -p "Google Client Secret: " GOOGLE_CLIENT_SECRET
    else
        print_warning "Skipping Google OAuth for now. You'll need to add this later!"
        print_warning "The app won't work without Google OAuth credentials."
        GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
        GOOGLE_CLIENT_SECRET="your-client-secret"
    fi
    echo ""

    # Payment Provider
    echo -e "${GREEN}━━━ Payment Provider (Optional) ━━━${NC}"
    echo ""
    echo "Choose a payment provider for billing features:"
    echo "  1. Stripe (recommended)"
    echo "  2. LemonSqueezy"
    echo "  3. Skip for now"
    echo ""
    read -p "Choice (1/2/3): " payment_choice

    STRIPE_SECRET_KEY=""
    STRIPE_WEBHOOK_SECRET=""
    STRIPE_PUBLISHABLE_KEY=""
    LEMON_SQUEEZY_API_KEY=""
    LEMON_SQUEEZY_WEBHOOK_SECRET=""
    LEMON_SQUEEZY_STORE_ID=""

    if [ "$payment_choice" = "1" ]; then
        echo ""
        echo "To get Stripe credentials:"
        echo "  1. Sign up at: https://dashboard.stripe.com/register"
        echo "  2. Go to Developers → API keys"
        echo "  3. Copy the Secret key and Publishable key"
        echo "  4. Set up webhook endpoint: ${NEXTAUTH_URL}/api/stripe/webhook"
        echo ""
        read -p "Stripe Secret Key (e.g., sk_test_...): " STRIPE_SECRET_KEY
        read -p "Stripe Publishable Key (e.g., pk_test_...): " STRIPE_PUBLISHABLE_KEY
        read -p "Stripe Webhook Secret (e.g., whsec_...): " STRIPE_WEBHOOK_SECRET
    elif [ "$payment_choice" = "2" ]; then
        echo ""
        echo "To get LemonSqueezy credentials:"
        echo "  1. Sign up at: https://app.lemonsqueezy.com/register"
        echo "  2. Go to Settings → API"
        echo "  3. Create a new API key"
        echo ""
        read -p "LemonSqueezy API Key: " LEMON_SQUEEZY_API_KEY
        read -p "LemonSqueezy Store ID: " LEMON_SQUEEZY_STORE_ID
        read -p "LemonSqueezy Webhook Secret: " LEMON_SQUEEZY_WEBHOOK_SECRET
    fi
    echo ""

    # Email Service
    echo -e "${GREEN}━━━ Email Service (Optional) ━━━${NC}"
    echo ""
    echo "Configure an email service for sending notifications."
    echo "Resend is recommended: https://resend.com"
    echo ""
    read -p "Do you want to configure email sending? (y/N) " -n 1 -r
    echo

    RESEND_API_KEY=""
    RESEND_FROM_EMAIL="noreply@localhost"

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "To get Resend credentials:"
        echo "  1. Sign up at: https://resend.com/signup"
        echo "  2. Go to API Keys and create a new key"
        echo "  3. Verify your sending domain (optional for testing)"
        echo ""
        read -p "Resend API Key (e.g., re_...): " RESEND_API_KEY
        read -p "From Email Address (default: noreply@${NEXTAUTH_URL#*://}): " RESEND_FROM_EMAIL
        RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-noreply@${NEXTAUTH_URL#*://}}"
    fi
    echo ""

    # AI Provider Configuration
    echo -e "${GREEN}━━━ AI Provider (Required for AI Features) ━━━${NC}"
    echo ""
    echo "Choose an AI provider for email automation and AI features:"
    echo "  1. Ollama (local or self-hosted, free, most private)"
    echo "  2. Groq (cloud API, fastest and cheapest)"
    echo "  3. OpenAI (cloud API, GPT-4)"
    echo "  4. Anthropic (cloud API, Claude)"
    echo "  5. Google Gemini (cloud API)"
    echo "  6. Skip for now (AI features will be disabled)"
    echo ""
    read -p "Choice (1/2/3/4/5/6): " ai_choice

    DEFAULT_LLM_PROVIDER=""
    OLLAMA_BASE_URL=""
    NEXT_PUBLIC_OLLAMA_MODEL=""
    OPENAI_API_KEY=""
    ANTHROPIC_API_KEY=""
    GROQ_API_KEY=""
    GOOGLE_AI_API_KEY=""

    case "$ai_choice" in
        1)
            echo ""
            echo "Ollama Setup:"
            echo ""
            echo "Option 1: Local Ollama (for development)"
            echo "  - Install Ollama: https://ollama.com/download"
            echo "  - Run: ollama pull llama3.3:70b"
            echo "  - Use URL: http://localhost:11434/api"
            echo ""
            echo "Option 2: Vast.ai GPU Server (for production)"
            echo "  - Rent GPU: https://cloud.vast.ai/"
            echo "  - Deploy Ollama: cd ollama-server/scripts && sudo bash setup.sh prod"
            echo "  - Use URL: https://ai.calldata.app/api or http://ssh5.vast.ai:PORT/api"
            echo ""
            echo "Option 3: Self-hosted Server"
            echo "  - Install Ollama on your server"
            echo "  - Use URL: https://your-server.com/api"
            echo ""

            DEFAULT_LLM_PROVIDER="ollama"
            read -p "Ollama Base URL (default: http://localhost:11434/api): " OLLAMA_BASE_URL
            OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://localhost:11434/api}"
            read -p "Ollama Model (default: llama3.3:70b): " NEXT_PUBLIC_OLLAMA_MODEL
            NEXT_PUBLIC_OLLAMA_MODEL="${NEXT_PUBLIC_OLLAMA_MODEL:-llama3.3:70b}"

            echo ""
            print_success "Ollama configured: $OLLAMA_BASE_URL"
            ;;
        2)
            echo ""
            echo "Groq Setup (Fastest & Cheapest):"
            echo "  1. Sign up at: https://console.groq.com/"
            echo "  2. Go to API Keys and create a new key"
            echo "  3. Free tier includes generous limits"
            echo ""
            DEFAULT_LLM_PROVIDER="groq"
            read -p "Groq API Key (e.g., gsk_...): " GROQ_API_KEY
            ;;
        3)
            echo ""
            echo "OpenAI Setup:"
            echo "  1. Sign up at: https://platform.openai.com/signup"
            echo "  2. Go to API Keys and create a new key"
            echo "  3. Add credits to your account"
            echo ""
            DEFAULT_LLM_PROVIDER="openai"
            read -p "OpenAI API Key (e.g., sk-...): " OPENAI_API_KEY
            ;;
        4)
            echo ""
            echo "Anthropic Setup:"
            echo "  1. Sign up at: https://console.anthropic.com/"
            echo "  2. Go to API Keys and create a new key"
            echo "  3. Add credits to your account"
            echo ""
            DEFAULT_LLM_PROVIDER="anthropic"
            read -p "Anthropic API Key (e.g., sk-ant-...): " ANTHROPIC_API_KEY
            ;;
        5)
            echo ""
            echo "Google Gemini Setup:"
            echo "  1. Go to: https://makersuite.google.com/app/apikey"
            echo "  2. Create a new API key"
            echo "  3. Free tier available"
            echo ""
            DEFAULT_LLM_PROVIDER="google"
            read -p "Google AI API Key: " GOOGLE_AI_API_KEY
            ;;
        *)
            print_warning "Skipping AI provider configuration"
            print_warning "AI features will be disabled until you configure a provider"
            ;;
    esac
    echo ""

    # Redis Configuration (Optional but recommended)
    echo -e "${GREEN}━━━ Redis Cache (Optional but Recommended) ━━━${NC}"
    echo ""
    echo "Redis is used for caching and rate limiting."
    echo ""
    echo "Options:"
    echo "  1. Local Redis (for development)"
    echo "  2. Upstash (managed Redis, free tier available)"
    echo "  3. Skip for now"
    echo ""
    read -p "Choice (1/2/3): " redis_choice

    REDIS_URL=""
    UPSTASH_REDIS_REST_URL=""
    UPSTASH_REDIS_REST_TOKEN=""

    case "$redis_choice" in
        1)
            echo ""
            echo "Local Redis:"
            echo "  - Install Redis: https://redis.io/download"
            echo "  - Or use Docker: docker run -d -p 6379:6379 redis"
            echo "  - Default URL: redis://localhost:6379"
            echo ""
            read -p "Redis URL (default: redis://localhost:6379): " REDIS_URL
            REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
            ;;
        2)
            echo ""
            echo "Upstash Setup:"
            echo "  1. Sign up at: https://upstash.com"
            echo "  2. Create a new Redis database"
            echo "  3. Copy the REST URL and Token"
            echo ""
            read -p "Upstash Redis REST URL (e.g., https://xxx.upstash.io): " UPSTASH_REDIS_REST_URL
            read -p "Upstash Redis REST Token: " UPSTASH_REDIS_REST_TOKEN
            ;;
        *)
            print_warning "Skipping Redis configuration"
            print_warning "Caching and rate limiting will be disabled"
            ;;
    esac
    echo ""

    # Monitoring
    echo -e "${GREEN}━━━ Monitoring & Analytics (Optional) ━━━${NC}"
    echo ""
    echo "Set up error tracking and analytics."
    echo ""
    read -p "Do you want to configure monitoring? (y/N) " -n 1 -r
    echo

    SENTRY_DSN=""
    POSTHOG_KEY=""
    POSTHOG_HOST="https://app.posthog.com"

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Sentry - Error tracking"
        echo "Sign up at: https://sentry.io/signup/"
        echo ""
        read -p "Configure Sentry? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "Sentry DSN (e.g., https://xxx@sentry.io/xxx): " SENTRY_DSN
        fi

        echo ""
        echo "PostHog - Product analytics"
        echo "Sign up at: https://posthog.com/signup"
        echo ""
        read -p "Configure PostHog? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            read -p "PostHog Project API Key (e.g., phc_...): " POSTHOG_KEY
            read -p "PostHog Host (default: https://app.posthog.com): " POSTHOG_HOST
            POSTHOG_HOST="${POSTHOG_HOST:-https://app.posthog.com}"
        fi
    fi
    echo ""

    # Additional Settings
    read -p "Log level (debug/info/warn/error, default: info): " LOG_LEVEL
    LOG_LEVEL="${LOG_LEVEL:-info}"

    # Create env file
    print_status "Creating $ENV_FILE..."

    cat > "$ENV_FILE" << EOF
# ═══════════════════════════════════════════════════════
#  EmailAI Environment Configuration
#  Generated: $(date)
#  Environment: $ENVIRONMENT
# ═══════════════════════════════════════════════════════

# ━━━ Database ━━━
# PostgreSQL connection string for the application
DATABASE_URL="${DATABASE_URL}"
# Direct connection for migrations (usually same as DATABASE_URL)
DIRECT_URL="${DATABASE_URL}"

# ━━━ Authentication ━━━
# The public URL where your app is accessible
NEXTAUTH_URL="${NEXTAUTH_URL}"
# Secret for signing JWT tokens (auto-generated)
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"

# ━━━ Google OAuth ━━━
# Required for user authentication
# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}"

EOF

    # Add payment provider config if provided
    if [ -n "$STRIPE_SECRET_KEY" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ Stripe Payment Provider ━━━
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}"
STRIPE_PUBLISHABLE_KEY="${STRIPE_PUBLISHABLE_KEY}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET}"

EOF
    elif [ -n "$LEMON_SQUEEZY_API_KEY" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ LemonSqueezy Payment Provider ━━━
# Get from: https://app.lemonsqueezy.com/settings/api
LEMON_SQUEEZY_API_KEY="${LEMON_SQUEEZY_API_KEY}"
LEMON_SQUEEZY_STORE_ID="${LEMON_SQUEEZY_STORE_ID}"
LEMON_SQUEEZY_WEBHOOK_SECRET="${LEMON_SQUEEZY_WEBHOOK_SECRET}"

EOF
    fi

    # Add email service if provided
    if [ -n "$RESEND_API_KEY" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ Email Service ━━━
# Get from: https://resend.com/api-keys
RESEND_API_KEY="${RESEND_API_KEY}"
RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL}"

EOF
    fi

    # Add AI provider configuration
    if [ -n "$DEFAULT_LLM_PROVIDER" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ AI Provider Configuration ━━━
DEFAULT_LLM_PROVIDER="${DEFAULT_LLM_PROVIDER}"

EOF
        if [ "$DEFAULT_LLM_PROVIDER" = "ollama" ]; then
            cat >> "$ENV_FILE" << EOF
# Ollama Configuration
# Local: http://localhost:11434/api
# Vast.ai: https://ai.calldata.app/api or http://ssh5.vast.ai:PORT/api
OLLAMA_BASE_URL="${OLLAMA_BASE_URL}"
NEXT_PUBLIC_OLLAMA_MODEL="${NEXT_PUBLIC_OLLAMA_MODEL}"

EOF
        elif [ "$DEFAULT_LLM_PROVIDER" = "openai" ]; then
            cat >> "$ENV_FILE" << EOF
# OpenAI Configuration
OPENAI_API_KEY="${OPENAI_API_KEY}"

EOF
        elif [ "$DEFAULT_LLM_PROVIDER" = "anthropic" ]; then
            cat >> "$ENV_FILE" << EOF
# Anthropic Configuration
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}"

EOF
        elif [ "$DEFAULT_LLM_PROVIDER" = "groq" ]; then
            cat >> "$ENV_FILE" << EOF
# Groq Configuration
GROQ_API_KEY="${GROQ_API_KEY}"

EOF
        elif [ "$DEFAULT_LLM_PROVIDER" = "google" ]; then
            cat >> "$ENV_FILE" << EOF
# Google AI Configuration
GOOGLE_AI_API_KEY="${GOOGLE_AI_API_KEY}"

EOF
        fi
    fi

    # Add Redis configuration
    if [ -n "$REDIS_URL" ] || [ -n "$UPSTASH_REDIS_REST_URL" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ Redis Cache ━━━
EOF
        if [ -n "$REDIS_URL" ]; then
            cat >> "$ENV_FILE" << EOF
# Local or self-hosted Redis
REDIS_URL="${REDIS_URL}"

EOF
        fi
        if [ -n "$UPSTASH_REDIS_REST_URL" ]; then
            cat >> "$ENV_FILE" << EOF
# Upstash Redis (managed)
UPSTASH_REDIS_REST_URL="${UPSTASH_REDIS_REST_URL}"
UPSTASH_REDIS_REST_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"

EOF
        fi
    fi

    # Add monitoring if provided
    if [ -n "$SENTRY_DSN" ] || [ -n "$POSTHOG_KEY" ]; then
        cat >> "$ENV_FILE" << EOF
# ━━━ Monitoring & Analytics ━━━
EOF
        if [ -n "$SENTRY_DSN" ]; then
            cat >> "$ENV_FILE" << EOF
# Sentry error tracking
SENTRY_DSN="${SENTRY_DSN}"
NEXT_PUBLIC_SENTRY_DSN="${SENTRY_DSN}"
EOF
        fi
        if [ -n "$POSTHOG_KEY" ]; then
            cat >> "$ENV_FILE" << EOF
# PostHog product analytics
NEXT_PUBLIC_POSTHOG_KEY="${POSTHOG_KEY}"
NEXT_PUBLIC_POSTHOG_HOST="${POSTHOG_HOST}"
EOF
        fi
        echo "" >> "$ENV_FILE"
    fi

    # Add application settings
    cat >> "$ENV_FILE" << EOF
# ━━━ Application Settings ━━━
NODE_ENV="${ENVIRONMENT}"
NEXT_PUBLIC_BASE_URL="${NEXTAUTH_URL}"
LOG_LEVEL="${LOG_LEVEL}"

# ━━━ Feature Flags ━━━
NEXT_PUBLIC_ENABLE_ORGANIZATIONS="true"
NEXT_PUBLIC_ENABLE_COLD_EMAIL_BLOCKER="true"

# ━━━ Internal Keys ━━━
# Auto-generated internal API keys
INTERNAL_API_KEY="$(openssl rand -hex 32)"
API_KEY_SALT="$(openssl rand -hex 16)"

# ━━━ Additional Configuration ━━━
# Uncomment and configure as needed:

# Google Encryption (for storing OAuth tokens securely)
# GOOGLE_ENCRYPT_SECRET="$(openssl rand -hex 32)"
# GOOGLE_ENCRYPT_SALT="$(openssl rand -hex 16)"

# Google PubSub (for real-time email notifications)
# GOOGLE_PUBSUB_TOPIC_NAME="projects/YOUR_PROJECT/topics/emailai"
# GOOGLE_PUBSUB_VERIFICATION_TOKEN="$(openssl rand -hex 32)"

# Axiom (advanced logging)
# AXIOM_TOKEN="xaat-xxx"
# AXIOM_DATASET="${ENVIRONMENT}"

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1
EOF

    print_success "Environment file created: $ENV_FILE"
    echo ""

    # Print warnings for missing config
    if [ "$GOOGLE_CLIENT_ID" = "your-client-id.apps.googleusercontent.com" ]; then
        print_warning "⚠️  Google OAuth not configured!"
        print_warning "   The app will NOT work until you add valid credentials to:"
        print_warning "   $ENV_FILE"
        print_warning ""
        print_warning "   Quick setup:"
        print_warning "   1. Go to: https://console.cloud.google.com/apis/credentials"
        print_warning "   2. Create OAuth 2.0 Client ID"
        print_warning "   3. Add redirect URI: ${NEXTAUTH_URL}/api/auth/callback/google"
        print_warning "   4. Copy credentials to $ENV_FILE"
        echo ""
    fi

    if [ -z "$STRIPE_SECRET_KEY" ] && [ -z "$LEMON_SQUEEZY_API_KEY" ]; then
        print_warning "ℹ️  Payment provider not configured"
        print_warning "   Billing features will be disabled until you configure one."
        echo ""
    fi

    if [ -z "$DEFAULT_LLM_PROVIDER" ]; then
        print_warning "⚠️  AI Provider not configured!"
        print_warning "   AI features (automation, smart replies, categorization) will NOT work."
        print_warning "   To enable AI, choose one of these options in $ENV_FILE:"
        print_warning ""
        print_warning "   Option 1 - Ollama (Free, Private):"
        print_warning "   DEFAULT_LLM_PROVIDER=ollama"
        print_warning "   OLLAMA_BASE_URL=http://localhost:11434/api"
        print_warning "   NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b"
        print_warning ""
        print_warning "   Option 2 - Groq (Fast, Cheap Cloud):"
        print_warning "   DEFAULT_LLM_PROVIDER=groq"
        print_warning "   GROQ_API_KEY=your-key-from-console.groq.com"
        print_warning ""
        print_warning "   Option 3 - OpenAI:"
        print_warning "   DEFAULT_LLM_PROVIDER=openai"
        print_warning "   OPENAI_API_KEY=sk-..."
        echo ""
    fi

    if [ -z "$REDIS_URL" ] && [ -z "$UPSTASH_REDIS_REST_URL" ]; then
        print_warning "ℹ️  Redis not configured"
        print_warning "   Caching and rate limiting will be disabled."
        print_warning "   For better performance, consider adding Redis."
        echo ""
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing npm dependencies..."

    if [ -d "node_modules" ]; then
        print_success "Dependencies already installed (node_modules exists)"

        # Ask if user wants to reinstall
        read -p "Do you want to reinstall dependencies? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi

    npm install

    print_success "Dependencies installed"
}

# Function to run database migrations
run_migrations() {
    print_status "Running database migrations..."

    cd apps/web

    # Generate Prisma Client
    npx prisma generate

    # Run migrations
    if [[ "$ENVIRONMENT" == "production" ]]; then
        npx prisma migrate deploy
    else
        npx prisma migrate dev
    fi

    cd ../..

    print_success "Database migrations completed"
}

# Function to seed database (optional)
seed_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        return 0
    fi

    print_status "Do you want to seed the database with sample data? (y/N)"
    read -p "" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd apps/web
        npx prisma db seed 2>/dev/null || print_warning "No seed script found"
        cd ../..
        print_success "Database seeded"
    fi
}

# Function to setup Git hooks
setup_git_hooks() {
    print_status "Setting up Git hooks..."

    if [ -f ".husky/pre-commit" ]; then
        print_success "Git hooks already configured"
        return 0
    fi

    npx husky install
    npx husky add .husky/pre-commit "npm run lint-staged"

    print_success "Git hooks configured"
}

# Function to verify setup
verify_setup() {
    print_status "Verifying setup..."

    CHECKS_PASSED=0
    CHECKS_FAILED=0

    # Check Node.js
    if check_node_version; then
        print_success "Node.js: $(node -v)"
        ((CHECKS_PASSED++))
    else
        print_error "Node.js version check failed"
        ((CHECKS_FAILED++))
    fi

    # Check PostgreSQL
    if command_exists psql; then
        print_success "PostgreSQL: $(psql --version | head -n1)"
        ((CHECKS_PASSED++))
    else
        print_error "PostgreSQL not found"
        ((CHECKS_FAILED++))
    fi

    # Check database connection
    if psql "$DATABASE_URL" -c "SELECT 1" >/dev/null 2>&1; then
        print_success "Database connection successful"
        ((CHECKS_PASSED++))
    else
        print_error "Database connection failed"
        ((CHECKS_FAILED++))
    fi

    # Check environment file
    ENV_FILE="apps/web/.env.local"
    [[ "$ENVIRONMENT" == "production" ]] && ENV_FILE="apps/web/.env.production"

    if [ -f "$ENV_FILE" ]; then
        print_success "Environment file exists: $ENV_FILE"
        ((CHECKS_PASSED++))
    else
        print_error "Environment file missing: $ENV_FILE"
        ((CHECKS_FAILED++))
    fi

    # Check Prisma Client
    if [ -d "node_modules/@prisma/client" ]; then
        print_success "Prisma Client generated"
        ((CHECKS_PASSED++))
    else
        print_error "Prisma Client not found"
        ((CHECKS_FAILED++))
    fi

    echo ""
    echo -e "${BLUE}════════════════════════════════════════${NC}"
    echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
    echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}"

    return $CHECKS_FAILED
}

# Function to deploy to Vercel
deploy_to_vercel() {
    print_status "Deploying to Vercel..."
    echo ""

    cd apps/web

    # Login to Vercel
    print_status "Logging into Vercel..."
    vercel login

    # Link or create project
    print_status "Linking to Vercel project..."
    vercel link --yes

    # Add environment variables to Vercel
    print_status "Adding environment variables to Vercel..."
    echo ""
    echo "Adding environment variables (this may take a moment)..."

    # Database
    echo "$DATABASE_URL" | vercel env add DATABASE_URL production
    echo "$DIRECT_URL" | vercel env add DIRECT_URL production

    # Auth
    echo "$NEXTAUTH_URL" | vercel env add NEXTAUTH_URL production
    echo "$NEXTAUTH_SECRET" | vercel env add NEXTAUTH_SECRET production
    echo "$GOOGLE_CLIENT_ID" | vercel env add GOOGLE_CLIENT_ID production
    echo "$GOOGLE_CLIENT_SECRET" | vercel env add GOOGLE_CLIENT_SECRET production

    # AI Provider
    echo "$DEFAULT_LLM_PROVIDER" | vercel env add DEFAULT_LLM_PROVIDER production

    if [ "$DEFAULT_LLM_PROVIDER" = "ollama" ]; then
        echo "$OLLAMA_BASE_URL" | vercel env add OLLAMA_BASE_URL production
        echo "$NEXT_PUBLIC_OLLAMA_MODEL" | vercel env add NEXT_PUBLIC_OLLAMA_MODEL production
    elif [ "$DEFAULT_LLM_PROVIDER" = "openai" ]; then
        echo "$OPENAI_API_KEY" | vercel env add OPENAI_API_KEY production
    elif [ "$DEFAULT_LLM_PROVIDER" = "anthropic" ]; then
        echo "$ANTHROPIC_API_KEY" | vercel env add ANTHROPIC_API_KEY production
    elif [ "$DEFAULT_LLM_PROVIDER" = "groq" ]; then
        echo "$GROQ_API_KEY" | vercel env add GROQ_API_KEY production
    elif [ "$DEFAULT_LLM_PROVIDER" = "google" ]; then
        echo "$GOOGLE_AI_API_KEY" | vercel env add GOOGLE_AI_API_KEY production
    fi

    # Redis (if configured)
    if [ -n "$UPSTASH_REDIS_REST_URL" ]; then
        echo "$UPSTASH_REDIS_REST_URL" | vercel env add UPSTASH_REDIS_REST_URL production
        echo "$UPSTASH_REDIS_REST_TOKEN" | vercel env add UPSTASH_REDIS_REST_TOKEN production
    fi

    # App settings
    echo "$NEXTAUTH_URL" | vercel env add NEXT_PUBLIC_BASE_URL production
    echo "$NEXTAUTH_URL" | vercel env add NEXT_PUBLIC_CALL_BASE_URL production

    # Internal API key
    INTERNAL_API_KEY=$(openssl rand -base64 32)
    echo "$INTERNAL_API_KEY" | vercel env add INTERNAL_API_KEY production

    # Feature flags
    echo "true" | vercel env add NEXT_PUBLIC_ENABLE_ORGANIZATIONS production
    echo "true" | vercel env add NEXT_PUBLIC_ENABLE_COLD_EMAIL_BLOCKER production

    # Disable optional services
    echo "true" | vercel env add DISABLE_TINYBIRD production
    echo "true" | vercel env add DISABLE_POSTHOG production

    print_success "Environment variables added to Vercel"

    # Run database migrations
    print_status "Running database migrations..."
    export DIRECT_URL
    npx prisma migrate deploy

    # Deploy to production
    print_status "Deploying to production..."
    echo ""
    vercel --prod

    cd ../..

    print_success "Deployed to Vercel!"
    echo ""
    echo -e "${GREEN}Your application is now live!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Update Google OAuth redirect URI with your Vercel URL"
    echo "2. Visit your deployment URL to test"
    echo "3. Sign in with Google and connect your Gmail"
    echo ""
}

# Function to print next steps
print_next_steps() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Setup Complete! 🎉             ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo ""
    echo "1. Configure Google OAuth:"
    echo "   - Visit: https://console.cloud.google.com/apis/credentials"
    echo "   - Create OAuth 2.0 credentials"
    echo "   - Update GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in:"
    ENV_FILE="apps/web/.env.local"
    [[ "$ENVIRONMENT" == "production" ]] && ENV_FILE="apps/web/.env.production"
    echo "     $ENV_FILE"
    echo ""
    echo "2. Configure AI Provider (if skipped):"
    echo "   - Ollama (local): https://ollama.com/download"
    echo "   - Groq (cloud, free): https://console.groq.com/"
    echo "   - OpenAI: https://platform.openai.com/"
    echo ""
    echo "3. (Optional) Configure payment provider:"
    echo "   - Stripe: https://dashboard.stripe.com/apikeys"
    echo "   - LemonSqueezy: https://app.lemonsqueezy.com/settings/api"
    echo ""
    echo "4. Start the development server:"
    echo "   ${GREEN}npm run dev${NC}"
    echo ""
    echo "5. Open in browser:"
    echo "   ${BLUE}http://localhost:3000${NC}"
    echo ""

    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -e "${YELLOW}Production Setup:${NC}"
        echo "- Review security settings in $ENV_FILE"
        echo "- Update NEXTAUTH_URL to your domain"
        echo "- Configure SSL certificates"
        echo "- Set up monitoring (Sentry, PostHog)"
        echo "- Review deployment guide: docs/DEPLOYMENT_GUIDE.md"
        echo ""
    fi

    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  npm run dev          - Start development server"
    echo "  npm run build        - Build for production"
    echo "  npm run test         - Run tests"
    echo "  npm run lint         - Lint code"
    echo "  npm run type-check   - Check TypeScript types"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "  docs/USER_GUIDE_ORGANIZATIONS.md   - User guide"
    echo "  docs/ADMIN_GUIDE.md                - Admin guide"
    echo "  docs/API_DOCUMENTATION.md          - API reference"
    echo "  docs/DEPLOYMENT_GUIDE.md           - Deployment guide"
    echo ""
}

# Main setup flow
main() {
    echo ""

    # Vercel deployment flow
    if [[ "$DEPLOY_TARGET" == "vercel" ]]; then
        print_status "Setting up for Vercel deployment..."
        echo ""

        # Check Node.js
        if ! check_node_version; then
            print_warning "Node.js 18+ not found"
            install_node
        else
            print_success "Node.js: $(node -v)"
        fi

        # Setup Vercel CLI
        setup_vercel_cli

        # Setup cloud database
        setup_cloud_database

        # Setup cloud Redis
        setup_cloud_redis

        # Setup environment variables
        setup_env_file

        # Install dependencies
        install_dependencies

        # Deploy to Vercel
        deploy_to_vercel

        return 0
    fi

    # Local/self-hosted deployment flow
    print_status "Setting up for local/self-hosted deployment..."
    echo ""

    # Check prerequisites
    print_status "Checking prerequisites..."

    # Check/Install Node.js
    if ! check_node_version; then
        print_warning "Node.js 18+ not found"
        install_node
    else
        print_success "Node.js: $(node -v)"
    fi

    # Check/Install PostgreSQL
    if ! command_exists psql; then
        print_warning "PostgreSQL not found"

        if [[ "$ENVIRONMENT" == "production" ]]; then
            print_error "PostgreSQL is required. Please install it manually for production."
            exit 1
        fi

        read -p "Do you want to install PostgreSQL? (Y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            install_postgres
        else
            print_error "PostgreSQL is required. Exiting."
            exit 1
        fi
    else
        print_success "PostgreSQL found"
    fi

    # Setup database
    setup_database

    # Setup environment variables
    setup_env_file

    # Install dependencies
    install_dependencies

    # Run migrations
    run_migrations

    # Seed database (dev only)
    if [[ "$ENVIRONMENT" != "production" ]]; then
        seed_database
    fi

    # Setup Git hooks (dev only)
    if [[ "$ENVIRONMENT" != "production" ]]; then
        setup_git_hooks
    fi

    # Verify setup
    echo ""
    verify_setup

    # Print next steps
    print_next_steps

    # Save setup info
    cat > ".setup-info.txt" << EOF
EmailAI Setup Information
========================
Date: $(date)
Environment: $ENVIRONMENT
Node Version: $(node -v)
PostgreSQL: $(psql --version | head -n1)
Database: $DB_NAME
Database URL: $DATABASE_URL
EOF

    print_success "Setup information saved to .setup-info.txt"
}

# Handle script interruption
trap 'echo ""; print_error "Setup interrupted. You can re-run this script to continue."; exit 1' INT TERM

# Run main function
main

exit 0
