#!/bin/bash

#######################################################################
# Ollama AWS Deployment Script for EmailAI
#
# This script provisions AWS infrastructure for Ollama server.
# It creates EC2 instances optimized for AI workloads.
#
# Requirements:
# - AWS CLI installed and configured
# - AWS account with EC2 permissions
# - VPC and subnet configured
#
# Usage:
#   ./setup-aws.sh [dev|prod]
#
# Examples:
#   ./setup-aws.sh dev    # Small instance (Llama 3.1 8B)
#   ./setup-aws.sh prod   # Large instance (Llama 3.3 70B with GPU)
#######################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# Parse arguments
MODE="${1:-dev}"

if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    error "Invalid mode. Use 'dev' or 'prod'"
fi

info "Starting Ollama AWS deployment in $MODE mode..."

#######################################################################
# Configuration
#######################################################################

PROJECT_NAME="emailai-ollama"
REGION="${AWS_REGION:-us-east-1}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

if [[ "$MODE" == "prod" ]]; then
    # Production: GPU instance for Llama 3.3 70B
    INSTANCE_TYPE="g5.2xlarge"  # 8 vCPU, 32GB RAM, 1x NVIDIA A10G GPU
    VOLUME_SIZE=200  # 200GB for model storage
    MODEL_NAME="llama3.3:70b"
    COST_EST="\$0.60-1.00/hour (~\$450-750/month)"
else
    # Development: High-RAM instance for Llama 3.1 8B
    INSTANCE_TYPE="r7i.xlarge"  # 4 vCPU, 32GB RAM
    VOLUME_SIZE=50  # 50GB for model storage
    MODEL_NAME="llama3.1:8b"
    COST_EST="\$0.22-0.30/hour (~\$165-220/month)"
fi

info "Instance Type: $INSTANCE_TYPE"
info "Model: $MODEL_NAME"
info "Estimated Cost: $COST_EST"

#######################################################################
# Check Prerequisites
#######################################################################

info "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    error "AWS CLI not found. Please install: https://aws.amazon.com/cli/"
fi

# Verify AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    error "AWS credentials not configured. Run: aws configure"
fi

success "AWS CLI configured"

# Check jq
if ! command -v jq &> /dev/null; then
    warn "jq not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        sudo apt-get update && sudo apt-get install -y jq
    fi
fi

#######################################################################
# Get VPC and Subnet
#######################################################################

info "Finding VPC and subnet..."

# Get default VPC
VPC_ID=$(aws ec2 describe-vpcs --region "$REGION" \
    --filters "Name=is-default,Values=true" \
    --query 'Vpcs[0].VpcId' --output text)

if [[ "$VPC_ID" == "None" || -z "$VPC_ID" ]]; then
    error "No default VPC found in region $REGION. Please create a VPC first."
fi

# Get first subnet in VPC
SUBNET_ID=$(aws ec2 describe-subnets --region "$REGION" \
    --filters "Name=vpc-id,Values=$VPC_ID" \
    --query 'Subnets[0].SubnetId' --output text)

success "VPC: $VPC_ID, Subnet: $SUBNET_ID"

#######################################################################
# Create Security Group
#######################################################################

info "Creating security group..."

SG_NAME="$PROJECT_NAME-$MODE-sg-$TIMESTAMP"
SG_ID=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "$SG_NAME" \
    --description "Security group for Ollama server ($MODE mode)" \
    --vpc-id "$VPC_ID" \
    --query 'GroupId' --output text)

success "Security Group created: $SG_ID"

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --output text > /dev/null

# Allow Ollama (port 11434)
aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 11434 \
    --cidr 0.0.0.0/0 \
    --output text > /dev/null

success "Security group rules configured (SSH, Ollama)"

#######################################################################
# Get Latest Ubuntu AMI
#######################################################################

info "Finding latest Ubuntu AMI..."

if [[ "$MODE" == "prod" ]]; then
    # For GPU instances, use Deep Learning AMI with NVIDIA drivers
    AMI_ID=$(aws ec2 describe-images \
        --region "$REGION" \
        --owners amazon \
        --filters "Name=name,Values=Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)*" \
                  "Name=state,Values=available" \
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
        --output text)
    AMI_DESC="Deep Learning AMI (GPU)"
else
    # For CPU instances, use standard Ubuntu
    AMI_ID=$(aws ec2 describe-images \
        --region "$REGION" \
        --owners 099720109477 \
        --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
                  "Name=state,Values=available" \
        --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
        --output text)
    AMI_DESC="Ubuntu 22.04"
fi

success "AMI: $AMI_ID ($AMI_DESC)"

#######################################################################
# Create User Data Script
#######################################################################

info "Creating user data script..."

USER_DATA=$(cat <<'EOF'
#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y curl jq

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
systemctl enable ollama
systemctl start ollama

# Wait for Ollama to be ready
sleep 5

# Pull the model
EOF
)

USER_DATA+="
ollama pull $MODEL_NAME

# Create status script
cat > /usr/local/bin/ollama-status << 'EOFSTATUS'
#!/bin/bash
echo \"=== Ollama Status ===\"
systemctl status ollama --no-pager
echo \"\"
echo \"Loaded Models:\"
curl -s http://localhost:11434/api/tags | jq -r '.models[] | \"\\(.name) - \\(.size/1024/1024/1024 | floor)GB\"'
EOFSTATUS

chmod +x /usr/local/bin/ollama-status

# Configure Ollama environment
mkdir -p /etc/ollama
cat > /etc/ollama/config.env << EOFCONFIG
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_ORIGINS=*
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1
EOFCONFIG

