# Deployment Comparison: AWS vs Vercel

Complete guide comparing AWS and Vercel deployment options for EmailAI and calldata.app infrastructure.

---

## Quick Comparison

| Feature | Vercel | AWS |
|---------|--------|-----|
| **Setup Complexity** | ⭐ Easy (5 min) | ⭐⭐⭐⭐ Complex (2-4 hours) |
| **Cost (Small)** | $0-20/month | $50-100/month |
| **Cost (Scale)** | $20-200/month | $200-1000+/month |
| **Auto-scaling** | ✅ Automatic | ⚙️ Manual config |
| **SSL/CDN** | ✅ Free & automatic | ⚙️ Manual (ACM + CloudFront) |
| **Database** | ❌ Need external | ✅ RDS included |
| **Full Control** | ❌ Limited | ✅ Complete |
| **Serverless** | ✅ Built-in | ⚙️ Lambda config needed |
| **Best For** | Quick deployment, startups | Enterprise, full control |

---

## When to Use Each

### **Use Vercel When:**
- ✅ You want to deploy in < 10 minutes
- ✅ You're starting out or MVP stage
- ✅ You prefer managed services
- ✅ You want automatic SSL, CDN, scaling
- ✅ Your database is external (Supabase, Neon, PlanetScale)
- ✅ Budget: $0-200/month

### **Use AWS When:**
- ✅ You need full infrastructure control
- ✅ You're enterprise/large scale
- ✅ You want everything in one cloud provider
- ✅ You need custom networking (VPC, private subnets)
- ✅ You need compliance (HIPAA, SOC2, specific regions)
- ✅ Budget: $200+/month

---

## Architecture Comparison

### **Vercel Architecture**

```
┌─────────────────────────────────────────┐
│  Vercel Edge Network (Global CDN)       │
├─────────────────────────────────────────┤
│  emailai.calldata.app (Next.js)         │
│  - Automatic HTTPS                      │
│  - Edge Functions                       │
│  - Serverless Functions                 │
└──────────┬──────────────────────────────┘
           │
           ├─→ External PostgreSQL (Neon/Supabase)
           ├─→ External Redis (Upstash)
           ├─→ ai.calldata.app (Vast.ai Ollama)
           └─→ Google Gmail API
```

**What Vercel Handles:**
- Web hosting
- SSL certificates
- CDN (global edge network)
- Auto-scaling
- Serverless functions
- Deployments (Git push = deploy)

**What You Need Externally:**
- Database (Neon, Supabase, PlanetScale)
- Redis (Upstash, Redis Cloud)
- AI server (Vast.ai, self-hosted)

### **AWS Architecture**

```
┌─────────────────────────────────────────┐
│  CloudFront (CDN)                       │
├─────────────────────────────────────────┤
│  Application Load Balancer              │
├─────────────────────────────────────────┤
│  ECS/Fargate or EC2                     │
│  emailai.calldata.app (Next.js)         │
│  - Custom VPC                           │
│  - Private subnets                      │
│  - Auto-scaling groups                  │
└──────────┬──────────────────────────────┘
           │
           ├─→ RDS PostgreSQL (VPC)
           ├─→ ElastiCache Redis (VPC)
           ├─→ EC2/ECS Ollama server (VPC)
           └─→ Google Gmail API (via NAT Gateway)
```

**What AWS Provides:**
- Everything in one platform
- Full network control
- Managed database (RDS)
- Managed cache (ElastiCache)
- Custom compute (EC2/ECS/EKS/Lambda)

**What You Configure:**
- VPC, subnets, security groups
- Load balancers
- Auto-scaling
- SSL (ACM)
- CDN (CloudFront)
- Container orchestration

---

## Cost Breakdown

### **Vercel Costs**

#### **Small Scale** (1-5 users, development)
```
Vercel Hobby (Free):          $0/month
  - 100 GB bandwidth
  - Serverless functions
  - 1 commercial project

External Services:
- Neon PostgreSQL (Free):     $0/month (0.5GB)
- Upstash Redis (Free):        $0/month (10k requests/day)
- Vast.ai GPU (8h/day):        $84/month

TOTAL: $84/month
```

#### **Medium Scale** (10-100 users)
```
Vercel Pro:                    $20/month
  - 1 TB bandwidth
  - Analytics
  - Password protection

External Services:
- Neon PostgreSQL (Pro):       $19/month (10GB)
- Upstash Redis (Pay-as-go):   $20/month
- Vast.ai GPU (24/7):          $250/month

TOTAL: $309/month
```

