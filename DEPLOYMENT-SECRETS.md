# EmailAI Production - GitHub Secrets Configuration

This document lists all GitHub secrets required for the EmailAI production deployment workflow.

## Required GitHub Secrets

Navigate to: **Settings → Secrets and variables → Actions → New repository secret**

### AWS Credentials

| Secret Name             | Description                                        | Example/Generate  |
| ----------------------- | -------------------------------------------------- | ----------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key with EC2, RDS, VPC, IAM permissions | From AWS IAM user |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key                              | From AWS IAM user |

### Database

| Secret Name           | Description                         | Example/Generate          |
| --------------------- | ----------------------------------- | ------------------------- |
| `EMAILAI_DB_PASSWORD` | PostgreSQL database master password | `openssl rand -base64 32` |
| `EMAILAI_DB_USER`     | PostgreSQL master username          | `emailai_admin`           |

### Application Auth

| Secret Name                | Description                     | Example/Generate       |
| -------------------------- | ------------------------------- | ---------------------- |
| `EMAILAI_NEXTAUTH_SECRET`  | NextAuth session encryption key | `openssl rand -hex 32` |
| `EMAILAI_INTERNAL_API_KEY` | Internal API authentication key | `openssl rand -hex 32` |
| `EMAILAI_API_KEY_SALT`     | Salt for API key hashing        | `openssl rand -hex 32` |

### Google OAuth & PubSub

| Secret Name                        | Description                       | Example/Generate                       |
| ---------------------------------- | --------------------------------- | -------------------------------------- |
| `GOOGLE_CLIENT_ID`                 | Google OAuth client ID            | From Google Cloud Console              |
| `GOOGLE_CLIENT_SECRET`             | Google OAuth client secret        | From Google Cloud Console              |
| `GOOGLE_ENCRYPT_SECRET`            | Encryption key for Google tokens  | `openssl rand -hex 32`                 |
| `GOOGLE_ENCRYPT_SALT`              | Salt for Google token encryption  | `openssl rand -hex 16`                 |
| `GOOGLE_PUBSUB_TOPIC_NAME`         | PubSub topic for Gmail webhooks   | `projects/YOUR_PROJECT/topics/emailai` |
| `GOOGLE_PUBSUB_VERIFICATION_TOKEN` | PubSub webhook verification token | `openssl rand -hex 32`                 |

### Redis/Cache (Upstash)

| Secret Name                  | Description                               | Example/Generate               |
| ---------------------------- | ----------------------------------------- | ------------------------------ |
| `UPSTASH_REDIS_URL`          | Upstash Redis connection URL              | From Upstash dashboard         |
| `UPSTASH_REDIS_TOKEN`        | Upstash Redis auth token                  | From Upstash dashboard         |
| `REDIS_URL`                  | Redis connection string for subscriptions | `rediss://:password@host:port` |
| `QSTASH_TOKEN`               | QStash authentication token               | From Upstash QStash            |
| `QSTASH_CURRENT_SIGNING_KEY` | Current QStash signing key                | From Upstash QStash            |
| `QSTASH_NEXT_SIGNING_KEY`    | Next QStash signing key                   | From Upstash QStash            |

### AI Models (Vast.ai)

| Secret Name         | Description                 | Example/Generate       |
| ------------------- | --------------------------- | ---------------------- |
| `VASTAI_OLLAMA_URL` | Vast.ai Ollama API endpoint | `http://HOST:PORT/api` |

### Optional: Cloud AI Providers (Fallback)

| Secret Name         | Description                           | Example/Generate         |
| ------------------- | ------------------------------------- | ------------------------ |
| `OPENAI_API_KEY`    | OpenAI API key (optional fallback)    | From OpenAI dashboard    |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional fallback) | From Anthropic dashboard |

### Optional: Monitoring & Analytics

| Secret Name   | Description               | Example/Generate       |
| ------------- | ------------------------- | ---------------------- |
| `POSTHOG_KEY` | PostHog analytics key     | From PostHog dashboard |
| `SENTRY_DSN`  | Sentry error tracking DSN | From Sentry dashboard  |

### SSL/TLS Certificate

| Secret Name               | Description                       | Example/Generate                               |
| ------------------------- | --------------------------------- | ---------------------------------------------- |
| `EMAILAI_CERTIFICATE_ARN` | AWS ACM certificate ARN for HTTPS | `arn:aws:acm:us-east-1:ACCOUNT:certificate/ID` |

_Leave empty for HTTP-only deployment (not recommended for production)_

## Quick Setup Script

Run these commands to generate all random secrets:

```bash
#!/bin/bash

echo "=== EmailAI Production Secrets Generator ==="
echo ""
echo "Copy these values to GitHub Secrets:"
echo ""

echo "EMAILAI_DB_PASSWORD=$(openssl rand -base64 32)"
echo "EMAILAI_NEXTAUTH_SECRET=$(openssl rand -hex 32)"
echo "EMAILAI_INTERNAL_API_KEY=$(openssl rand -hex 32)"
echo "EMAILAI_API_KEY_SALT=$(openssl rand -hex 32)"
echo "GOOGLE_ENCRYPT_SECRET=$(openssl rand -hex 32)"
echo "GOOGLE_ENCRYPT_SALT=$(openssl rand -hex 16)"
echo "GOOGLE_PUBSUB_VERIFICATION_TOKEN=$(openssl rand -hex 32)"

echo ""
echo "=== Manual Configuration Required ==="
echo ""
echo "1. AWS Credentials (from IAM user)"
echo "2. Google OAuth (from Google Cloud Console)"
echo "3. Google PubSub Topic Name"
echo "4. Upstash Redis/QStash (from Upstash dashboard)"
echo "5. Vast.ai Ollama URL"
echo "6. (Optional) ACM Certificate ARN"
echo ""
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Gmail API
4. Create OAuth 2.0 credentials:
   - **Authorized redirect URIs**: `https://emailai.calldata.app/api/auth/callback/google`
5. Copy Client ID and Client Secret

## Google PubSub Setup

1. In Google Cloud Console, enable Cloud Pub/Sub API
2. Create topic: `emailai`
3. Copy full topic name: `projects/YOUR_PROJECT_ID/topics/emailai`
4. Configure push subscription (done by application at runtime)

## Upstash Setup

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create Redis database
3. Copy connection URL and token
4. Create QStash project
5. Copy QStash token and signing keys

## AWS ACM Certificate

1. Go to AWS Certificate Manager in us-east-1
2. Request public certificate for `emailai.calldata.app`
3. Validate via DNS (add CNAME records)
4. Copy ARN when issued

## Vast.ai Setup

1. Create GPU instance (RTX 4090 recommended)
2. Install Ollama:
   ```bash
   curl https://ollama.ai/install.sh | sh
   ```
3. Pull model:
   ```bash
   ollama pull llama3.3:70b
   ```
4. Get external connection info (HOST:PORT)
5. Format URL: `http://HOST:PORT/api`

## Security Notes

- **NEVER commit secrets to git**
- Rotate secrets regularly (quarterly minimum)
- Use strong, unique passwords for database
- Monitor AWS CloudTrail for unauthorized access
- Enable GitHub secret scanning
- Restrict AWS IAM permissions to minimum required

## Testing Secrets

Before deployment, verify secrets are set:

```bash
gh secret list
```

Expected output should show all required secrets (values hidden).