# Restart Ollama to apply config
systemctl restart ollama

echo \"Ollama setup complete!\"
"

# Save user data to temp file
USER_DATA_FILE="/tmp/ollama-userdata-$TIMESTAMP.sh"
echo "$USER_DATA" > "$USER_DATA_FILE"

#######################################################################
# Launch EC2 Instance
#######################################################################

info "Launching EC2 instance..."

INSTANCE_ID=$(aws ec2 run-instances \
    --region "$REGION" \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --security-group-ids "$SG_ID" \
    --subnet-id "$SUBNET_ID" \
    --user-data "file://$USER_DATA_FILE" \
    --block-device-mappings "[{\"DeviceName\":\"/dev/sda1\",\"Ebs\":{\"VolumeSize\":$VOLUME_SIZE,\"VolumeType\":\"gp3\",\"DeleteOnTermination\":true}}]" \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$PROJECT_NAME-$MODE-$TIMESTAMP},{Key=Project,Value=EmailAI},{Key=Mode,Value=$MODE}]" \
    --query 'Instances[0].InstanceId' \
    --output text)

success "Instance launched: $INSTANCE_ID"

# Clean up user data file
rm "$USER_DATA_FILE"

#######################################################################
# Wait for Instance
#######################################################################

info "Waiting for instance to be running..."

aws ec2 wait instance-running --region "$REGION" --instance-ids "$INSTANCE_ID"

# Get instance details
INSTANCE_INFO=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0]' \
    --output json)

PUBLIC_IP=$(echo "$INSTANCE_INFO" | jq -r '.PublicIpAddress')
PRIVATE_IP=$(echo "$INSTANCE_INFO" | jq -r '.PrivateIpAddress')

success "Instance running!"
info "Public IP: $PUBLIC_IP"
info "Private IP: $PRIVATE_IP"

#######################################################################
# Wait for Ollama Setup
#######################################################################

info "Waiting for Ollama to be ready (this may take 5-10 minutes)..."
warn "The instance is downloading and installing Ollama + the model..."

RETRIES=0
MAX_RETRIES=60

while [ $RETRIES -lt $MAX_RETRIES ]; do
    if curl -s -f "http://$PUBLIC_IP:11434/api/tags" > /dev/null 2>&1; then
        success "Ollama is ready!"
        break
    fi

    RETRIES=$((RETRIES + 1))
    echo -n "."
    sleep 10
done

echo ""

if [ $RETRIES -eq $MAX_RETRIES ]; then
    warn "Ollama is taking longer than expected. It may still be setting up."
    warn "You can SSH to the instance and check: ssh ubuntu@$PUBLIC_IP"
    warn "Then run: sudo journalctl -u ollama -f"
else
    # Test the model
    info "Testing the model..."
    MODELS=$(curl -s "http://$PUBLIC_IP:11434/api/tags" | jq -r '.models[] | .name')
    success "Available models:"
    echo "$MODELS"
fi

#######################################################################
# Save Configuration
#######################################################################

CONFIG_FILE="./ollama-aws-$MODE-$TIMESTAMP.json"

cat > "$CONFIG_FILE" << EOF
{
  "mode": "$MODE",
  "region": "$REGION",
  "instanceId": "$INSTANCE_ID",
  "instanceType": "$INSTANCE_TYPE",
  "publicIp": "$PUBLIC_IP",
  "privateIp": "$PRIVATE_IP",
  "securityGroupId": "$SG_ID",
  "model": "$MODEL_NAME",
  "ollamaUrl": "http://$PUBLIC_IP:11434",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

success "Configuration saved to $CONFIG_FILE"

#######################################################################
# Display Connection Info
#######################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Ollama AWS Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Instance Details:"
echo "  Instance ID: $INSTANCE_ID"
echo "  Instance Type: $INSTANCE_TYPE"
echo "  Model: $MODEL_NAME"
echo "  Public IP: $PUBLIC_IP"
echo "  Private IP: $PRIVATE_IP"
echo ""
info "Connection Details:"
echo "  Ollama URL: http://$PUBLIC_IP:11434"
echo "  SSH: ssh ubuntu@$PUBLIC_IP"
echo ""
info "Add these to your EmailAI .env file:"
echo ""
echo "  OLLAMA_BASE_URL=http://$PUBLIC_IP:11434/api"
echo "  NEXT_PUBLIC_OLLAMA_MODEL=$MODEL_NAME"
echo "  DEFAULT_LLM_PROVIDER=ollama"
echo ""
info "Useful Commands:"
echo "  Check status: ssh ubuntu@$PUBLIC_IP 'ollama-status'"
echo "  View logs: ssh ubuntu@$PUBLIC_IP 'sudo journalctl -u ollama -f'"
echo "  List models: curl http://$PUBLIC_IP:11434/api/tags"
echo "  Stop instance: aws ec2 stop-instances --region $REGION --instance-ids $INSTANCE_ID"
echo "  Start instance: aws ec2 start-instances --region $REGION --instance-ids $INSTANCE_ID"
echo "  Terminate instance: aws ec2 terminate-instances --region $REGION --instance-ids $INSTANCE_ID"
echo ""
info "Estimated Costs:"
echo "  Running: $COST_EST"
echo "  Storage: \$$(echo "scale=2; $VOLUME_SIZE * 0.08" | bc)/month (EBS gp3)"
echo ""
warn "Important:"
echo "  - Instance is running and incurring charges"
echo "  - Stop the instance when not in use to save costs"
echo "  - Security group allows access from anywhere (0.0.0.0/0)"
echo "  - Consider restricting to your EmailAI server IP"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
