#!/bin/bash

#############################################################################
# EmailAI Deployment Script
#
# This script deploys EmailAI to production using the configuration
# collected by deploy-config.sh
#
# Prerequisites:
# 1. Run: bash scripts/deploy-config.sh
# 2. Ensure deployment.config and apps/web/.env.production exist
#
# Usage: bash scripts/deploy.sh
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE="deployment.config"
ENV_FILE="apps/web/.env.production"
LOG_FILE="deployment.log"

# Start logging
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo -e "${BLUE}"
echo "════════════════════════════════════════════════════════════════"
echo "   EmailAI Production Deployment"
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

#############################################################################
# Helper Functions
#############################################################################

section() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

error() {
    echo -e "${RED}Error: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

confirm() {
    local prompt_text=$1
    echo -e "${YELLOW}${prompt_text} (y/n):${NC}"
    read -r response
    [[ "$response" =~ ^[Yy]$ ]]
}

load_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        error "Configuration file not found. Run: bash scripts/deploy-config.sh"
    fi
    source "$CONFIG_FILE"
    success "Configuration loaded"
}

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file not found. Run: bash scripts/deploy-config.sh"
    fi
    success "Environment file found"
}

#############################################################################
# Pre-flight Checks
#############################################################################

section "Pre-flight Checks"

load_config
check_env_file

# Check required tools
echo "Checking required tools..."
MISSING_TOOLS=()

if ! command -v vercel &> /dev/null; then
    MISSING_TOOLS+=("vercel")
fi

if [ "$DB_PROVIDER" = "aws_rds" ] || [ "$REDIS_PROVIDER" = "aws_elasticache" ] || [ "$AI_PROVIDER" = "aws_ec2" ]; then
    if ! command -v aws &> /dev/null; then
        MISSING_TOOLS+=("aws")
    fi
fi

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
    error "Missing required tools: ${MISSING_TOOLS[*]}"
fi

success "All required tools installed"

# Verify authentication
echo ""
echo "Verifying authentication..."

if ! vercel whoami &> /dev/null; then
    error "Not logged in to Vercel. Run: vercel login"
fi
success "Vercel: authenticated"

if [ "$DB_PROVIDER" = "aws_rds" ] || [ "$REDIS_PROVIDER" = "aws_elasticache" ] || [ "$AI_PROVIDER" = "aws_ec2" ]; then
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured. Run: aws configure"
    fi
    success "AWS: authenticated"
fi

#############################################################################
# 1. Database Provisioning
#############################################################################

section "1. Database Provisioning"

if [ "$DB_PROVIDER" = "aws_rds" ] && [ "$DB_CREATE_NEW" = "true" ]; then
    info "Creating AWS RDS PostgreSQL instance..."

    # Check if instance already exists
    if aws rds describe-db-instances --db-instance-identifier emailai-db &> /dev/null; then
        warning "RDS instance 'emailai-db' already exists"
        if ! confirm "Use existing instance?"; then
            error "Deployment cancelled"
        fi
    else
        echo "Creating RDS instance (this may take 5-10 minutes)..."

        aws rds create-db-instance \
            --db-instance-identifier emailai-db \
            --db-instance-class "$RDS_INSTANCE_CLASS" \
            --engine postgres \
            --engine-version 14.7 \
            --master-username "$RDS_USERNAME" \
            --master-user-password "$RDS_PASSWORD" \
            --allocated-storage 20 \
            --backup-retention-period 7 \
            --no-publicly-accessible \
            --tags "Key=Application,Value=EmailAI" \
            --region "$AWS_REGION"

        echo "Waiting for RDS instance to be available..."
        aws rds wait db-instance-available --db-instance-identifier emailai-db --region "$AWS_REGION"

        success "RDS instance created"
    fi

    # Get endpoint
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier emailai-db \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)

    # Update DATABASE_URL in env file
    NEW_DATABASE_URL="postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_ENDPOINT}:5432/${RDS_DB_NAME}"
    sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=\"${NEW_DATABASE_URL}\"|g" "$ENV_FILE"
    sed -i.bak "s|DIRECT_URL=.*|DIRECT_URL=\"${NEW_DATABASE_URL}\"|g" "$ENV_FILE"

    success "RDS endpoint: $RDS_ENDPOINT"
else
    info "Using existing database: ${DB_PROVIDER}"
fi

#############################################################################
# 2. Redis Provisioning
#############################################################################

section "2. Redis Provisioning"

