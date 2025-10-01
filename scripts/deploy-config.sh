#!/bin/bash

#############################################################################
# EmailAI Deployment Configuration Script
#
# This script collects all necessary configuration details for deploying
# EmailAI to production using the calldata.app domain structure.
#
# Architecture:
# - Vercel: Web application (emailai.calldata.app)
# - Neon/Supabase: PostgreSQL database
# - Upstash: Redis cache
# - Vast.ai/Self-hosted: Ollama AI server (ai.calldata.app)
# - Cloudflare: DNS and CDN
#
# Usage: bash scripts/deploy-config.sh
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Config file location
CONFIG_FILE="deployment.config"
ENV_FILE="apps/web/.env.production"

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════"
echo "   EmailAI Deployment Configuration Collector"
echo "   Domain Structure: calldata.app"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

#############################################################################
# Helper Functions
#############################################################################

prompt() {
    local var_name=$1
    local prompt_text=$2
    local default_value=$3
    local is_secret=$4

    if [ -n "$default_value" ]; then
        prompt_text="$prompt_text [${default_value}]"
    fi

    echo -e "${YELLOW}${prompt_text}:${NC}"

    if [ "$is_secret" = "true" ]; then
        read -s value
        echo ""
    else
        read value
    fi

    if [ -z "$value" ] && [ -n "$default_value" ]; then
        value=$default_value
    fi

    eval "$var_name='$value'"
}

generate_secret() {
    openssl rand -hex 32
}

confirm() {
    local prompt_text=$1
    echo -e "${YELLOW}${prompt_text} (y/n):${NC}"
    read -r response
    [[ "$response" =~ ^[Yy]$ ]]
}

section() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

save_config() {
    local key=$1
    local value=$2
    echo "${key}=\"${value}\"" >> "$CONFIG_FILE"
}

save_env() {
    local key=$1
    local value=$2
    echo "${key}=\"${value}\"" >> "$ENV_FILE"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}Error: $1 is not installed${NC}"
        echo "Please install $1 and try again"
        exit 1
    fi
}

#############################################################################
# Pre-flight Checks
#############################################################################

section "Pre-flight Checks"

echo "Checking required tools..."

REQUIRED_TOOLS=("vercel" "aws" "curl" "openssl" "jq")
MISSING_TOOLS=()

for tool in "${REQUIRED_TOOLS[@]}"; do
    if command -v $tool &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $tool installed"
    else
        echo -e "  ${RED}✗${NC} $tool not installed"
        MISSING_TOOLS+=($tool)
    fi
done

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}Missing tools detected. Install them with:${NC}"
    echo ""
    for tool in "${MISSING_TOOLS[@]}"; do
        case $tool in
            vercel)
                echo "  npm install -g vercel"
                ;;
            aws)
                echo "  # macOS: brew install awscli"
                echo "  # Linux: sudo apt install awscli"
                ;;
            jq)
                echo "  # macOS: brew install jq"
                echo "  # Linux: sudo apt install jq"
                ;;
            *)
                echo "  $tool - please install manually"
                ;;
        esac
    done
    echo ""

    if ! confirm "Continue anyway? (Some features may not work)"; then
        exit 1
    fi
fi

# Create backup of existing config
if [ -f "$CONFIG_FILE" ]; then
    echo ""
    if confirm "Existing config found. Create backup?"; then
        cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%s)"
        echo -e "${GREEN}Backup created${NC}"
    fi
    rm -f "$CONFIG_FILE"
fi

# Initialize config files
touch "$CONFIG_FILE"
mkdir -p apps/web
touch "$ENV_FILE"

echo ""
echo -e "${GREEN}All checks passed. Starting configuration...${NC}"

#############################################################################
# 1. Domain Configuration
#############################################################################

section "1. Domain Configuration"

echo "We'll be setting up the following domains:"
echo "  - emailai.calldata.app (Web application)"
echo "  - api.calldata.app (API gateway)"
echo "  - ai.calldata.app (Ollama AI server)"
echo "  - docs.calldata.app (Documentation)"
echo "  - status.calldata.app (Status page)"
echo ""

