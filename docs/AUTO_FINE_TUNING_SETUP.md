# Automatic Per-User Fine-Tuning Setup Guide

This guide explains how to set up automatic fine-tuning of personalized AI models for each user based on their email history.

## Overview

When users send enough emails (100+), they become eligible for a personalized AI model that learns their writing style. This happens automatically through a job-based system.

## Architecture

```
User sends emails
    ↓
Auto-check eligibility (every 10 emails)
    ↓
User clicks "Train Model" in Settings
    ↓
API creates FineTuningJob (status: PENDING)
    ↓
Worker process picks up job
    ↓
├─→ Extract user's sent emails (100-500)
├─→ Convert to training format
├─→ Train model on GPU (2-4 hours)
├─→ Deploy to Ollama server
└─→ Update user's aiModel in database
    ↓
User now uses personalized model automatically
```

## Components Created

### 1. Database Schema

**New Model**: `FineTuningJob`
- Tracks training progress
- Stores job metadata
- Links to user

**Migration needed**:
```bash
cd apps/web
npx prisma migrate dev --name add_fine_tuning_jobs
```

### 2. Fine-Tuning Service

**File**: `apps/web/utils/ai/fine-tuning/fine-tuning-service.ts`

**Methods**:
- `isEligibleForFineTuning()` - Check if user has enough emails
- `createJob()` - Create a new fine-tuning job
- `updateJob()` - Update job status
- `autoCheckAndNotify()` - Auto-check eligibility

### 3. API Endpoints

**POST /api/user/ai/fine-tune**
- Creates a new fine-tuning job
- Requires 100+ sent emails
- Returns job ID and status

**GET /api/user/ai/fine-tune**
- Get job status and history
- Shows eligibility info

**DELETE /api/user/ai/fine-tune?jobId=xxx**
- Cancel an in-progress job

**POST /api/webhooks/fine-tuning**
- Receives status updates from worker
- Requires INTERNAL_API_KEY authentication

### 4. UI Component

**File**: `apps/web/app/(app)/[emailAccountId]/settings/AIModelSection.tsx`

**Features**:
- Shows eligibility status
- Displays training progress
- Shows completed models
- Training history

**Add to Settings Page**:
```tsx
// apps/web/app/(app)/[emailAccountId]/settings/page.tsx
import { AIModelSection } from "./AIModelSection";

export default function SettingsPage() {
  return (
    <div>
      {/* ... other settings ... */}
      <AIModelSection />
    </div>
  );
}
```

### 5. Worker Script

**File**: `scripts/fine-tuning-worker.ts`

Processes pending jobs:
```bash
# Process all pending jobs
ts-node scripts/fine-tuning-worker.ts

# Process specific job
ts-node scripts/fine-tuning-worker.ts --job-id=xyz123
```

### 6. Auto-Check System

**File**: `apps/web/utils/ai/fine-tuning/auto-check-eligibility.ts`

**Integration**: Add to Gmail webhook handler:
```typescript
// In apps/web/app/api/google/webhook/route.ts
import { checkEligibilityAfterEmailSent } from "@/utils/ai/fine-tuning/auto-check-eligibility";

// After processing sent email:
if (message.labelIds?.includes("SENT")) {
  await checkEligibilityAfterEmailSent(emailAccount.userId);
}
```

## Setup Instructions

### Step 1: Run Database Migration

```bash
cd apps/web
npx prisma migrate dev --name add_fine_tuning_jobs
npx prisma generate
```

### Step 2: Add Environment Variables

Add to `apps/web/.env`:
```bash
# Fine-tuning webhook URL (optional, defaults to NEXTAUTH_URL/api/webhooks/fine-tuning)
FINE_TUNING_WEBHOOK_URL=https://yourdomain.com/api/webhooks/fine-tuning

# Internal API key (already exists in setup script)
INTERNAL_API_KEY=your-internal-key

# Ollama server URL (already configured)
OLLAMA_BASE_URL=https://ai.calldata.app/api
```

### Step 3: Set Up Worker Process

#### Option A: Cron Job (Simple)

```bash
# Add to crontab
# Run every 15 minutes
*/15 * * * * cd /path/to/emailai && ts-node scripts/fine-tuning-worker.ts

# Or use node-cron in your app
```

#### Option B: Systemd Service (Production)

Create `/etc/systemd/system/emailai-fine-tuning-worker.service`:
```ini
[Unit]
Description=EmailAI Fine-Tuning Worker
After=network.target

[Service]
Type=simple
User=emailai
WorkingDirectory=/opt/emailai
ExecStart=/usr/bin/node scripts/fine-tuning-worker.ts
Restart=always
RestartSec=300

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable emailai-fine-tuning-worker
sudo systemctl start emailai-fine-tuning-worker
```

#### Option C: Queue System (Advanced)

Use BullMQ, AWS SQS, or similar:
```typescript
// In API endpoint after creating job
await queue.add('fine-tune-model', {
  jobId: job.id,
  userId: session.user.id,
});
```

### Step 4: Set Up GPU Server

The worker needs access to a GPU for training. Options:

#### Option 1: Vast.ai (Recommended)

```bash
# Worker automatically provisions Vast.ai instances
# Set API key:
export VASTAI_API_KEY=your-api-key

# The worker will:
# 1. Rent a GPU instance
# 2. Upload training code
# 3. Run training
# 4. Download model
# 5. Destroy instance
```

#### Option 2: Dedicated GPU Server

```bash
# On server with GPU:
cd ollama-server/fine-tuning
pip install -r configs/requirements.txt

# Run worker on this machine
ts-node scripts/fine-tuning-worker.ts
```

