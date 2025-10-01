# EmailAI Multi-Tenant Deployment Guide

## Overview

This guide covers deploying the multi-tenant EmailAI application to production. It includes infrastructure setup, database configuration, application deployment, and operational procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Database Setup](#database-setup)
4. [Application Deployment](#application-deployment)
5. [Environment Variables](#environment-variables)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring & Health Checks](#monitoring--health-checks)
8. [Backup & Disaster Recovery](#backup--disaster-recovery)
9. [Scaling & Performance](#scaling--performance)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

**Application Server:**
- Node.js 18+ LTS
- 2+ CPU cores
- 4GB+ RAM (8GB recommended)
- 20GB+ disk space

**Database Server:**
- PostgreSQL 14+
- 4+ CPU cores
- 8GB+ RAM (16GB recommended)
- 100GB+ SSD storage
- Connection pooling configured

**Additional Services:**
- Redis (for sessions/caching) - Optional but recommended
- Email service (SendGrid, Resend, etc.)
- OAuth provider (Google) configured
- Payment provider (Stripe or LemonSqueezy) configured

### Required Accounts

- [ ] Google Cloud Console (for OAuth)
- [ ] Stripe or LemonSqueezy account
- [ ] Domain registrar access (for DNS)
- [ ] SSL certificate provider
- [ ] Monitoring service (Sentry, Datadog, etc.)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                       │
│                    (SSL Termination)                    │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐
    │   App 1    │  │   App 2    │  │   App 3    │
    │  (Next.js) │  │  (Next.js) │  │  (Next.js) │
    └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │   (Primary) │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │  (Replica)  │
                    └─────────────┘
```

### Components

**Next.js Application:**
- Handles HTTP requests
- Server-side rendering
- API routes
- Background jobs (Gmail sync, automation)

**PostgreSQL Database:**
- Primary data store
- Multi-tenant data isolation
- Indexed for performance

**Redis (Optional):**
- Session storage
- Rate limiting
- Caching layer

## Database Setup

### 1. Provision PostgreSQL Instance

**Option A: Managed Service (Recommended)**

**Vercel Postgres:**
```bash
# Install Vercel CLI
npm i -g vercel

# Create database
vercel postgres create emailai-prod

# Get connection string
vercel postgres connection-string emailai-prod
```

**AWS RDS:**
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier emailai-prod \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --master-username emailai \
  --master-user-password YOUR_SECURE_PASSWORD \
  --allocated-storage 100 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --multi-az
```

**DigitalOcean Managed Database:**
```bash
# Create via CLI
doctl databases create emailai-prod \
  --engine pg \
  --version 15 \
  --size db-s-2vcpu-4gb \
  --region nyc1
```

**Option B: Self-Hosted**

```bash
# Install PostgreSQL 15
sudo apt update
sudo apt install postgresql-15 postgresql-contrib-15

# Configure PostgreSQL
sudo -u postgres psql

-- Create database and user
CREATE DATABASE emailai_prod;
CREATE USER emailai WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE emailai_prod TO emailai;
ALTER DATABASE emailai_prod OWNER TO emailai;

-- Enable extensions
\c emailai_prod
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 2. Configure Connection Pooling

**Using PgBouncer:**

```bash
# Install PgBouncer
sudo apt install pgbouncer

# Configure /etc/pgbouncer/pgbouncer.ini
[databases]
emailai_prod = host=localhost port=5432 dbname=emailai_prod

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
```

**Using Prisma Accelerate:**

```bash
# Enable Prisma Accelerate for connection pooling
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_URL="postgresql://user:pass@host:5432/emailai_prod"
```

### 3. Run Database Migrations

```bash
# Navigate to web app
cd apps/web

# Set production database URL
export DATABASE_URL="postgresql://emailai:password@db.example.com:5432/emailai_prod"

# Run migrations
npx prisma migrate deploy

# Verify schema
npx prisma db pull
```

### 4. Seed Initial Data (Optional)

```bash
# Create seed script if needed
npx prisma db seed

# Or manually create admin user
psql $DATABASE_URL -c "INSERT INTO users (id, email, name) VALUES (gen_random_uuid(), 'admin@example.com', 'Admin User');"
```

## Application Deployment

### Option 1: Vercel (Recommended for Next.js)

**1. Install Vercel CLI:**
```bash
npm i -g vercel
```

**2. Configure Environment Variables:**

Create `.env.production`:
```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For migrations

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Payment Provider
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
# OR
LEMON_SQUEEZY_API_KEY="..."
LEMON_SQUEEZY_WEBHOOK_SECRET="..."

# Email Service
RESEND_API_KEY="re_..."

# Monitoring
SENTRY_DSN="https://...@sentry.io/..."
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# Application
NODE_ENV="production"
NEXT_TELEMETRY_DISABLED=1
```

**3. Deploy:**
```bash
# Link to Vercel project
vercel link

# Add environment variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
# ... add all other env vars

# Deploy to production
vercel --prod
```

**4. Configure Custom Domain:**
```bash
# Add domain
vercel domains add yourdomain.com

# Configure DNS
# Add CNAME record: yourdomain.com -> cname.vercel-dns.com
```

### Option 2: Docker (Self-Hosted)

**1. Create Dockerfile:**

`apps/web/Dockerfile`:
```dockerfile
FROM node:18-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED 1
RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000

CMD ["node", "server.js"]
```

**2. Docker Compose Setup:**

`docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  app:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:15-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=emailai_prod
      - POSTGRES_USER=emailai
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    ports:
      - "5432:5432"
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U emailai"]
      interval: 10s
      timeout: 5s
      retries: 5

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
```

**3. Build and Deploy:**
```bash
# Build images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Run migrations
docker-compose -f docker-compose.prod.yml exec app npx prisma migrate deploy
```

### Option 3: AWS ECS/Fargate

**1. Create ECR Repository:**
```bash
# Create repository
aws ecr create-repository --repository-name emailai-prod

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com

# Build and push
docker build -t emailai-prod ./apps/web
docker tag emailai-prod:latest YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/emailai-prod:latest
docker push YOUR_AWS_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/emailai-prod:latest
```

**2. Create Task Definition:**

`ecs-task-definition.json`:
```json
{
  "family": "emailai-prod",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "emailai-app",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/emailai-prod:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "NEXTAUTH_URL", "value": "https://yourdomain.com"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
        {"name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:..."}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/emailai-prod",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

**3. Create Service:**
```bash
# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create service with load balancer
aws ecs create-service \
  --cluster emailai-prod \
  --service-name emailai-app \
  --task-definition emailai-prod \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=emailai-app,containerPort=3000"
```

### Option 4: DigitalOcean App Platform

**1. Create `app.yaml`:**
```yaml
name: emailai-prod
region: nyc

services:
- name: web
  github:
    repo: your-org/emailai
    branch: main
    deploy_on_push: true
  build_command: npm run build
  run_command: npm start
  instance_count: 2
  instance_size_slug: professional-s
  http_port: 3000

  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    value: ${db.DATABASE_URL}
  - key: NEXTAUTH_SECRET
    type: SECRET
    value: YOUR_SECRET

  health_check:
    http_path: /api/health

databases:
- name: db
  engine: PG
  version: "15"
  size: db-s-2vcpu-4gb
```

**2. Deploy:**
```bash
# Install doctl
snap install doctl

# Authenticate
doctl auth init

# Create app
doctl apps create --spec app.yaml

# Monitor deployment
doctl apps list
doctl apps logs YOUR_APP_ID
```

## Environment Variables

### Required Variables

```bash
# Database (Required)
DATABASE_URL="postgresql://user:pass@host:5432/emailai_prod"
DIRECT_URL="postgresql://user:pass@host:5432/emailai_prod"  # For migrations

# Authentication (Required)
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
GOOGLE_CLIENT_ID="xxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxx"

# Payment Provider (Choose One - Required)
STRIPE_SECRET_KEY="sk_live_xxx"
STRIPE_WEBHOOK_SECRET="whsec_xxx"
STRIPE_PUBLISHABLE_KEY="pk_live_xxx"
# OR
LEMON_SQUEEZY_API_KEY="xxx"
LEMON_SQUEEZY_WEBHOOK_SECRET="xxx"
LEMON_SQUEEZY_STORE_ID="xxx"

# Email Service (Required for notifications)
RESEND_API_KEY="re_xxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"

# Application (Required)
NODE_ENV="production"
NEXT_PUBLIC_BASE_URL="https://yourdomain.com"
```

### Optional Variables

```bash
# Monitoring
SENTRY_DSN="https://xxx@sentry.io/xxx"
SENTRY_AUTH_TOKEN="xxx"
NEXT_PUBLIC_POSTHOG_KEY="phc_xxx"
NEXT_PUBLIC_POSTHOG_HOST="https://app.posthog.com"

# Feature Flags
NEXT_PUBLIC_ENABLE_ORGANIZATIONS="true"
NEXT_PUBLIC_ENABLE_COLD_EMAIL_BLOCKER="true"

# Rate Limiting
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxx"

# Caching
REDIS_URL="redis://localhost:6379"

# Logging
LOG_LEVEL="info"
AXIOM_TOKEN="xxx"
AXIOM_DATASET="production"
```

### Generating Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# Encryption keys
openssl rand -hex 32

# Webhook secrets
openssl rand -hex 64
```

## SSL/TLS Configuration

### Option 1: Vercel (Automatic)

Vercel automatically provisions SSL certificates for custom domains. No configuration needed.

### Option 2: Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is configured automatically via cron
# Test renewal
sudo certbot renew --dry-run
```

### Option 3: CloudFlare (Recommended)

**1. Add Domain to CloudFlare:**
- Sign up at cloudflare.com
- Add your domain
- Update nameservers at registrar

**2. Configure SSL:**
- SSL/TLS → Overview → Full (strict)
- Edge Certificates → Always Use HTTPS: On
- Edge Certificates → Automatic HTTPS Rewrites: On
- Edge Certificates → Minimum TLS Version: 1.2

**3. Origin Certificate:**
```bash
# Generate origin certificate in CloudFlare dashboard
# SSL/TLS → Origin Server → Create Certificate

# Download and install
sudo mkdir -p /etc/nginx/ssl
sudo cp origin-cert.pem /etc/nginx/ssl/
sudo cp origin-key.pem /etc/nginx/ssl/
```

### Nginx SSL Configuration

`/etc/nginx/sites-available/emailai`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/origin-cert.pem;
    ssl_certificate_key /etc/nginx/ssl/origin-key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring & Health Checks

### Health Check Endpoint

Create `app/api/health/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/utils/prisma";

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
```

### Application Monitoring

**Sentry Setup:**

`apps/web/instrumentation.ts`:
```typescript
import * as Sentry from "@sentry/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        // Remove sensitive data
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        return event;
      },
    });
  }
}
```

**PostHog Analytics:**

`app/providers/PostHogProvider.tsx`:
```typescript
'use client';

import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
        capture_pageview: false,
      });
    }
  }, []);

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
```

### Database Monitoring

**Query Performance Monitoring:**

```typescript
// Add to prisma client
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > 100) {
    console.warn('Slow query detected:', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});
```

**Connection Pool Monitoring:**

```typescript
// Monitor Prisma connection pool
setInterval(async () => {
  const metrics = await prisma.$metrics.json();
  console.log('Database metrics:', {
    activeConnections: metrics.gauges.find(g => g.key === 'prisma_pool_connections_open')?.value,
    idleConnections: metrics.gauges.find(g => g.key === 'prisma_pool_connections_idle')?.value,
  });
}, 60000);
```

### Uptime Monitoring

**UptimeRobot Configuration:**
```
Monitor Type: HTTPS
URL: https://yourdomain.com/api/health
Interval: 5 minutes
Alert Contacts: your-email@example.com
```

**Better Uptime Configuration:**
```yaml
monitors:
  - name: EmailAI Production
    url: https://yourdomain.com/api/health
    method: GET
    interval: 60
    timeout: 30
    expected_status_codes: [200]
    alert_emails:
      - ops@example.com
```

## Backup & Disaster Recovery

### Database Backups

**Automated Backups (PostgreSQL):**

```bash
#!/bin/bash
# /opt/scripts/backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="emailai_prod"
RETENTION_DAYS=30

# Create backup
pg_dump -h localhost -U emailai -F c -b -v -f "$BACKUP_DIR/emailai_$TIMESTAMP.backup" $DB_NAME

# Compress
gzip "$BACKUP_DIR/emailai_$TIMESTAMP.backup"

# Upload to S3
aws s3 cp "$BACKUP_DIR/emailai_$TIMESTAMP.backup.gz" s3://emailai-backups/database/

# Cleanup old backups
find $BACKUP_DIR -name "*.backup.gz" -mtime +$RETENTION_DAYS -delete

# Verify backup
if [ $? -eq 0 ]; then
    echo "Backup successful: emailai_$TIMESTAMP.backup.gz"
else
    echo "Backup failed!" | mail -s "Database Backup Failed" ops@example.com
fi
```

**Crontab Entry:**
```bash
# Run daily at 2 AM
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

### Restore Procedure

```bash
# Download backup from S3
aws s3 cp s3://emailai-backups/database/emailai_20240101_020000.backup.gz ./

# Decompress
gunzip emailai_20240101_020000.backup.gz

# Stop application
docker-compose down app

# Restore database
pg_restore -h localhost -U emailai -d emailai_prod -c -v emailai_20240101_020000.backup

# Restart application
docker-compose up -d app

# Verify
curl https://yourdomain.com/api/health
```

### Point-in-Time Recovery

**Enable WAL Archiving:**

`postgresql.conf`:
```conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://emailai-backups/wal/%f'
archive_timeout = 300
```

**Perform PITR:**
```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Restore base backup
pg_restore -d emailai_prod emailai_base_backup.backup

# Create recovery.conf
cat > /var/lib/postgresql/15/main/recovery.conf <<EOF
restore_command = 'aws s3 cp s3://emailai-backups/wal/%f %p'
recovery_target_time = '2024-01-01 14:30:00'
EOF

# Start PostgreSQL (will enter recovery mode)
sudo systemctl start postgresql

# Verify recovery
psql -U emailai -d emailai_prod -c "SELECT NOW();"
```

### Application Backups

**File System Backup:**
```bash
#!/bin/bash
# Backup uploaded files, logs, etc.

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "/backups/app/emailai_app_$TIMESTAMP.tar.gz" \
  /var/www/emailai/uploads \
  /var/www/emailai/.env.production \
  /var/log/emailai

# Upload to S3
aws s3 cp "/backups/app/emailai_app_$TIMESTAMP.tar.gz" s3://emailai-backups/application/

# Cleanup
find /backups/app -name "*.tar.gz" -mtime +30 -delete
```

## Scaling & Performance

### Horizontal Scaling

**Load Balancer Configuration (Nginx):**

```nginx
upstream emailai_backend {
    least_conn;
    server app1.internal:3000 max_fails=3 fail_timeout=30s;
    server app2.internal:3000 max_fails=3 fail_timeout=30s;
    server app3.internal:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        proxy_pass http://emailai_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Health check
        proxy_next_upstream error timeout http_502 http_503 http_504;
    }
}
```

### Database Scaling

**Read Replicas:**

```typescript
// Configure Prisma with read replicas
import { PrismaClient } from '@prisma/client';

const prismaWrite = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL }, // Primary
  },
});

const prismaRead = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_READ_URL }, // Replica
  },
});