#### **Large Scale** (1000+ users)
```
Vercel Enterprise:             Custom ($500+/month)
Neon PostgreSQL (Scale):       $100+/month
Upstash Redis (Pro):           $100+/month
Multiple Vast.ai GPUs:         $500+/month

TOTAL: $1200+/month
```

### **AWS Costs**

#### **Small Scale** (1-5 users, development)
```
EC2 t3.medium (web app):       $30/month
RDS t3.micro (PostgreSQL):     $15/month
ElastiCache t3.micro (Redis):  $12/month
ALB (Load Balancer):           $18/month
NAT Gateway:                   $32/month
Data Transfer:                 $10/month
CloudFront (CDN):              $5/month

TOTAL: $122/month (without GPU)
```

#### **Medium Scale** (10-100 users)
```
ECS Fargate (2 tasks):         $50/month
RDS t3.small (PostgreSQL):     $30/month
ElastiCache t3.small (Redis):  $25/month
ALB:                           $18/month
NAT Gateway:                   $32/month
Data Transfer:                 $50/month
CloudFront:                    $20/month
EC2 g4dn.xlarge (GPU):         $350/month

TOTAL: $575/month
```

#### **Large Scale** (1000+ users)
```
ECS Fargate (auto-scale):      $500+/month
RDS r5.large (Multi-AZ):       $300+/month
ElastiCache r5.large:          $200+/month
ALB:                           $50+/month
NAT Gateway:                   $100+/month
Data Transfer:                 $200+/month
CloudFront:                    $100+/month
EC2 p3.2xlarge (GPU):          $3000+/month

TOTAL: $4450+/month
```

**Cost Winner:**
- **Small/Medium**: Vercel ($84-300/month) vs AWS ($122-575/month)
- **Large Scale**: Similar costs, AWS slightly more

---

## Deployment Guides

## Part 1: Vercel Deployment (Recommended for Most Users)

### **Prerequisites**

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login
```

### **Step 1: Setup External Database (Neon)**

1. **Sign up for Neon**: https://neon.tech
2. **Create project**: `emailai-production`
3. **Copy connection string**:
   ```
   postgres://user:pass@ep-xxx.us-east-2.aws.neon.tech/emailai?sslmode=require
   ```

### **Step 2: Setup External Redis (Upstash)**

1. **Sign up for Upstash**: https://upstash.com
2. **Create Redis database**: `emailai-redis`
3. **Copy credentials**:
   ```
   UPSTASH_REDIS_URL=https://xxx.upstash.io
   UPSTASH_REDIS_TOKEN=xxx
   ```

### **Step 3: Configure Environment Variables**

Create `.env.production`:

```bash
# Database (Neon)
DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/emailai?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.neon.tech/emailai?sslmode=require"

# Domain
NEXTAUTH_URL=https://emailai.calldata.app

# Auth
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_ENCRYPT_SECRET=your-encrypt-secret
GOOGLE_ENCRYPT_SALT=your-encrypt-salt

# Redis (Upstash)
UPSTASH_REDIS_URL=https://xxx.upstash.io
UPSTASH_REDIS_TOKEN=xxx

# AI (Vast.ai or self-hosted)
OLLAMA_BASE_URL=https://ai.calldata.app/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
DEFAULT_LLM_PROVIDER=ollama

# Internal
INTERNAL_API_KEY=your-internal-key
API_KEY_SALT=your-api-key-salt
```

### **Step 4: Deploy to Vercel**

```bash
cd emailai

# First deployment
vercel --prod

# Follow prompts:
# ? Set up and deploy "~/emailai"? yes
# ? Which scope? Your Name
# ? Link to existing project? no
# ? What's your project's name? emailai
# ? In which directory is your code located? ./
# ? Want to override the settings? no

# Vercel will:
# 1. Build the Next.js app
# 2. Deploy to production
# 3. Give you a URL: https://emailai-xxx.vercel.app
```

### **Step 5: Add Custom Domain**

**Option A: Via Vercel Dashboard**

1. Go to: https://vercel.com/dashboard
2. Select project: `emailai`
3. Settings → Domains
4. Add domain: `emailai.calldata.app`
5. Follow DNS instructions (add CNAME to `cname.vercel-dns.com`)

**Option B: Via CLI**

```bash
vercel domains add emailai.calldata.app
```

### **Step 6: Add Environment Variables to Vercel**

**Option A: Via Dashboard**

1. Settings → Environment Variables
2. Add each variable from `.env.production`
3. Select: Production, Preview, Development

**Option B: Via CLI**

```bash
# Import all variables
vercel env pull .env.vercel.production