prompt DOMAIN_ROOT "Enter root domain" "calldata.app" false
prompt PRODUCT_NAME "Enter product subdomain" "emailai" false

WEB_DOMAIN="${PRODUCT_NAME}.${DOMAIN_ROOT}"
API_DOMAIN="api.${DOMAIN_ROOT}"
AI_DOMAIN="ai.${DOMAIN_ROOT}"
DOCS_DOMAIN="docs.${DOMAIN_ROOT}"
STATUS_DOMAIN="status.${DOMAIN_ROOT}"

echo ""
echo "Configured domains:"
echo "  - Web: https://${WEB_DOMAIN}"
echo "  - API: https://${API_DOMAIN}"
echo "  - AI:  https://${AI_DOMAIN}"
echo ""

save_config "DOMAIN_ROOT" "$DOMAIN_ROOT"
save_config "PRODUCT_NAME" "$PRODUCT_NAME"
save_config "WEB_DOMAIN" "$WEB_DOMAIN"
save_config "API_DOMAIN" "$API_DOMAIN"
save_config "AI_DOMAIN" "$AI_DOMAIN"

save_env "NEXTAUTH_URL" "https://${WEB_DOMAIN}"

#############################################################################
# 2. Vercel Configuration
#############################################################################

section "2. Vercel Configuration"

echo "Checking Vercel authentication..."

if vercel whoami &> /dev/null; then
    VERCEL_USER=$(vercel whoami 2>/dev/null | tail -n 1)
    echo -e "${GREEN}✓ Logged in as: ${VERCEL_USER}${NC}"
else
    echo -e "${YELLOW}Not logged in to Vercel${NC}"
    if confirm "Login to Vercel now?"; then
        vercel login
        VERCEL_USER=$(vercel whoami 2>/dev/null | tail -n 1)
    else
        echo -e "${RED}Vercel login required for deployment${NC}"
        exit 1
    fi
fi

echo ""
prompt VERCEL_PROJECT_NAME "Vercel project name" "emailai" false
prompt VERCEL_ORG "Vercel organization/team (leave empty for personal)" "" false

save_config "VERCEL_USER" "$VERCEL_USER"
save_config "VERCEL_PROJECT_NAME" "$VERCEL_PROJECT_NAME"
save_config "VERCEL_ORG" "$VERCEL_ORG"

# Check if project exists
echo ""
echo "Checking if Vercel project exists..."
if [ -n "$VERCEL_ORG" ]; then
    VERCEL_PROJECT_EXISTS=$(vercel projects ls --scope "$VERCEL_ORG" 2>/dev/null | grep -w "$VERCEL_PROJECT_NAME" || echo "")
else
    VERCEL_PROJECT_EXISTS=$(vercel projects ls 2>/dev/null | grep -w "$VERCEL_PROJECT_NAME" || echo "")
fi

if [ -n "$VERCEL_PROJECT_EXISTS" ]; then
    echo -e "${GREEN}✓ Project '${VERCEL_PROJECT_NAME}' found${NC}"
    save_config "VERCEL_PROJECT_EXISTS" "true"
else
    echo -e "${YELLOW}✗ Project '${VERCEL_PROJECT_NAME}' not found${NC}"
    echo "  Will be created during deployment"
    save_config "VERCEL_PROJECT_EXISTS" "false"
fi

#############################################################################
# 3. Database Configuration (Neon/Supabase/AWS RDS)
#############################################################################

section "3. Database Configuration"

echo "Choose your database provider:"
echo "  1) Neon (Recommended - Free tier available)"
echo "  2) Supabase (Recommended - Free tier available)"
echo "  3) AWS RDS (Self-managed, more expensive)"
echo "  4) Custom PostgreSQL URL"
echo ""

prompt DB_PROVIDER "Select database provider (1-4)" "1" false

