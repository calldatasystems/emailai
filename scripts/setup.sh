#!/bin/bash

# EmailAI - One-Command Setup Script
# Usage: ./scripts/setup.sh [--production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine environment
ENVIRONMENT="development"
if [[ "$1" == "--production" ]]; then
    ENVIRONMENT="production"
fi

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EmailAI Setup Script ($ENVIRONMENT)   ║${NC}"
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
        GOOGLE_CLIENT_ID=$(prompt_with_default "Google Client ID" "")
        GOOGLE_CLIENT_SECRET=$(prompt_with_default "Google Client Secret" "" true)
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
        STRIPE_SECRET_KEY=$(prompt_with_default "Stripe Secret Key" "sk_test_..." true)
        STRIPE_PUBLISHABLE_KEY=$(prompt_with_default "Stripe Publishable Key" "pk_test_...")
        STRIPE_WEBHOOK_SECRET=$(prompt_with_default "Stripe Webhook Secret" "whsec_..." true)
    elif [ "$payment_choice" = "2" ]; then
        echo ""
        echo "To get LemonSqueezy credentials:"
        echo "  1. Sign up at: https://app.lemonsqueezy.com/register"
        echo "  2. Go to Settings → API"
        echo "  3. Create a new API key"
        echo ""
        LEMON_SQUEEZY_API_KEY=$(prompt_with_default "LemonSqueezy API Key" "" true)
        LEMON_SQUEEZY_STORE_ID=$(prompt_with_default "LemonSqueezy Store ID" "")
        LEMON_SQUEEZY_WEBHOOK_SECRET=$(prompt_with_default "LemonSqueezy Webhook Secret" "" true)
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
        RESEND_API_KEY=$(prompt_with_default "Resend API Key" "re_..." true)
        RESEND_FROM_EMAIL=$(prompt_with_default "From Email Address" "noreply@${NEXTAUTH_URL#*://}")
    fi
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
            SENTRY_DSN=$(prompt_with_default "Sentry DSN" "https://xxx@sentry.io/xxx")
        fi

        echo ""
        echo "PostHog - Product analytics"
        echo "Sign up at: https://posthog.com/signup"
        echo ""
        read -p "Configure PostHog? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            POSTHOG_KEY=$(prompt_with_default "PostHog Project API Key" "phc_...")
            POSTHOG_HOST=$(prompt_with_default "PostHog Host" "https://app.posthog.com")
        fi
    fi
    echo ""

    # Additional Settings
    LOG_LEVEL=$(prompt_with_default "Log level (debug/info/warn/error)" "info")

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

# ━━━ Optional Services ━━━
# Uncomment and configure as needed

# Redis (for caching and rate limiting)
# REDIS_URL="redis://localhost:6379"
# UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
# UPSTASH_REDIS_REST_TOKEN="xxx"

# Axiom (logging)
# AXIOM_TOKEN="xxx"
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
    echo "2. (Optional) Configure payment provider:"
    echo "   - Stripe: https://dashboard.stripe.com/apikeys"
    echo "   - LemonSqueezy: https://app.lemonsqueezy.com/settings/api"
    echo ""
    echo "3. Start the development server:"
    echo "   ${GREEN}npm run dev${NC}"
    echo ""
    echo "4. Open in browser:"
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