# Or add individually
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# etc...
```

### **Step 7: Run Database Migrations**

```bash
# Connect to production database
DATABASE_URL="postgresql://..." pnpm prisma migrate deploy
```

### **Step 8: Redeploy**

```bash
vercel --prod
```

### **Step 9: Configure DNS (Cloudflare)**

1. Go to Cloudflare DNS
2. Add record:
   ```
   Type: CNAME
   Name: emailai
   Target: cname.vercel-dns.com
   Proxy: Enabled (orange cloud)
   ```
3. Wait 5-10 minutes for propagation

### **Step 10: Update Google OAuth**

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Edit OAuth Client
3. Add redirect URI:
   ```
   https://emailai.calldata.app/api/auth/callback/google
   ```

### **Step 11: Test**

```bash
# Test deployment
curl https://emailai.calldata.app

# Open in browser
open https://emailai.calldata.app
```

### **✅ Vercel Deployment Complete!**

**Future deployments:**
```bash
# Just push to git - auto-deploys!
git push origin main

# Or manual:
vercel --prod
```

---

## Part 2: AWS Deployment (Enterprise/Full Control)

### **Prerequisites**

```bash
# Install AWS CLI
brew install awscli  # macOS
# or
sudo apt install awscli  # Linux

# Configure AWS credentials
aws configure
# AWS Access Key ID: xxx
# AWS Secret Access Key: xxx
# Default region: us-east-1
# Default output format: json

# Install ECS CLI (optional)
brew install amazon-ecs-cli

# Install Docker
# Follow: https://docs.docker.com/get-docker/
```

### **Architecture Overview**

We'll deploy using:
- **ECS Fargate** for containers (serverless, no EC2 management)
- **RDS PostgreSQL** for database
- **ElastiCache Redis** for caching
- **Application Load Balancer** for traffic
- **CloudFront** for CDN
- **Route 53** for DNS (optional, can use Cloudflare)
- **EC2** for Ollama GPU server

---

### **Step 1: Create VPC and Network**

```bash
# Create VPC
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=emailai-vpc}]'

# Note the VpcId from output
VPC_ID="vpc-xxxxx"

# Create public subnets (for ALB)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=emailai-public-1a}]'

aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=emailai-public-1b}]'

# Create private subnets (for ECS, RDS, ElastiCache)
aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.11.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=emailai-private-1a}]'

aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.12.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=emailai-private-1b}]'

# Create Internet Gateway
aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=emailai-igw}]'

IGW_ID="igw-xxxxx"

# Attach to VPC
aws ec2 attach-internet-gateway \
  --vpc-id $VPC_ID \
  --internet-gateway-id $IGW_ID

# Create NAT Gateway (for private subnets to access internet)
aws ec2 allocate-address --domain vpc
# Note AllocationId

aws ec2 create-nat-gateway \
  --subnet-id subnet-xxxxx \
  --allocation-id eipalloc-xxxxx

NAT_GATEWAY_ID="nat-xxxxx"
```

**Or use CloudFormation template** (much easier):

Save as `infrastructure.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: EmailAI Infrastructure

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: emailai-vpc

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: emailai-igw

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: emailai-public-1a

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: emailai-public-1b

  # Private Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: emailai-private-1a

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.12.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: emailai-private-1b

  # NAT Gateway
  NatGatewayEIP:
    Type: AWS::EC2::EIP
    DependsOn: AttachGateway
    Properties:
      Domain: vpc

  NatGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt NatGatewayEIP.AllocationId
      SubnetId: !Ref PublicSubnet1

  # Route Tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: emailai-public-rt

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: emailai-private-rt

  PrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NatGateway

  PrivateSubnet1RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet1
      RouteTableId: !Ref PrivateRouteTable

  PrivateSubnet2RouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet2
      RouteTableId: !Ref PrivateRouteTable

Outputs:
  VPCId:
    Value: !Ref VPC
  PublicSubnet1:
    Value: !Ref PublicSubnet1
  PublicSubnet2:
    Value: !Ref PublicSubnet2
  PrivateSubnet1:
    Value: !Ref PrivateSubnet1
  PrivateSubnet2:
    Value: !Ref PrivateSubnet2
```

Deploy the stack:

```bash
aws cloudformation create-stack \
  --stack-name emailai-infrastructure \
  --template-body file://infrastructure.yaml

# Wait for completion
aws cloudformation wait stack-create-complete \
  --stack-name emailai-infrastructure

# Get outputs
aws cloudformation describe-stacks \
  --stack-name emailai-infrastructure \
  --query 'Stacks[0].Outputs'