if [ "$REDIS_PROVIDER" = "aws_elasticache" ] && [ "$REDIS_CREATE_NEW" = "true" ]; then
    info "Creating AWS ElastiCache Redis cluster..."

    # Check if cluster already exists
    if aws elasticache describe-cache-clusters --cache-cluster-id emailai-redis &> /dev/null 2>&1; then
        warning "ElastiCache cluster 'emailai-redis' already exists"
        if ! confirm "Use existing cluster?"; then
            error "Deployment cancelled"
        fi
    else
        echo "Creating ElastiCache cluster..."

        aws elasticache create-cache-cluster \
            --cache-cluster-id emailai-redis \
            --cache-node-type "$ELASTICACHE_NODE_TYPE" \
            --engine redis \
            --num-cache-nodes 1 \
            --region "$AWS_REGION"

        echo "Waiting for ElastiCache cluster to be available..."
        aws elasticache wait cache-cluster-available --cache-cluster-id emailai-redis --region "$AWS_REGION"

        success "ElastiCache cluster created"
    fi

    # Get endpoint
    REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
        --cache-cluster-id emailai-redis \
        --region "$AWS_REGION" \
        --show-cache-node-info \
        --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' \
        --output text)

    # Update REDIS_URL in env file
    NEW_REDIS_URL="redis://${REDIS_ENDPOINT}:6379"
    sed -i.bak "s|UPSTASH_REDIS_URL=.*|UPSTASH_REDIS_URL=\"${NEW_REDIS_URL}\"|g" "$ENV_FILE"

    success "ElastiCache endpoint: $REDIS_ENDPOINT"
else
    info "Using existing Redis: ${REDIS_PROVIDER}"
fi

#############################################################################
# 3. AI Server Provisioning
#############################################################################

section "3. AI Server Provisioning"

if [ "$AI_PROVIDER" = "aws_ec2" ] && [ "$AI_CREATE_NEW" = "true" ]; then
    info "Creating AWS EC2 instance for Ollama..."

    # Check if instance already exists
    EXISTING_INSTANCE=$(aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=emailai-ollama" "Name=instance-state-name,Values=running" \
        --region "$AWS_REGION" \
        --query 'Reservations[0].Instances[0].InstanceId' \
        --output text 2>/dev/null)

    if [ "$EXISTING_INSTANCE" != "None" ] && [ -n "$EXISTING_INSTANCE" ]; then
        warning "EC2 instance for Ollama already exists: $EXISTING_INSTANCE"
        if ! confirm "Use existing instance?"; then
            error "Deployment cancelled"
        fi
        INSTANCE_ID=$EXISTING_INSTANCE
    else
        # Get latest Ubuntu AMI
        AMI_ID=$(aws ec2 describe-images \
            --owners 099720109477 \
            --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
            --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
            --output text \
            --region "$AWS_REGION")

        echo "Launching EC2 instance with GPU..."

        INSTANCE_ID=$(aws ec2 run-instances \
            --image-id "$AMI_ID" \
            --instance-type "$EC2_INSTANCE_TYPE" \
            --key-name "$EC2_KEY_NAME" \
            --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100}}]' \
            --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=emailai-ollama},{Key=Application,Value=EmailAI}]' \
            --region "$AWS_REGION" \
            --query 'Instances[0].InstanceId' \
            --output text)

        echo "Waiting for instance to be running..."
        aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$AWS_REGION"

        success "EC2 instance created: $INSTANCE_ID"
    fi

    # Get instance IP
    EC2_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --region "$AWS_REGION" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)

    # Update OLLAMA_BASE_URL
    if [ "$AI_USE_CUSTOM_DOMAIN" = "true" ]; then
        info "Using custom domain: https://${AI_DOMAIN}/api"
        info "Remember to configure DNS to point to: $EC2_IP"
    else
        NEW_OLLAMA_URL="http://${EC2_IP}:11434/api"
        sed -i.bak "s|OLLAMA_BASE_URL=.*|OLLAMA_BASE_URL=\"${NEW_OLLAMA_URL}\"|g" "$ENV_FILE"
        success "Ollama URL: $NEW_OLLAMA_URL"
    fi

    # Print setup instructions
    echo ""
    warning "Manual Ollama setup required on EC2 instance:"
    echo "  1. SSH to instance: ssh -i ${EC2_KEY_NAME}.pem ubuntu@${EC2_IP}"
    echo "  2. Clone repo: git clone https://github.com/your-org/emailai.git"
    echo "  3. Setup Ollama: cd emailai/ollama-server/scripts && sudo bash setup.sh prod"
    echo ""

