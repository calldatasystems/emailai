#!/bin/bash

# EmailAI - Cloud Setup Script
# Automatically provisions AWS infrastructure and Google OAuth
# Usage: ./scripts/setup-cloud.sh [--environment dev|prod]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine environment
ENVIRONMENT="${1:-dev}"
if [[ "$ENVIRONMENT" != "dev" ]] && [[ "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}Error: Environment must be 'dev' or 'prod'${NC}"
    exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   EmailAI Cloud Setup ($ENVIRONMENT)            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    local missing_tools=()

    # Check AWS CLI
    if ! command_exists aws; then
        missing_tools+=("aws-cli")
    fi

    # Check jq (for JSON parsing)
    if ! command_exists jq; then
        missing_tools+=("jq")
    fi

    # Check gcloud (for Google OAuth setup)
    if ! command_exists gcloud; then
        missing_tools+=("gcloud")
    fi

    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        echo ""
        echo "Installation instructions:"
        echo ""

        if [[ " ${missing_tools[@]} " =~ " aws-cli " ]]; then
            echo "AWS CLI:"
            echo "  curl \"https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip\" -o \"awscliv2.zip\""
            echo "  unzip awscliv2.zip"
            echo "  sudo ./aws/install"
            echo ""
        fi

        if [[ " ${missing_tools[@]} " =~ " jq " ]]; then
            echo "jq:"
            echo "  sudo apt install jq  # Ubuntu/Debian"
            echo "  brew install jq      # macOS"
            echo ""
        fi

        if [[ " ${missing_tools[@]} " =~ " gcloud " ]]; then
            echo "Google Cloud SDK:"
            echo "  curl https://sdk.cloud.google.com | bash"
            echo "  exec -l $SHELL"
            echo ""
        fi

        exit 1
    fi

    print_success "All prerequisites installed"
}

# Configure AWS credentials
configure_aws() {
    echo ""
    echo -e "${GREEN}━━━ AWS Configuration ━━━${NC}"
    echo ""

    # Check if already configured
    if aws sts get-caller-identity &>/dev/null; then
        print_success "AWS credentials already configured"
        AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
        AWS_REGION=$(aws configure get region || echo "us-east-1")

        read -p "Use these credentials? (Y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Nn]$ ]]; then
            aws configure
        fi
    else
        print_status "AWS credentials not found. Let's set them up."
        echo ""
        echo "You'll need:"
        echo "  1. AWS Access Key ID"
        echo "  2. AWS Secret Access Key"
        echo ""
        echo "Get them from: https://console.aws.amazon.com/iam/home#/security_credentials"
        echo ""

        aws configure
    fi

    # Get AWS account details
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region)

    print_success "AWS Account: $AWS_ACCOUNT_ID"
    print_success "AWS Region: $AWS_REGION"

    export AWS_ACCOUNT_ID
    export AWS_REGION
}