```

---

### **Step 2: Create RDS PostgreSQL Database**

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name emailai-db-subnet \
  --db-subnet-group-description "EmailAI DB Subnet Group" \
  --subnet-ids subnet-private1 subnet-private2

# Create security group for RDS
aws ec2 create-security-group \
  --group-name emailai-rds-sg \
  --description "Security group for EmailAI RDS" \
  --vpc-id $VPC_ID

RDS_SG_ID="sg-xxxxx"

# Allow PostgreSQL from ECS security group (create ECS SG first)
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG_ID \
  --protocol tcp \
  --port 5432 \
  --source-group $ECS_SG_ID

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier emailai-db \
  --db-instance-class db.t3.small \
  --engine postgres \
  --engine-version 14.7 \
  --master-username emailai \
  --master-user-password "YourSecurePassword123!" \
  --allocated-storage 20 \
  --db-subnet-group-name emailai-db-subnet \
  --vpc-security-group-ids $RDS_SG_ID \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "mon:04:00-mon:05:00" \
  --no-publicly-accessible

# Wait for creation (5-10 minutes)
aws rds wait db-instance-available \
  --db-instance-identifier emailai-db

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier emailai-db \
  --query 'DBInstances[0].Endpoint.Address'

# Result: emailai-db.xxxxx.us-east-1.rds.amazonaws.com
```

---

### **Step 3: Create ElastiCache Redis**

```bash
# Create cache subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name emailai-redis-subnet \
  --cache-subnet-group-description "EmailAI Redis Subnet Group" \
  --subnet-ids subnet-private1 subnet-private2

# Create security group for Redis
aws ec2 create-security-group \
  --group-name emailai-redis-sg \
  --description "Security group for EmailAI Redis" \
  --vpc-id $VPC_ID

REDIS_SG_ID="sg-xxxxx"

# Allow Redis from ECS
aws ec2 authorize-security-group-ingress \
  --group-id $REDIS_SG_ID \
  --protocol tcp \
  --port 6379 \
  --source-group $ECS_SG_ID

# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id emailai-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1 \
  --cache-subnet-group-name emailai-redis-subnet \
  --security-group-ids $REDIS_SG_ID

# Wait for creation
aws elasticache wait cache-cluster-available \
  --cache-cluster-id emailai-redis

# Get endpoint
aws elasticache describe-cache-clusters \
  --cache-cluster-id emailai-redis \
  --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address'

# Result: emailai-redis.xxxxx.cache.amazonaws.com
```

---

### **Step 4: Build and Push Docker Image**

Create `Dockerfile` in emailai root:

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build application
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "apps/web/server.js"]
```

Update `apps/web/next.config.mjs` to enable standalone:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // ... rest of config
};

export default nextConfig;
```

Build and push to ECR:

```bash
# Create ECR repository
aws ecr create-repository \
  --repository-name emailai \
  --region us-east-1

# Get repository URI
REPO_URI=$(aws ecr describe-repositories \
  --repository-names emailai \
  --query 'repositories[0].repositoryUri' \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $REPO_URI

# Build image
cd emailai
docker build -t emailai:latest .

# Tag image
docker tag emailai:latest $REPO_URI:latest

# Push image
docker push $REPO_URI:latest
```

---

### **Step 5: Create ECS Cluster and Service**

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name emailai-cluster \
  --capacity-providers FARGATE FARGATE_SPOT

# Create task execution role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Create task definition
cat > task-definition.json << 'EOF'
{
  "family": "emailai",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "emailai",
      "image": "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/emailai:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "NEXTAUTH_URL", "value": "https://emailai.calldata.app"},
        {"name": "DATABASE_URL", "value": "postgresql://emailai:password@emailai-db.xxxxx.rds.amazonaws.com:5432/emailai"},
        {"name": "UPSTASH_REDIS_URL", "value": "redis://emailai-redis.xxxxx.cache.amazonaws.com:6379"},
        {"name": "OLLAMA_BASE_URL", "value": "https://ai.calldata.app/api"},
        {"name": "NEXT_PUBLIC_OLLAMA_MODEL", "value": "llama3.3:70b"},
        {"name": "DEFAULT_LLM_PROVIDER", "value": "ollama"}
      ],
      "secrets": [
        {"name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:emailai/nextauth-secret"},
        {"name": "GOOGLE_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:emailai/google-client-id"},
        {"name": "GOOGLE_CLIENT_SECRET", "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:emailai/google-client-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emailai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://task-definition.json

# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name emailai-alb \
  --subnets subnet-public1 subnet-public2 \
  --security-groups $ALB_SG_ID \
  --scheme internet-facing

# Create target group
aws elbv2 create-target-group \
  --name emailai-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN

# Create ECS service
aws ecs create-service \
  --cluster emailai-cluster \
  --service-name emailai-service \
  --task-definition emailai:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-private1,subnet-private2],securityGroups=[$ECS_SG_ID]}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=emailai,containerPort=3000"