export async function getOrganization(id: string) {
  // Use read replica for queries
  return prismaRead.organization.findUnique({ where: { id } });
}

export async function updateOrganization(id: string, data: any) {
  // Use primary for writes
  return prismaWrite.organization.update({ where: { id }, data });
}
```

**Connection Pooling:**

```typescript
// Increase connection pool size for production
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=30',
    },
  },
});
```

### Caching Strategy

**Redis Caching:**

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCachedOrganization(id: string) {
  // Try cache first
  const cached = await redis.get(`org:${id}`);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const org = await prisma.organization.findUnique({ where: { id } });

  // Cache for 5 minutes
  if (org) {
    await redis.setex(`org:${id}`, 300, JSON.stringify(org));
  }

  return org;
}
```

### Performance Optimization Checklist

- [ ] Database indexes on frequently queried columns
- [ ] Connection pooling configured (min 5, max 25)
- [ ] Image optimization (next/image with CDN)
- [ ] Static assets on CDN (CloudFlare, CloudFront)
- [ ] Gzip compression enabled
- [ ] HTTP/2 enabled
- [ ] Lazy loading for heavy components
- [ ] API response caching (stale-while-revalidate)
- [ ] Database query optimization (avoid N+1)
- [ ] Rate limiting implemented

## Troubleshooting