# Setup Google Cloud project and OAuth
setup_google_oauth() {
    echo ""
    echo -e "${GREEN}━━━ Google Cloud & OAuth Setup ━━━${NC}"
    echo ""

    # Check if gcloud is authenticated
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
        print_status "Authenticating with Google Cloud..."
        gcloud auth login
    fi

    # Get or create project
    print_status "Setting up Google Cloud project..."
    echo ""

    EXISTING_PROJECTS=$(gcloud projects list --format="value(projectId)" 2>/dev/null)

    if [ -n "$EXISTING_PROJECTS" ]; then
        echo "Existing projects:"
        echo "$EXISTING_PROJECTS" | nl
        echo ""
        read -p "Use existing project? Enter number (or 'n' for new): " choice

        if [ "$choice" != "n" ]; then
            GCP_PROJECT_ID=$(echo "$EXISTING_PROJECTS" | sed -n "${choice}p")
            gcloud config set project "$GCP_PROJECT_ID"
        else
            create_new_gcp_project
        fi
    else
        create_new_gcp_project
    fi

    print_success "Using project: $GCP_PROJECT_ID"

    # Enable required APIs
    print_status "Enabling required Google APIs..."
    gcloud services enable gmail.googleapis.com --project="$GCP_PROJECT_ID" --quiet
    gcloud services enable iamcredentials.googleapis.com --project="$GCP_PROJECT_ID" --quiet
    print_success "APIs enabled"

    # Create OAuth consent screen if not exists
    print_status "Configuring OAuth consent screen..."

    APP_NAME=$(prompt_with_default "Application name" "EmailAI")
    SUPPORT_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)

    # Note: OAuth consent screen must be configured manually via Console
    # because it requires accepting terms and conditions
    print_warning "OAuth consent screen configuration:"
    echo ""
    echo "Please complete these steps in Google Cloud Console:"
    echo "  1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=$GCP_PROJECT_ID"
    echo "  2. Choose 'External' user type and click CREATE"
    echo "  3. Fill in:"
    echo "     - App name: $APP_NAME"
    echo "     - User support email: $SUPPORT_EMAIL"
    echo "     - Developer contact: $SUPPORT_EMAIL"
    echo "  4. Click 'Save and Continue' through the remaining steps"
    echo ""
    read -p "Press Enter when completed..."

    # Create OAuth credentials
    print_status "Creating OAuth 2.0 credentials..."

    if [[ "$ENVIRONMENT" == "prod" ]]; then
        OAUTH_REDIRECT_URI=$(prompt_with_default "Production URL" "https://yourdomain.com")
    else
        OAUTH_REDIRECT_URI="http://localhost:3000"
    fi

    OAUTH_REDIRECT_URI="${OAUTH_REDIRECT_URI}/api/auth/callback/google"

    # Create OAuth client
    print_status "Creating OAuth client ID..."

    # Note: gcloud doesn't support creating OAuth clients directly
    # We'll use the APIs instead
    print_warning "OAuth client creation must be done via Console"
    echo ""
    echo "Please create OAuth credentials:"
    echo "  1. Go to: https://console.cloud.google.com/apis/credentials?project=$GCP_PROJECT_ID"
    echo "  2. Click 'CREATE CREDENTIALS' → 'OAuth client ID'"
    echo "  3. Application type: Web application"
    echo "  4. Name: EmailAI $ENVIRONMENT"
    echo "  5. Authorized redirect URIs: $OAUTH_REDIRECT_URI"
    echo "  6. Click CREATE"
    echo ""

    read -p "Paste Client ID: " GOOGLE_CLIENT_ID
    read -s -p "Paste Client Secret: " GOOGLE_CLIENT_SECRET
    echo ""

    print_success "Google OAuth configured"

    export GCP_PROJECT_ID
    export GOOGLE_CLIENT_ID
    export GOOGLE_CLIENT_SECRET
}

create_new_gcp_project() {
    local default_project_id="emailai-$(date +%s)"
    GCP_PROJECT_ID=$(prompt_with_default "New project ID" "$default_project_id")

    print_status "Creating Google Cloud project: $GCP_PROJECT_ID"
    gcloud projects create "$GCP_PROJECT_ID" --name="EmailAI"
    gcloud config set project "$GCP_PROJECT_ID"

    print_warning "Project created. You may need to link a billing account:"
    echo "  https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT_ID"
    echo ""
    read -p "Press Enter to continue..."
}

# Create AWS infrastructure
create_aws_infrastructure() {
    echo ""
    echo -e "${GREEN}━━━ AWS Infrastructure Setup ━━━${NC}"
    echo ""

    if [[ "$ENVIRONMENT" == "dev" ]]; then
        create_dev_infrastructure
    else
        create_prod_infrastructure
    fi
}