elif [ "$AI_PROVIDER" = "vastai" ] && [ "$AI_SETUP_PENDING" = "true" ]; then
    warning "Vast.ai setup required:"
    echo "  1. Go to https://vast.ai"
    echo "  2. Rent GPU instance (RTX 4090 recommended)"
    echo "  3. SSH to instance"
    echo "  4. Run: cd emailai/ollama-server/scripts && sudo bash setup.sh prod"
    echo "  5. Update DNS to point ${AI_DOMAIN} to Vast.ai IP"
    echo ""
else
    info "Using existing AI server: ${AI_PROVIDER}"
fi

#############################################################################
# 4. Build Application
#############################################################################

section "4. Build Application"

info "Installing dependencies..."
pnpm install

info "Running database migrations..."
DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d '"' -f 2)
export DATABASE_URL
pnpm prisma migrate deploy

success "Database migrations complete"

info "Building application..."
pnpm run build

success "Application built successfully"

#############################################################################
# 5. Deploy to Vercel
#############################################################################

section "5. Deploy to Vercel"

info "Deploying to Vercel..."

# Build vercel command
VERCEL_CMD="vercel --prod --yes"

if [ -n "$VERCEL_ORG" ]; then
    VERCEL_CMD="$VERCEL_CMD --scope $VERCEL_ORG"
fi

# Set environment variables in Vercel
info "Setting environment variables in Vercel..."

# Read env file and upload to Vercel
while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue

    # Extract key and value
    KEY=$(echo "$line" | cut -d '=' -f 1)
    VALUE=$(echo "$line" | cut -d '=' -f 2- | sed 's/^"\(.*\)"$/\1/')

    # Skip if already set (to avoid overwriting)
    if vercel env ls production 2>/dev/null | grep -q "^$KEY"; then
        info "  $KEY: already set"
    else
        echo "$VALUE" | vercel env add "$KEY" production --yes 2>/dev/null || warning "  $KEY: failed to set"
    fi
done < "$ENV_FILE"

success "Environment variables configured"

# Deploy
info "Deploying application..."
DEPLOYMENT_URL=$($VERCEL_CMD 2>&1 | tee /dev/tty | grep -oP 'https://[^\s]+' | tail -1)

if [ -z "$DEPLOYMENT_URL" ]; then
    error "Deployment failed - no URL returned"
fi

success "Deployed to: $DEPLOYMENT_URL"

#############################################################################
# 6. Configure Custom Domain
#############################################################################

section "6. Configure Custom Domain"

info "Adding custom domain: $WEB_DOMAIN"

# Check if domain already added
if vercel domains ls 2>/dev/null | grep -q "$WEB_DOMAIN"; then
    success "Domain already configured: $WEB_DOMAIN"
else
    # Add domain
    if [ -n "$VERCEL_ORG" ]; then
        vercel domains add "$WEB_DOMAIN" --scope "$VERCEL_ORG" || warning "Failed to add domain"
    else
        vercel domains add "$WEB_DOMAIN" || warning "Failed to add domain"
    fi

    success "Domain added: $WEB_DOMAIN"
fi

#############################################################################
# 7. Configure DNS
#############################################################################

section "7. Configure DNS"