### Common Issues

**Issue: Application won't start**

```bash
# Check logs
docker-compose logs app

# Common causes:
# 1. Database connection failed
#    - Verify DATABASE_URL
#    - Check database is running: pg_isready -h db -U emailai

# 2. Missing environment variables
#    - Check .env.production has all required vars
#    - Verify: docker-compose config

# 3. Port already in use
#    - Find process: lsof -i :3000
#    - Kill process: kill -9 <PID>
```

**Issue: Database migration fails**

```bash
# Check migration status
npx prisma migrate status

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset

# Apply migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

**Issue: OAuth authentication fails**

```bash
# Verify environment variables
echo $GOOGLE_CLIENT_ID
echo $NEXTAUTH_URL

# Check OAuth consent screen configuration
# - Authorized redirect URIs must include: https://yourdomain.com/api/auth/callback/google

# Test OAuth flow
curl https://yourdomain.com/api/auth/providers
```

**Issue: High database load**

```sql
-- Find slow queries
SELECT pid, now() - query_start as duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';

-- Kill slow query
SELECT pg_terminate_backend(PID);

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1;
```

**Issue: Memory leaks**

```bash
# Monitor memory usage
docker stats emailai_app

# Check for memory leaks in Node.js
node --inspect=0.0.0.0:9229 server.js