create_dev_infrastructure() {
    print_status "Creating development infrastructure (single server, no load balancer)..."

    # VPC
    print_status "Creating VPC..."
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block 10.0.0.0/16 \
        --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=emailai-dev-vpc}]" \
        --query 'Vpc.VpcId' \
        --output text)
    print_success "VPC created: $VPC_ID"

    # Internet Gateway
    print_status "Creating Internet Gateway..."
    IGW_ID=$(aws ec2 create-internet-gateway \
        --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=emailai-dev-igw}]" \
        --query 'InternetGateway.InternetGatewayId' \
        --output text)
    aws ec2 attach-internet-gateway --vpc-id "$VPC_ID" --internet-gateway-id "$IGW_ID"
    print_success "Internet Gateway attached: $IGW_ID"

    # Subnet
    print_status "Creating subnet..."
    SUBNET_ID=$(aws ec2 create-subnet \
        --vpc-id "$VPC_ID" \
        --cidr-block 10.0.1.0/24 \
        --availability-zone "${AWS_REGION}a" \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=emailai-dev-subnet}]" \
        --query 'Subnet.SubnetId' \
        --output text)
    print_success "Subnet created: $SUBNET_ID"

    # Route Table
    ROUTE_TABLE_ID=$(aws ec2 describe-route-tables \
        --filters "Name=vpc-id,Values=$VPC_ID" \
        --query 'RouteTables[0].RouteTableId' \
        --output text)

    aws ec2 create-route \
        --route-table-id "$ROUTE_TABLE_ID" \
        --destination-cidr-block 0.0.0.0/0 \
        --gateway-id "$IGW_ID" >/dev/null

    # Security Group
    print_status "Creating security group..."
    SG_ID=$(aws ec2 create-security-group \
        --group-name emailai-dev-sg \
        --description "EmailAI development security group" \
        --vpc-id "$VPC_ID" \
        --query 'GroupId' \
        --output text)

    # Allow SSH, HTTP, HTTPS
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 3000 --cidr 0.0.0.0/0
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 5432 --cidr 10.0.0.0/16

    print_success "Security group created: $SG_ID"

    # RDS PostgreSQL (Single instance for dev)
    print_status "Creating RDS PostgreSQL instance..."

    DB_PASSWORD=$(openssl rand -base64 32)

    aws rds create-db-instance \
        --db-instance-identifier emailai-dev-db \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 15.4 \
        --master-username emailai \
        --master-user-password "$DB_PASSWORD" \
        --allocated-storage 20 \
        --vpc-security-group-ids "$SG_ID" \
        --db-subnet-group-name default \
        --backup-retention-period 7 \
        --no-multi-az \
        --publicly-accessible \
        --tags Key=Name,Value=emailai-dev-db

    print_status "Waiting for RDS instance to be available (this may take 5-10 minutes)..."
    aws rds wait db-instance-available --db-instance-identifier emailai-dev-db

    DB_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier emailai-dev-db \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)

    print_success "Database created: $DB_ENDPOINT"

    # EC2 Instance (Single server for dev)
    print_status "Creating EC2 instance..."

    # Get latest Amazon Linux 2023 AMI
    AMI_ID=$(aws ec2 describe-images \
        --owners amazon \
        --filters "Name=name,Values=al2023-ami-2023.*-x86_64" \
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
        --output text)

    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id "$AMI_ID" \
        --instance-type t3.small \
        --subnet-id "$SUBNET_ID" \
        --security-group-ids "$SG_ID" \
        --associate-public-ip-address \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=emailai-dev-server}]" \
        --user-data file://scripts/cloud-init-dev.sh \
        --query 'Instances[0].InstanceId' \
        --output text)

    print_success "EC2 instance created: $INSTANCE_ID"

    print_status "Waiting for instance to be running..."
    aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"

    INSTANCE_IP=$(aws ec2 describe-instances \
        --instance-ids "$INSTANCE_ID" \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text)

    print_success "Instance running at: $INSTANCE_IP"

    # Save configuration
    cat > ".aws-dev-config.json" << EOF
{
  "environment": "dev",
  "aws_region": "$AWS_REGION",
  "vpc_id": "$VPC_ID",
  "subnet_id": "$SUBNET_ID",
  "security_group_id": "$SG_ID",
  "db_endpoint": "$DB_ENDPOINT",
  "db_password": "$DB_PASSWORD",
  "instance_id": "$INSTANCE_ID",
  "instance_ip": "$INSTANCE_IP",
  "database_url": "postgresql://emailai:$DB_PASSWORD@$DB_ENDPOINT:5432/emailai_dev"
}
EOF

    print_success "Configuration saved to .aws-dev-config.json"
    print_warning "⚠️  Keep this file secure! It contains your database password."
}