```

This is getting very long. I'll create separate detailed AWS deployment guide...

---

### **Step 6: Configure SSL Certificate (ACM)**

```bash
# Request certificate
aws acm request-certificate \
  --domain-name emailai.calldata.app \
  --subject-alternative-names *.calldata.app \
  --validation-method DNS

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --query 'CertificateSummaryList[0].CertificateArn' \
  --output text)

# Get validation DNS records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

# Add DNS record to Cloudflare (or Route 53)
# Type: CNAME
# Name: _xxx.emailai.calldata.app
# Value: _yyy.acm-validations.aws

# Wait for validation
aws acm wait certificate-validated \
  --certificate-arn $CERT_ARN
```

---

### **Step 7: Configure Route 53 or Cloudflare DNS**

**Option A: Route 53**

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names emailai-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

# Create hosted zone (if not exists)
aws route53 create-hosted-zone \
  --name calldata.app \
  --caller-reference $(date +%s)

# Get hosted zone ID
ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name calldata.app \
  --query 'HostedZones[0].Id' \
  --output text)

# Create DNS record
cat > dns-record.json << EOF
{
  "Changes": [{
    "Action": "CREATE",
    "ResourceRecordSet": {
      "Name": "emailai.calldata.app",
      "Type": "A",
      "AliasTarget": {
        "HostedZoneId": "Z35SXDOTRQ7X7K",
        "DNSName": "$ALB_DNS",
        "EvaluateTargetHealth": false
      }
    }
  }]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --change-batch file://dns-record.json
```

**Option B: Cloudflare** (Easier)

In Cloudflare DNS, add:
```
Type: CNAME
Name: emailai
Target: emailai-alb-xxxxx.us-east-1.elb.amazonaws.com
Proxy: Disabled (gray cloud)
```

---

### **Step 8: Deploy EC2 for Ollama GPU**

```bash
# Launch g4dn.xlarge instance (NVIDIA T4 GPU)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type g4dn.xlarge \
  --key-name your-key-pair \
  --security-group-ids $GPU_SG_ID \
  --subnet-id $PUBLIC_SUBNET_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":100}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=emailai-ollama}]'

# SSH to instance
ssh -i your-key.pem ubuntu@ec2-xxx.compute.amazonaws.com

# Deploy Ollama
cd /home/ubuntu
git clone https://github.com/your-org/emailai.git
cd emailai/ollama-server/scripts
sudo bash setup.sh prod

# Get instance IP
OLLAMA_IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=emailai-ollama" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

# Add DNS record for ai.calldata.app → $OLLAMA_IP
```

---

### **✅ AWS Deployment Complete!**

Access: `https://emailai.calldata.app`

---

## Summary: Which Should You Choose?

### **Choose Vercel if:**
- ✅ You want fast deployment (< 1 hour)
- ✅ You're okay with external services (Neon, Upstash)
- ✅ You want automatic scaling and SSL
- ✅ You have budget constraints ($84-300/month)
- ✅ You're a startup or small team

### **Choose AWS if:**
- ✅ You need full infrastructure control
- ✅ You want everything in one provider
- ✅ You have DevOps expertise
- ✅ You need compliance (VPC, private subnets)
- ✅ You're enterprise scale
- ✅ Budget is not primary concern ($500+/month)

---

## Hybrid Approach (Best of Both)

**Recommended for most teams:**

```
Vercel:
├── emailai.calldata.app (web app)
├── docs.calldata.app (docs)
└── admin.calldata.app (admin dashboard)

AWS:
├── RDS PostgreSQL (database)
├── ElastiCache Redis (cache)
└── EC2 g4dn.xlarge (Ollama GPU)
```

**Benefits:**
- Fast deployment (Vercel)
- Managed database (AWS RDS)
- Cost-effective GPU (AWS EC2)
- Best of both worlds

**Setup:**
1. Deploy database to AWS RDS
2. Deploy EmailAI to Vercel
3. Deploy Ollama to AWS EC2
4. Connect via VPC peering or public endpoints

---

**Next Steps:**
- See [DOMAIN_CONFIGURATION_GUIDE.md](./DOMAIN_CONFIGURATION_GUIDE.md) for DNS setup
- See [AWS_DETAILED_DEPLOYMENT.md](./AWS_DETAILED_DEPLOYMENT.md) for complete AWS guide (if needed)
