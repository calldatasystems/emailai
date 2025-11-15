# EmailAI Production Deployment

This terraform configuration deploys EmailAI to AWS with:

- Application Load Balancer (ALB) for high availability
- 2 EC2 instances running Docker containers
- RDS PostgreSQL database
- VPC with public/private subnets across 2 AZs

AI models are hosted separately on Vast.ai servers.

## Architecture

```
Internet
    │
    ▼
[ALB - Application Load Balancer]
    │
    ├─────────────────┐
    ▼                 ▼
[EC2-1]            [EC2-2]
    │                 │
    └─────┬───────────┘
          ▼
    [RDS PostgreSQL]
          │
    (Private Subnet)
```

## Prerequisites

1. AWS CLI configured with credentials
2. Terraform >= 1.5.0
3. Access to Vast.ai for AI models
4. Domain/SSL certificate for HTTPS (optional but recommended)

## Deployment Steps

### 1. Configure Variables

```bash
cd /mnt/c/Users/aqorn/Documents/CALLDATA/CODE/aws-saas-ui/terraform/environments/emailai-prod

# Copy example vars
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required changes in terraform.tfvars:**

- `db_password`: Generate strong password with `openssl rand -base64 32`
- `certificate_arn`: Add your ACM certificate ARN for HTTPS (or leave empty for HTTP)

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Review Plan

```bash
terraform plan
```

This will show all resources to be created:

- 1 VPC with 2 public and 2 private subnets
- 1 Internet Gateway
- 1 Application Load Balancer
- 1 Target Group
- 2 EC2 instances (t3.medium)
- 1 RDS PostgreSQL instance (db.t3.micro)
- Security groups for ALB, EC2, and RDS

### 4. Deploy Infrastructure

```bash
terraform apply
```

Review the plan and type `yes` to proceed.

Deployment takes ~10-15 minutes.

### 5. Get Deployment Info

```bash
terraform output deployment_info
```

This shows:

- ALB URL
- Database connection string
- EC2 instance IDs
- SSM connect commands

### 6. Deploy Application to EC2

Connect to each instance via SSM:

```bash
# Instance 1
aws ssm start-session --target <instance-id-1>

# Instance 2
aws ssm start-session --target <instance-id-2>
```

On each instance:

```bash
# Switch to root
sudo su -

# Navigate to app directory
cd /opt/emailai

# Clone repository
git clone https://github.com/YOUR_ORG/emailai.git .

# Create .env file
cat > .env <<EOF
# Database (from terraform output)
DATABASE_URL="postgresql://emailai_admin:YOUR_PASSWORD@<db-endpoint>:5432/emailai_prod?schema=public"
DIRECT_URL="postgresql://emailai_admin:YOUR_PASSWORD@<db-endpoint>:5432/emailai_prod?schema=public"

# App Configuration
NEXTAUTH_URL="https://emailai.calldata.app"
NEXTAUTH_SECRET="$(openssl rand -hex 32)"
NODE_ENV=production

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_ENCRYPT_SECRET="$(openssl rand -hex 32)"
GOOGLE_ENCRYPT_SALT="$(openssl rand -hex 16)"
GOOGLE_PUBSUB_TOPIC_NAME="projects/YOUR_PROJECT/topics/emailai"
GOOGLE_PUBSUB_VERIFICATION_TOKEN="$(openssl rand -hex 32)"

# API Keys
INTERNAL_API_KEY="$(openssl rand -hex 32)"
API_KEY_SALT="$(openssl rand -hex 32)"

# Redis
UPSTASH_REDIS_URL="your-redis-url"
UPSTASH_REDIS_TOKEN="your-redis-token"
QSTASH_TOKEN="your-qstash-token"
QSTASH_CURRENT_SIGNING_KEY="your-key"
QSTASH_NEXT_SIGNING_KEY="your-key"

# AI Models (Vast.ai)
OLLAMA_BASE_URL="http://YOUR_VASTAI_HOST:PORT/api"
NEXT_PUBLIC_OLLAMA_MODEL="llama3.3:70b"
DEFAULT_LLM_PROVIDER="ollama"

# Optional: Cloud AI providers as fallback
# OPENAI_API_KEY="your-key"
# ANTHROPIC_API_KEY="your-key"
EOF

# Build and run with Docker
docker build -f docker/Dockerfile.prod -t emailai:latest .

# Run migrations
docker run --rm --env-file .env emailai:latest pnpm --filter inbox-zero-ai exec -- prisma migrate deploy

# Start container
docker run -d \
  --name emailai \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  emailai:latest
```

### 7. Configure DNS

Point your domain to the ALB:

```bash
# Get ALB DNS name
terraform output alb_dns_name

# Create CNAME record:
# emailai.calldata.app -> <alb-dns-name>
```

### 8. Verify Deployment

```bash
# Check ALB health
curl http://<alb-dns-name>/api/health

# Check application
curl https://emailai.calldata.app
```

## Vast.ai AI Model Setup

The AI models run separately on Vast.ai. Set up instructions:

1. Create Vast.ai instance with GPU (RTX 4090 recommended)
2. Install Ollama: `curl https://ollama.ai/install.sh | sh`
3. Pull model: `ollama pull llama3.3:70b`
4. Expose port 11434
5. Update `.env` with `OLLAMA_BASE_URL=http://vast-host:port/api`

## Monitoring

Check instance health:

```bash
# View target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# SSM into instances
aws ssm start-session --target <instance-id>

# Check Docker logs
sudo docker logs -f emailai
```

## Scaling

To change instance count:

```bash
# Edit terraform.tfvars
instance_count = 3

# Apply changes
terraform apply
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning:** This will delete all data including the database.

## Cost Estimate

Monthly costs (us-east-1):

- 2x t3.medium EC2: ~$60
- db.t3.micro RDS: ~$15
- ALB: ~$20
- Data transfer: ~$10-50
- **Total: ~$105-145/month**

For production, consider:

- Larger instance types (t3.large)
- Multi-AZ RDS (doubles RDS cost)
- Reserved instances (40-60% savings)