create_prod_infrastructure() {
    print_status "Creating production infrastructure (3 app servers + load balancer)..."

    # Similar to dev but with:
    # - Application Load Balancer
    # - 3 EC2 instances in Auto Scaling Group
    # - Multi-AZ RDS
    # - Additional security hardening

    print_warning "Production setup not yet implemented in this script"
    print_warning "For production, consider using Infrastructure as Code (Terraform/CDK)"
    print_warning "See docs/DEPLOYMENT_GUIDE.md for manual production setup"
}

# Create cloud-init script for dev server
create_cloud_init_script() {
    cat > "scripts/cloud-init-dev.sh" << 'EOF'
#!/bin/bash

# Cloud-init script for EmailAI development server

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install PostgreSQL client
yum install -y postgresql15

# Install Git
yum install -y git

# Install Docker (for local PostgreSQL if needed)
yum install -y docker
systemctl start docker
systemctl enable docker

# Create app directory
mkdir -p /opt/emailai
cd /opt/emailai

# Clone repository (will need to be configured with deploy key)
# git clone https://github.com/calldatasystems/emailai.git .

# Install dependencies
# npm install

# Setup systemd service
cat > /etc/systemd/system/emailai.service << 'SERVICE'
[Unit]
Description=EmailAI Application
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/emailai/apps/web
Environment="NODE_ENV=production"
EnvironmentFile=/opt/emailai/.env.production
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
SERVICE

# Enable service (don't start yet - need env vars first)
systemctl enable emailai
EOF

    chmod +x scripts/cloud-init-dev.sh
}

# Main setup flow
main() {
    check_prerequisites
    configure_aws
    setup_google_oauth
    create_cloud_init_script
    create_aws_infrastructure

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Cloud Setup Complete! 🎉                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${BLUE}Next Steps:${NC}"
    echo ""

    if [[ "$ENVIRONMENT" == "dev" ]]; then
        echo "1. Your infrastructure is ready:"
        echo "   - Database: $DB_ENDPOINT"
        echo "   - App Server: $INSTANCE_IP"
        echo ""
        echo "2. SSH into your server:"
        echo "   ssh ec2-user@$INSTANCE_IP"
        echo ""
        echo "3. Clone your repository and set up:"
        echo "   cd /opt/emailai"
        echo "   git clone <your-repo-url> ."
        echo "   ./scripts/setup.sh"
        echo ""
        echo "4. Create .env.production with:"
        echo "   DATABASE_URL=\"$(<.aws-dev-config.json jq -r .database_url)\""
        echo "   GOOGLE_CLIENT_ID=\"$GOOGLE_CLIENT_ID\""
        echo "   GOOGLE_CLIENT_SECRET=\"$GOOGLE_CLIENT_SECRET\""
        echo ""
        echo "5. Start the application:"
        echo "   sudo systemctl start emailai"
        echo ""
    fi

    echo "Environment configuration saved to .aws-$ENVIRONMENT-config.json"
    echo ""
    print_warning "⚠️  IMPORTANT: Keep .aws-*-config.json files secure!"
    print_warning "   They contain sensitive credentials."
    echo ""
}

# Run main function
main