case $DB_PROVIDER in
    1)
        echo ""
        echo -e "${BLUE}Neon Setup:${NC}"
        echo "  1. Go to https://neon.tech"
        echo "  2. Create account and new project"
        echo "  3. Copy connection string"
        echo ""
        prompt DATABASE_URL "Enter Neon connection string" "" true
        save_config "DB_PROVIDER" "neon"
        ;;
    2)
        echo ""
        echo -e "${BLUE}Supabase Setup:${NC}"
        echo "  1. Go to https://supabase.com"
        echo "  2. Create account and new project"
        echo "  3. Go to Settings > Database"
        echo "  4. Copy connection string (URI format)"
        echo ""
        prompt DATABASE_URL "Enter Supabase connection string" "" true
        save_config "DB_PROVIDER" "supabase"
        ;;
    3)
        echo ""
        echo -e "${BLUE}AWS RDS Configuration${NC}"
        if confirm "Create new RDS instance?"; then
            save_config "DB_PROVIDER" "aws_rds"
            save_config "DB_CREATE_NEW" "true"

            prompt AWS_REGION "AWS Region" "us-east-1" false
            prompt RDS_INSTANCE_CLASS "RDS instance class" "db.t3.small" false
            prompt RDS_DB_NAME "Database name" "emailai" false
            prompt RDS_USERNAME "Database username" "emailai" false
            prompt RDS_PASSWORD "Database password" "" true

            save_config "AWS_REGION" "$AWS_REGION"
            save_config "RDS_INSTANCE_CLASS" "$RDS_INSTANCE_CLASS"
            save_config "RDS_DB_NAME" "$RDS_DB_NAME"
            save_config "RDS_USERNAME" "$RDS_USERNAME"
            save_config "RDS_PASSWORD" "$RDS_PASSWORD"

            # Will be created during deployment
            DATABASE_URL="postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@WILL_BE_CREATED/${RDS_DB_NAME}"
        else
            prompt DATABASE_URL "Enter existing RDS connection string" "" true
            save_config "DB_PROVIDER" "aws_rds"
            save_config "DB_CREATE_NEW" "false"
        fi
        ;;
    4)
        echo ""
        prompt DATABASE_URL "Enter PostgreSQL connection string" "" true
        save_config "DB_PROVIDER" "custom"
        ;;
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

save_env "DATABASE_URL" "$DATABASE_URL"
save_env "DIRECT_URL" "$DATABASE_URL"

#############################################################################
# 4. Redis Configuration (Upstash/AWS ElastiCache)
#############################################################################

section "4. Redis Configuration"

echo "Choose your Redis provider:"
echo "  1) Upstash (Recommended - Free tier available)"
echo "  2) AWS ElastiCache"
echo "  3) Custom Redis URL"
echo ""

prompt REDIS_PROVIDER "Select Redis provider (1-3)" "1" false

case $REDIS_PROVIDER in
    1)
        echo ""
        echo -e "${BLUE}Upstash Setup:${NC}"
        echo "  1. Go to https://upstash.com"
        echo "  2. Create account and new database"
        echo "  3. Copy REST URL and token"
        echo ""
        prompt UPSTASH_REDIS_URL "Enter Upstash REST URL" "" false
        prompt UPSTASH_REDIS_TOKEN "Enter Upstash token" "" true

        save_config "REDIS_PROVIDER" "upstash"
        save_env "UPSTASH_REDIS_URL" "$UPSTASH_REDIS_URL"
        save_env "UPSTASH_REDIS_TOKEN" "$UPSTASH_REDIS_TOKEN"
        ;;
    2)
        echo ""
        echo -e "${BLUE}AWS ElastiCache Configuration${NC}"
        if confirm "Create new ElastiCache cluster?"; then
            save_config "REDIS_PROVIDER" "aws_elasticache"
            save_config "REDIS_CREATE_NEW" "true"

            prompt ELASTICACHE_NODE_TYPE "ElastiCache node type" "cache.t3.micro" false
            save_config "ELASTICACHE_NODE_TYPE" "$ELASTICACHE_NODE_TYPE"

            # Will be created during deployment
            UPSTASH_REDIS_URL="redis://WILL_BE_CREATED:6379"
        else
            prompt UPSTASH_REDIS_URL "Enter ElastiCache endpoint" "" false
            save_config "REDIS_PROVIDER" "aws_elasticache"
            save_config "REDIS_CREATE_NEW" "false"
        fi

        save_env "UPSTASH_REDIS_URL" "$UPSTASH_REDIS_URL"
        save_env "UPSTASH_REDIS_TOKEN" "not-needed-for-elasticache"
        ;;
    3)
        echo ""
        prompt UPSTASH_REDIS_URL "Enter Redis URL" "" false
        prompt UPSTASH_REDIS_TOKEN "Enter Redis token (if needed)" "" true

        save_config "REDIS_PROVIDER" "custom"
        save_env "UPSTASH_REDIS_URL" "$UPSTASH_REDIS_URL"
        save_env "UPSTASH_REDIS_TOKEN" "$UPSTASH_REDIS_TOKEN"
        ;;
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