if [ "$DNS_AUTO_CONFIGURE" = "true" ]; then
    case $DNS_PROVIDER in
        cloudflare)
            info "Configuring Cloudflare DNS..."

            # Check if record exists
            EXISTING_RECORD=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?type=CNAME&name=${PRODUCT_NAME}" \
                -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                -H "Content-Type: application/json" | jq -r '.result[0].id // empty')

            if [ -n "$EXISTING_RECORD" ]; then
                info "DNS record already exists"
            else
                # Create CNAME record
                curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
                    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                    -H "Content-Type: application/json" \
                    --data "{
                        \"type\": \"CNAME\",
                        \"name\": \"${PRODUCT_NAME}\",
                        \"content\": \"cname.vercel-dns.com\",
                        \"ttl\": 1,
                        \"proxied\": true
                    }" > /dev/null

                success "Cloudflare DNS record created"
            fi

            # Configure AI domain if needed
            if [ "$AI_USE_CUSTOM_DOMAIN" = "true" ] && [ -n "$EC2_IP" ]; then
                info "Configuring AI domain: ${AI_DOMAIN}"

                curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
                    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
                    -H "Content-Type: application/json" \
                    --data "{
                        \"type\": \"A\",
                        \"name\": \"ai\",
                        \"content\": \"${EC2_IP}\",
                        \"ttl\": 1,
                        \"proxied\": false
                    }" > /dev/null

                success "AI domain DNS configured"
            fi
            ;;

        route53)
            info "Configuring Route 53 DNS..."

            # Get hosted zone ID
            HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
                --dns-name "$DOMAIN_ROOT" \
                --query "HostedZones[0].Id" \
                --output text | cut -d '/' -f 3)

            if [ -z "$HOSTED_ZONE_ID" ]; then
                error "Hosted zone not found for $DOMAIN_ROOT"
            fi

            # Create change batch
            cat > /tmp/dns-change.json << EOF
{
  "Changes": [{
    "Action": "UPSERT",
    "ResourceRecordSet": {
      "Name": "${WEB_DOMAIN}",
      "Type": "CNAME",
      "TTL": 300,
      "ResourceRecords": [{"Value": "cname.vercel-dns.com"}]
    }
  }]
}
EOF

            aws route53 change-resource-record-sets \
                --hosted-zone-id "$HOSTED_ZONE_ID" \
                --change-batch file:///tmp/dns-change.json > /dev/null

            success "Route 53 DNS record created"
            rm /tmp/dns-change.json
            ;;

        *)
            warning "Manual DNS configuration required"
            echo "  Add CNAME record:"
            echo "    Name: $PRODUCT_NAME"
            echo "    Value: cname.vercel-dns.com"
            ;;
    esac
else
    warning "DNS auto-configuration disabled"
    echo ""
    echo "Manual DNS configuration required:"
    echo "  1. Go to your DNS provider"
    echo "  2. Add CNAME record:"
    echo "     Name: $PRODUCT_NAME"
    echo "     Type: CNAME"
    echo "     Value: cname.vercel-dns.com"
    echo ""
fi

#############################################################################
# 8. Verify Deployment
#############################################################################

section "8. Verify Deployment"

info "Verifying deployment..."

# Wait for DNS propagation
echo "Waiting for DNS propagation (30 seconds)..."
sleep 30

# Test deployment URL
if curl -s -o /dev/null -w "%{http_code}" "$DEPLOYMENT_URL" | grep -q "200"; then
    success "Deployment URL accessible: $DEPLOYMENT_URL"
else
    warning "Deployment URL not accessible yet: $DEPLOYMENT_URL"
fi

# Test custom domain
if curl -s -o /dev/null -w "%{http_code}" "https://$WEB_DOMAIN" | grep -q "200"; then
    success "Custom domain accessible: https://$WEB_DOMAIN"
else
    warning "Custom domain not accessible yet: https://$WEB_DOMAIN"
    info "DNS propagation may take up to 48 hours"
fi

#############################################################################
# 9. Post-Deployment Tasks
#############################################################################

section "9. Post-Deployment Tasks"

echo "✓ Deployment complete!"
echo ""
echo "URLs:"
echo "  - Application: https://$WEB_DOMAIN"
echo "  - Deployment:  $DEPLOYMENT_URL"
echo ""

if [ "$AI_SETUP_PENDING" = "true" ] || [ "$AI_CREATE_NEW" = "true" ]; then
    warning "AI Server setup required - see instructions above"
fi

if [ "$GOOGLE_OAUTH_PENDING" = "true" ]; then
    warning "Google OAuth setup required"
    echo "  Update redirect URI: https://$WEB_DOMAIN/api/auth/callback/google"
fi

echo ""
echo "Next steps:"
echo "  1. Test application: https://$WEB_DOMAIN"
echo "  2. Configure Google OAuth redirect URIs"
echo "  3. Test Gmail integration"
echo "  4. Monitor logs: vercel logs"
echo ""

# Save deployment info
cat > deployment-info.txt << EOF
Deployment Information
=====================
Date: $(date)
Domain: https://$WEB_DOMAIN
Deployment URL: $DEPLOYMENT_URL

Database: $DB_PROVIDER
Redis: $REDIS_PROVIDER
AI: $AI_PROVIDER
DNS: $DNS_PROVIDER

Vercel Project: $VERCEL_PROJECT_NAME
Vercel Org: $VERCEL_ORG

Configuration: $CONFIG_FILE
Environment: $ENV_FILE
Log: $LOG_FILE
EOF

success "Deployment information saved to: deployment-info.txt"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