# Connect Chrome DevTools to localhost:9229
# Take heap snapshots to identify leaks
```

### Deployment Checklist

**Pre-Deployment:**
- [ ] All tests passing (`npm test`)
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Backup completed
- [ ] Rollback plan documented

**Deployment:**
- [ ] Run database migrations
- [ ] Deploy application
- [ ] Verify health check endpoint
- [ ] Test critical user flows
- [ ] Check error monitoring (Sentry)
- [ ] Monitor application logs

**Post-Deployment:**
- [ ] Verify all services running
- [ ] Check database connection pool
- [ ] Monitor response times
- [ ] Test email sending
- [ ] Verify OAuth login
- [ ] Check payment webhooks
- [ ] Update status page

### Emergency Rollback

```bash
# Rollback application (Vercel)
vercel rollback

# Rollback application (Docker)
docker-compose down
docker-compose up -d --force-recreate

# Rollback database migrations
npx prisma migrate resolve --rolled-back <migration_name>

# Restore database from backup
pg_restore -h localhost -U emailai -d emailai_prod -c backup.dump

# Verify rollback
curl https://yourdomain.com/api/health
```

## Security Best Practices

### Production Security Checklist

- [ ] HTTPS enforced (no HTTP traffic)
- [ ] Environment variables secured (not in code)
- [ ] Database credentials rotated regularly
- [ ] OAuth secrets secured
- [ ] Rate limiting enabled
- [ ] CSRF protection enabled (NextAuth default)
- [ ] SQL injection protection (Prisma parameterized queries)
- [ ] XSS protection (React escaping)
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Dependency vulnerabilities scanned (`npm audit`)
- [ ] Secrets encrypted at rest
- [ ] Audit logging enabled
- [ ] Regular security updates applied
- [ ] Backups encrypted
- [ ] Access logs monitored

### Security Headers

```typescript
// next.config.mjs
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

export default {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
```

## Support & Maintenance

**Regular Maintenance Tasks:**

**Daily:**
- Monitor application health
- Check error rates in Sentry
- Review application logs

**Weekly:**
- Review database performance
- Check backup success
- Analyze slow query logs
- Review security alerts

**Monthly:**
- Rotate secrets/credentials
- Update dependencies
- Review and optimize costs
- Capacity planning review

**Quarterly:**
- Security audit
- Disaster recovery test
- Performance optimization
- Documentation update

**Contact Information:**
- Production issues: ops@example.com
- Security incidents: security@example.com
- Escalation: CTO phone number

---

**Next Steps:**
- See [MONITORING_SETUP.md](MONITORING_SETUP.md) for detailed monitoring configuration
- See [MIGRATION_RUNBOOK.md](MIGRATION_RUNBOOK.md) for production migration procedures
- See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for security testing