#############################################################################
# 5. AI Server Configuration (Ollama)
#############################################################################

section "5. AI Server Configuration (Ollama)"

echo "Choose your AI server deployment:"
echo "  1) Vast.ai (Recommended - GPU rental, ~\$84-250/month)"
echo "  2) Self-hosted (Your own server/GPU)"
echo "  3) AWS EC2 with GPU (~\$350-3000/month)"
echo "  4) Skip for now (use cloud APIs like OpenAI)"
echo ""

prompt AI_PROVIDER "Select AI provider (1-4)" "1" false

case $AI_PROVIDER in
    1)
        echo ""
        echo -e "${BLUE}Vast.ai Setup:${NC}"
        echo "  1. Go to https://vast.ai"
        echo "  2. Create account and rent instance"
        echo "  3. Choose GPU (RTX 4090 recommended)"
        echo "  4. SSH to instance and run: cd emailai/ollama-server/scripts && sudo bash setup.sh prod"
        echo ""

        if confirm "Have you already set up Vast.ai instance?"; then
            prompt VAST_AI_IP "Enter Vast.ai instance IP" "" false
            prompt VAST_AI_PORT "Enter Ollama port" "11434" false

            OLLAMA_BASE_URL="http://${VAST_AI_IP}:${VAST_AI_PORT}/api"

            save_config "AI_PROVIDER" "vastai"
            save_config "VAST_AI_IP" "$VAST_AI_IP"
            save_config "VAST_AI_PORT" "$VAST_AI_PORT"
        else
            echo ""
            echo -e "${YELLOW}Vast.ai setup instructions saved to deployment guide${NC}"
            echo "Run this script again after setting up Vast.ai"

            OLLAMA_BASE_URL="http://VAST_AI_IP:11434/api"
            save_config "AI_PROVIDER" "vastai"
            save_config "AI_SETUP_PENDING" "true"
        fi
        ;;
    2)
        echo ""
        prompt OLLAMA_HOST "Enter Ollama server IP/hostname" "" false
        prompt OLLAMA_PORT "Enter Ollama port" "11434" false

        OLLAMA_BASE_URL="http://${OLLAMA_HOST}:${OLLAMA_PORT}/api"

        save_config "AI_PROVIDER" "self_hosted"
        save_config "OLLAMA_HOST" "$OLLAMA_HOST"
        save_config "OLLAMA_PORT" "$OLLAMA_PORT"
        ;;
    3)
        echo ""
        echo -e "${BLUE}AWS EC2 GPU Configuration${NC}"
        if confirm "Create new EC2 GPU instance?"; then
            save_config "AI_PROVIDER" "aws_ec2"
            save_config "AI_CREATE_NEW" "true"

            prompt EC2_INSTANCE_TYPE "EC2 instance type" "g4dn.xlarge" false
            prompt EC2_KEY_NAME "EC2 SSH key name" "" false

            save_config "EC2_INSTANCE_TYPE" "$EC2_INSTANCE_TYPE"
            save_config "EC2_KEY_NAME" "$EC2_KEY_NAME"

            OLLAMA_BASE_URL="http://WILL_BE_CREATED:11434/api"
        else
            prompt OLLAMA_HOST "Enter EC2 instance IP" "" false
            OLLAMA_BASE_URL="http://${OLLAMA_HOST}:11434/api"

            save_config "AI_PROVIDER" "aws_ec2"
            save_config "AI_CREATE_NEW" "false"
            save_config "OLLAMA_HOST" "$OLLAMA_HOST"
        fi
        ;;
    4)
        echo ""
        echo -e "${YELLOW}Skipping Ollama setup${NC}"
        echo "You'll need to configure a cloud AI provider (OpenAI, Anthropic, etc.)"

        OLLAMA_BASE_URL=""
        save_config "AI_PROVIDER" "cloud"
        save_config "AI_SETUP_PENDING" "true"
        ;;
    *)
        echo -e "${RED}Invalid selection${NC}"
        exit 1
        ;;
