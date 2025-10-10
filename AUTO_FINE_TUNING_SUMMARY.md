# Per-User AI Fine-Tuning - Implementation Summary

## ✅ What Was Created

I've built a complete system for automatically fine-tuning personalized AI models for each user. Here's what's ready:

### 1. **Database Schema** ✅
- New `FineTuningJob` model to track training jobs
- Tracks status, progress, costs, and model deployment
- Migration file ready to run

**Location**: `apps/web/prisma/schema.prisma`

### 2. **Fine-Tuning Service** ✅
- Checks user eligibility (100+ sent emails)
- Creates and manages training jobs
- Updates user's AI model after completion
- Auto-notification when users become eligible

**Location**: `apps/web/utils/ai/fine-tuning/fine-tuning-service.ts`

### 3. **API Endpoints** ✅
- **POST /api/user/ai/fine-tune** - Start training
- **GET /api/user/ai/fine-tune** - Check status
- **DELETE /api/user/ai/fine-tune** - Cancel job
- **POST /api/webhooks/fine-tuning** - Receive updates from worker

**Locations**:
- `apps/web/app/api/user/ai/fine-tune/route.ts`
- `apps/web/app/api/webhooks/fine-tuning/route.ts`

### 4. **User Interface** ✅
- Settings page component showing:
  - Eligibility status
  - Training progress bar
  - Active model info
  - Training history
  - "Train Model" button

**Location**: `apps/web/app/(app)/[emailAccountId]/settings/AIModelSection.tsx`

### 5. **Worker Script** ✅
- Polls for pending jobs
- Extracts user's sent emails
- Trains model on GPU
- Deploys to Ollama
- Updates database

**Location**: `scripts/fine-tuning-worker.ts`

### 6. **Auto-Check System** ✅
- Checks eligibility after users send emails
- Notifies when they reach 100+ emails
- Batch check all users daily

**Location**: `apps/web/utils/ai/fine-tuning/auto-check-eligibility.ts`

### 7. **Documentation** ✅
- Complete setup guide
- Troubleshooting tips
- Deployment options

**Location**: `docs/AUTO_FINE_TUNING_SETUP.md`

## 🚀 Quick Start

### Step 1: Run Database Migration
```bash
cd apps/web
npx prisma migrate dev --name add_fine_tuning_jobs
npx prisma generate
```

### Step 2: Add UI to Settings
```tsx
// apps/web/app/(app)/[emailAccountId]/settings/page.tsx
import { AIModelSection } from "./AIModelSection";

// Add to your settings page:
<AIModelSection />
```

### Step 3: Set Up Worker (Choose One)

**Option A: Cron Job (Simplest)**
```bash
# Every 15 minutes
*/15 * * * * cd /path/to/emailai && ts-node scripts/fine-tuning-worker.ts
```

**Option B: Systemd Service (Production)**
```bash
# Create systemd service (see full guide)
sudo systemctl enable emailai-fine-tuning-worker
sudo systemctl start emailai-fine-tuning-worker
```

**Option C: Manual Testing**
```bash
# Run once
ts-node scripts/fine-tuning-worker.ts

# Process specific job
ts-node scripts/fine-tuning-worker.ts --job-id=xyz123
```

### Step 4: Test It!
1. Have a test user with 100+ sent emails
2. Go to Settings → AI Model section
3. Click "Train Personalized Model"
4. Worker picks up job and trains (2-4 hours)
5. Model deploys to Ollama automatically
6. User's AI replies now use their trained model

## 📋 How It Works

```
┌─────────────────────────────────────────────────────────┐
│ User sends emails → Hits 100 sent emails               │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Auto-check shows: "You can train your AI model!"       │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ User clicks "Train Personalized Model" in Settings     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ API creates FineTuningJob (status: PENDING)            │
│ - jobId: xyz123                                         │
│ - userId: user123                                       │
│ - status: PENDING                                       │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Worker picks up job (cron/systemd/manual)               │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Step 1: Extract 100-500 sent emails from database      │
│ Status: EXTRACTING_DATA (10% complete)                 │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Convert to training format (Alpaca JSONL)      │
│ Status: PREPARING_DATA (20% complete)                  │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Train model on GPU (Vast.ai or local)          │
│ Status: TRAINING (30-80% over 2-4 hours)               │
│ - Uses existing ollama-server/fine-tuning scripts      │
│ - Creates: emailai-user123abc                          │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Deploy to Ollama server                        │
│ Status: DEPLOYING (90% complete)                       │
│ - ollama create emailai-user123abc                     │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Update user record in database                 │
│ Status: COMPLETED (100%)                               │
│ User.aiProvider = "ollama"                             │
│ User.aiModel = "emailai-user123abc"                    │
└─────────────────────┬───────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────┐
│ ✅ All future AI operations use personalized model     │
│ - Email replies sound like the user                    │
│ - Matches their tone, formality, vocabulary            │
│ - No extra configuration needed                        │
└─────────────────────────────────────────────────────────┘
```

## 💡 Key Features

### ✅ Automatic Eligibility Checking
- Checks every 10 emails sent
- Notifies at 100, 110, 120... emails
- Shows banner in settings when ready