#### Option 3: Cloud GPU (AWS, GCP)

Use EC2 g4dn.xlarge or similar with the worker script.

### Step 5: Add UI to Settings Page

```typescript
// apps/web/app/(app)/[emailAccountId]/settings/page.tsx
import { AIModelSection } from "./AIModelSection";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Existing settings sections */}

      {/* Add this: */}
      <AIModelSection />
    </div>
  );
}
```

### Step 6: Enable Auto-Check (Optional)

Add to Gmail webhook handler:

```typescript
// apps/web/app/api/google/webhook/route.ts
import { checkEligibilityAfterEmailSent } from "@/utils/ai/fine-tuning/auto-check-eligibility";

// In your message processing logic:
if (message.labelIds?.includes("SENT")) {
  // Check eligibility after user sends email
  checkEligibilityAfterEmailSent(emailAccount.userId).catch((error) => {
    logger.error("Failed to check fine-tuning eligibility", { error });
  });
}
```

## Usage Flow

### User Perspective

1. **User sends 100+ emails** over time
2. **System shows notification**: "Train your personalized AI model!"
3. **User goes to Settings** → AI Model section
4. **User clicks "Train Personalized Model"**
5. **Progress bar shows**: "Training in progress (2-4 hours)"
6. **Training completes**: "✓ Personalized model active"
7. **All future AI replies** use their trained model automatically

### Admin Perspective

```bash
# View all jobs
psql $DATABASE_URL -c "SELECT id, status, \"userId\", \"modelName\", progress FROM \"FineTuningJob\";"

# Check pending jobs
psql $DATABASE_URL -c "SELECT * FROM \"FineTuningJob\" WHERE status = 'PENDING';"

# Manually trigger worker
ts-node scripts/fine-tuning-worker.ts

# Cancel stuck job
psql $DATABASE_URL -c "UPDATE \"FineTuningJob\" SET status = 'CANCELLED' WHERE id = 'job-id';"
```

## Cost Estimation

| Component | Cost |
|-----------|------|
| **Training (one-time per user)** | $1-2 (8B model) or $10-15 (70B model) |
| **Storage (model files)** | ~100MB per user |
| **Inference** | $0 (same Ollama server) |

**Total**: $1-2 per user, one-time cost

## Monitoring

### Check Job Status

```bash
# Via API
curl https://yourdomain.com/api/user/ai/fine-tune \
  -H "Cookie: next-auth.session-token=..."

# Via Database
psql $DATABASE_URL -c "
  SELECT
    id,
    status,
    progress,
    \"currentStep\",
    \"modelName\",
    \"createdAt\",
    \"deployedAt\"
  FROM \"FineTuningJob\"
  ORDER BY \"createdAt\" DESC
  LIMIT 10;
"
```

### Monitor Worker

```bash
# If using systemd
sudo journalctl -u emailai-fine-tuning-worker -f

# Check logs
tail -f /var/log/emailai-fine-tuning.log
```

## Troubleshooting

### Job Stuck in PENDING

```bash
# Manually trigger worker
ts-node scripts/fine-tuning-worker.ts --job-id=xyz123
```

### Job Failed

```sql
-- Check error message
SELECT "errorMessage" FROM "FineTuningJob" WHERE id = 'job-id';

-- Retry job
UPDATE "FineTuningJob"
SET status = 'PENDING', "errorMessage" = NULL
WHERE id = 'job-id';
```

### User Not Eligible

```sql
-- Check sent email count
SELECT
  u.email,
  COUNT(em.id) as sent_count
FROM "User" u
JOIN "EmailAccount" ea ON ea."userId" = u.id
JOIN "EmailMessage" em ON em."emailAccountId" = ea.id
WHERE em."isSent" = true
GROUP BY u.id, u.email;
```

### Model Not Deploying to Ollama

```bash
# Check Ollama is accessible
curl $OLLAMA_BASE_URL/api/tags

# Manually deploy model
cd ollama-server/fine-tuning
bash scripts/deploy-to-ollama.sh \
  --model ./output/job-id \
  --user-id user123
```

## Advanced: Batch Re-Training

Retrain all users with completed models:

```typescript
// scripts/batch-retrain-models.ts
import { prisma } from "./utils/prisma";
import { FineTuningService } from "./utils/ai/fine-tuning/fine-tuning-service";

async function main() {
  const usersWithModels = await prisma.user.findMany({
    where: {
      aiProvider: "ollama",
      aiModel: { startsWith: "emailai-" },
    },
  });

  for (const user of usersWithModels) {
    const eligibility = await FineTuningService.isEligibleForFineTuning(user.id);

    if (eligibility.eligible) {
      await FineTuningService.createJob({ userId: user.id });
      console.log(`Created re-training job for ${user.email}`);
    }
  }
}

main();
```

## Security Considerations

1. **Email Data Privacy**: Training data contains user emails
   - Delete training data after model deployment
   - Encrypt training data at rest
   - Use ephemeral GPU instances

2. **API Authentication**: Webhook endpoint uses INTERNAL_API_KEY

3. **User Permissions**: Users can only train their own models

4. **Rate Limiting**: One job per user per 30 days

## Next Steps

- [ ] Set up GPU server (Vast.ai or dedicated)
- [ ] Run database migration
- [ ] Deploy worker process
- [ ] Add UI to settings page
- [ ] Test with a user account that has 100+ emails
- [ ] Monitor first production fine-tuning job
- [ ] Document results and adjust parameters

## Support

For issues or questions:
- Check logs: `journalctl -u emailai-fine-tuning-worker`
- Database queries: See troubleshooting section
- GitHub Issues: https://github.com/calldatasystems/emailai/issues