esac

if [ -n "$OLLAMA_BASE_URL" ]; then
    # If using ai.calldata.app domain
    if confirm "Use ai.${DOMAIN_ROOT} domain for Ollama? (Requires DNS setup)"; then
        OLLAMA_BASE_URL="https://${AI_DOMAIN}/api"
        save_config "AI_USE_CUSTOM_DOMAIN" "true"
    fi

    save_env "OLLAMA_BASE_URL" "$OLLAMA_BASE_URL"

    prompt OLLAMA_MODEL "Ollama model to use" "llama3.3:70b" false
    save_env "NEXT_PUBLIC_OLLAMA_MODEL" "$OLLAMA_MODEL"
    save_env "DEFAULT_LLM_PROVIDER" "ollama"
else
    # Configure cloud AI provider
    echo ""
    echo "Configure cloud AI provider:"
    echo "  1) OpenAI"
    echo "  2) Anthropic"
    echo "  3) Groq (Recommended - Fast & cheap)"
    echo ""
    prompt CLOUD_AI_PROVIDER "Select provider (1-3)" "3" false

    case $CLOUD_AI_PROVIDER in
        1)
            prompt OPENAI_API_KEY "Enter OpenAI API key" "" true
            save_env "OPENAI_API_KEY" "$OPENAI_API_KEY"
            save_env "DEFAULT_LLM_PROVIDER" "openai"
            ;;
        2)
            prompt ANTHROPIC_API_KEY "Enter Anthropic API key" "" true
            save_env "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"
            save_env "DEFAULT_LLM_PROVIDER" "anthropic"
            ;;
        3)
            prompt GROQ_API_KEY "Enter Groq API key" "" true
            save_env "GROQ_API_KEY" "$GROQ_API_KEY"
            save_env "DEFAULT_LLM_PROVIDER" "groq"
            ;;
    esac
fi

#############################################################################
# 6. Google OAuth Configuration
#############################################################################

section "6. Google OAuth Configuration"

echo "Google OAuth setup is required for Gmail integration"
echo ""
echo "Setup steps:"
echo "  1. Go to https://console.cloud.google.com/apis/credentials"
echo "  2. Create OAuth 2.0 Client ID"
echo "  3. Add authorized redirect URIs:"
echo "     - http://localhost:3000/api/auth/callback/google"
echo "     - https://${WEB_DOMAIN}/api/auth/callback/google"
echo "  4. Copy Client ID and Secret"
echo ""

if confirm "Have you completed Google OAuth setup?"; then
    prompt GOOGLE_CLIENT_ID "Enter Google Client ID" "" false
    prompt GOOGLE_CLIENT_SECRET "Enter Google Client Secret" "" true

    save_env "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
    save_env "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"

    # Generate encryption keys
    echo ""
    echo "Generating encryption keys..."
    GOOGLE_ENCRYPT_SECRET=$(generate_secret)
    GOOGLE_ENCRYPT_SALT=$(openssl rand -hex 16)

    save_env "GOOGLE_ENCRYPT_SECRET" "$GOOGLE_ENCRYPT_SECRET"
    save_env "GOOGLE_ENCRYPT_SALT" "$GOOGLE_ENCRYPT_SALT"

    echo -e "${GREEN}✓ Encryption keys generated${NC}"
else
    echo ""
    echo -e "${YELLOW}Google OAuth setup is required before deployment${NC}"
    echo "Please complete the setup and run this script again"

    save_config "GOOGLE_OAUTH_PENDING" "true"
fi

#############################################################################
# 7. Google PubSub Configuration
#############################################################################

section "7. Google PubSub Configuration (Optional)"

echo "Google PubSub enables real-time email updates"
echo ""