### ✅ Progress Tracking
- Real-time progress bar (0-100%)
- Shows current step (e.g., "Training model...")
- Estimated time remaining
- Cost tracking

### ✅ Job Management
- View all training jobs
- See training history
- Cancel in-progress jobs
- Retry failed jobs

### ✅ Seamless Integration
- Model automatically selected after training
- No configuration needed
- Works with existing Ollama server
- Compatible with all AI features

## 🔧 Configuration

### Required Environment Variables
```bash
# Already in your .env if you ran the updated setup.sh
INTERNAL_API_KEY=your-internal-key    # For webhook auth
OLLAMA_BASE_URL=http://localhost:11434/api  # Where to deploy models
```

### Optional Variables
```bash
FINE_TUNING_WEBHOOK_URL=https://yourdomain.com/api/webhooks/fine-tuning
VASTAI_API_KEY=your-vastai-key  # For automatic GPU provisioning
```

## 📊 Monitoring

### Check Job Status
```bash
# Via database
psql $DATABASE_URL -c "SELECT id, status, progress, \"modelName\" FROM \"FineTuningJob\" ORDER BY \"createdAt\" DESC LIMIT 5;"

# Via API (as user)
curl https://yourdomain.com/api/user/ai/fine-tune

# Worker logs
journalctl -u emailai-fine-tuning-worker -f
```

### View Deployed Models
```bash
# List all models in Ollama
curl $OLLAMA_BASE_URL/api/tags

# Should show:
# - llama3.3:70b (base model)
# - emailai-user123abc (user 1's model)
# - emailai-user456def (user 2's model)
```

## 💰 Cost Breakdown

| Item | Cost |
|------|------|
| **Training (one-time per user)** | $1-2 (8B model) |
| **GPU rental (Vast.ai)** | ~$0.40/hour × 3 hours = $1.20 |
| **Storage (model checkpoint)** | ~100MB per user |
| **Inference cost** | $0 (same Ollama server) |
| **Total per user** | **$1-2 one-time** |

## 🎯 Next Steps

### Immediate (Required)
1. ✅ Run database migration
2. ✅ Add `AIModelSection` to settings page
3. ✅ Set up worker process (cron or systemd)

### Testing
4. Test with a user account that has 100+ sent emails
5. Monitor first training job
6. Verify model deploys to Ollama
7. Test AI replies use new model

### Optional Enhancements
- Email notifications on completion
- Cost tracking dashboard
- Automatic re-training (monthly)
- Model quality metrics
- A/B testing (base vs fine-tuned)

## 🔍 Verifying It Works

### Before Fine-Tuning
```bash
# User's AI settings
psql $DATABASE_URL -c "SELECT email, \"aiProvider\", \"aiModel\" FROM \"User\" WHERE email = 'user@example.com';"
# Result: aiProvider=null, aiModel=null (uses default)
```

### After Fine-Tuning
```bash
# User's AI settings updated
psql $DATABASE_URL -c "SELECT email, \"aiProvider\", \"aiModel\" FROM \"User\" WHERE email = 'user@example.com';"
# Result: aiProvider='ollama', aiModel='emailai-abc123'

# Model exists in Ollama
curl $OLLAMA_BASE_URL/api/tags | grep emailai-abc123
# Result: {"name":"emailai-abc123",...}

# AI replies use personalized model
# Check apps/web/utils/llms/model.ts:96
# const model = aiModel || env.NEXT_PUBLIC_OLLAMA_MODEL;
# ↑ Uses user's aiModel automatically
```

## 🐛 Troubleshooting

### "Not eligible for fine-tuning"
→ User needs 100+ sent emails. Check:
```sql
SELECT COUNT(*) FROM "EmailMessage" em
JOIN "EmailAccount" ea ON em."emailAccountId" = ea.id
WHERE ea."userId" = 'user-id' AND em."isSent" = true;
```

### Job stuck in PENDING
→ Worker not running. Start it:
```bash
ts-node scripts/fine-tuning-worker.ts
```

### Training failed
→ Check error message:
```sql
SELECT "errorMessage" FROM "FineTuningJob" WHERE id = 'job-id';
```

### Model not deploying
→ Check Ollama is accessible:
```bash
curl $OLLAMA_BASE_URL/api/tags
```

## 📚 Related Documentation

- **Setup Guide**: `docs/AUTO_FINE_TUNING_SETUP.md`
- **Fine-Tuning Scripts**: `ollama-server/fine-tuning/README.md`
- **AI Features**: `AI_FEATURES_OVERVIEW.md`
- **Ollama Deployment**: `ollama-server/README.md`

## ✨ Summary

You now have a **complete system** for per-user AI fine-tuning:

✅ **Database schema** - Tracks training jobs
✅ **API endpoints** - Create/manage jobs
✅ **UI component** - User-facing interface
✅ **Worker script** - Processes training jobs
✅ **Auto-check** - Notifies eligible users
✅ **Documentation** - Complete setup guide

**All you need to do**:
1. Run the migration
2. Add the UI component
3. Start the worker
4. Users with 100+ emails can train their models!

The system integrates seamlessly with your existing Ollama setup - each user gets their own fine-tuned model on the shared Ollama server, and it's automatically selected when they use AI features.