if confirm "Configure Google PubSub?"; then
    echo ""
    echo "Setup steps:"
    echo "  1. Go to https://console.cloud.google.com/cloudpubsub"
    echo "  2. Create topic (e.g., emailai-gmail-webhook)"
    echo "  3. Copy topic name (format: projects/PROJECT_ID/topics/TOPIC_NAME)"
    echo ""

    prompt GOOGLE_PUBSUB_TOPIC_NAME "Enter PubSub topic name" "" false

    echo ""
    echo "Generating verification token..."
    GOOGLE_PUBSUB_TOKEN=$(generate_secret)

    save_env "GOOGLE_PUBSUB_TOPIC_NAME" "$GOOGLE_PUBSUB_TOPIC_NAME"
    save_env "GOOGLE_PUBSUB_VERIFICATION_TOKEN" "$GOOGLE_PUBSUB_TOKEN"

    echo -e "${GREEN}✓ PubSub configured${NC}"
else
    echo -e "${YELLOW}Skipping PubSub setup (can be configured later)${NC}"
fi

#############################################################################
# 8. Security & Secrets
#############################################################################

section "8. Security & Secrets"

echo "Generating security secrets..."

NEXTAUTH_SECRET=$(generate_secret)
INTERNAL_API_KEY=$(generate_secret)
API_KEY_SALT=$(generate_secret)

save_env "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"
save_env "INTERNAL_API_KEY" "$INTERNAL_API_KEY"
save_env "API_KEY_SALT" "$API_KEY_SALT"

echo -e "${GREEN}✓ Security secrets generated${NC}"

#############################################################################
# 9. Optional Services
#############################################################################

section "9. Optional Services"

# Monitoring
if confirm "Configure monitoring? (Sentry, PostHog, Axiom)"; then
    echo ""
    echo "Sentry (Error tracking):"
    if confirm "  Configure Sentry?"; then
        prompt SENTRY_DSN "Enter Sentry DSN" "" false
        save_env "NEXT_PUBLIC_SENTRY_DSN" "$SENTRY_DSN"
    fi

    echo ""
    echo "PostHog (Analytics):"
    if confirm "  Configure PostHog?"; then
        prompt POSTHOG_KEY "Enter PostHog API key" "" false
        save_env "NEXT_PUBLIC_POSTHOG_KEY" "$POSTHOG_KEY"
    fi

    echo ""
    echo "Axiom (Logging):"
    if confirm "  Configure Axiom?"; then
        prompt AXIOM_DATASET "Enter Axiom dataset name" "" false
        prompt AXIOM_TOKEN "Enter Axiom token" "" true
        save_env "NEXT_PUBLIC_AXIOM_DATASET" "$AXIOM_DATASET"
        save_env "NEXT_PUBLIC_AXIOM_TOKEN" "$AXIOM_TOKEN"
    fi
fi

# Email services
if confirm "Configure email services? (Resend, Loops)"; then
    echo ""
    echo "Resend (Transactional emails):"
    if confirm "  Configure Resend?"; then
        prompt RESEND_API_KEY "Enter Resend API key" "" true
        save_env "RESEND_API_KEY" "$RESEND_API_KEY"
    fi

    echo ""
    echo "Loops (Marketing emails):"
    if confirm "  Configure Loops?"; then
        prompt LOOPS_API_SECRET "Enter Loops API secret" "" true
        save_env "LOOPS_API_SECRET" "$LOOPS_API_SECRET"
    fi
fi

#############################################################################
# 10. DNS Configuration
#############################################################################

section "10. DNS Configuration"

echo "DNS provider for ${DOMAIN_ROOT}:"
echo "  1) Cloudflare (Recommended - Free SSL, CDN)"
echo "  2) AWS Route 53"
echo "  3) Other (Namecheap, GoDaddy, etc.)"
echo ""

prompt DNS_PROVIDER "Select DNS provider (1-3)" "1" false

case $DNS_PROVIDER in
    1)
        save_config "DNS_PROVIDER" "cloudflare"
        echo ""
        echo -e "${BLUE}Cloudflare DNS Setup:${NC}"
        echo "  1. Add ${DOMAIN_ROOT} to Cloudflare"
        echo "  2. Update nameservers at your registrar"
        echo "  3. Add CNAME record:"
        echo "     Name: ${PRODUCT_NAME}"
        echo "     Target: cname.vercel-dns.com"
        echo "     Proxy: Enabled (orange cloud)"
        echo ""

        if confirm "Configure Cloudflare API for automatic DNS?"; then
            prompt CLOUDFLARE_API_TOKEN "Enter Cloudflare API token" "" true
            prompt CLOUDFLARE_ZONE_ID "Enter Cloudflare zone ID" "" false

            save_config "CLOUDFLARE_API_TOKEN" "$CLOUDFLARE_API_TOKEN"
            save_config "CLOUDFLARE_ZONE_ID" "$CLOUDFLARE_ZONE_ID"
            save_config "DNS_AUTO_CONFIGURE" "true"
        else
            save_config "DNS_AUTO_CONFIGURE" "false"
        fi
        ;;
    2)
        save_config "DNS_PROVIDER" "route53"
        echo ""
        echo -e "${BLUE}Route 53 DNS Setup:${NC}"
        echo "  1. Create hosted zone for ${DOMAIN_ROOT}"
        echo "  2. Update nameservers at your registrar"
        echo "  3. Deployment script will create records"
        echo ""

        if confirm "AWS CLI configured?"; then
            save_config "DNS_AUTO_CONFIGURE" "true"
        else
            echo "Please run: aws configure"
            save_config "DNS_AUTO_CONFIGURE" "false"
        fi
        ;;
    3)
        save_config "DNS_PROVIDER" "other"
        save_config "DNS_AUTO_CONFIGURE" "false"
        echo ""
        echo -e "${YELLOW}Manual DNS configuration required${NC}"
        echo "Add this CNAME record at your DNS provider:"
        echo "  Name: ${PRODUCT_NAME}"
        echo "  Type: CNAME"
        echo "  Value: cname.vercel-dns.com"
        echo ""
        ;;
esac

#############################################################################
# 11. Summary & Validation
#############################################################################

section "Configuration Summary"

echo "Domain Configuration:"
echo "  Web Application: https://${WEB_DOMAIN}"
echo "  API Gateway:     https://${API_DOMAIN}"
echo "  AI Server:       https://${AI_DOMAIN}"
echo ""

echo "Services:"
echo "  Web Hosting:     Vercel"
echo "  Database:        ${DB_PROVIDER}"
echo "  Redis:           ${REDIS_PROVIDER}"
echo "  AI Provider:     ${AI_PROVIDER}"
echo "  DNS:             ${DNS_PROVIDER}"
echo ""

echo "Configuration files created:"
echo "  ✓ ${CONFIG_FILE}"
echo "  ✓ ${ENV_FILE}"
echo ""

# Check for pending setups
PENDING_SETUPS=()
grep -q "PENDING" "$CONFIG_FILE" && PENDING_SETUPS+=("Pending configurations detected")
grep -q "WILL_BE_CREATED" "$ENV_FILE" && PENDING_SETUPS+=("Services need to be created")

if [ ${#PENDING_SETUPS[@]} -ne 0 ]; then
    echo -e "${YELLOW}⚠ Pending Setup Items:${NC}"
    for item in "${PENDING_SETUPS[@]}"; do
        echo "  - $item"
    done
    echo ""
fi

#############################################################################
# 12. Next Steps
#############################################################################

section "Next Steps"

echo "Configuration complete! To deploy:"
echo ""
echo "1. Review configuration:"
echo "   cat ${CONFIG_FILE}"
echo "   cat ${ENV_FILE}"
echo ""
echo "2. Run deployment script:"
echo "   bash scripts/deploy.sh"
echo ""
echo "3. Or deploy manually:"
echo "   vercel --prod"
echo ""

if [ -f "scripts/deploy.sh" ]; then
    echo ""
    if confirm "Run deployment script now?"; then
        bash scripts/deploy.sh
    fi
else
    echo -e "${YELLOW}Deployment script not found${NC}"
    echo "Run: bash scripts/deploy.sh (after creating it)"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Configuration complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
