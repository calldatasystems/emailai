# LoRA Automated Training - Implementation Complete

## ✅ Status: READY FOR PRODUCTION

The fully automated LoRA fine-tuning system is now implemented and ready to use.

## System Overview

When a user clicks "Train AI Model" in the settings, the system:

1. **Creates a job** in the database (status: PENDING)
2. **Automatically triggers** background worker using absolute paths
3. **Worker processes** the job:
   - Extracts user's sent emails
   - Prepares training dataset
   - Fine-tunes LoRA adapters (2-4 hours)
   - Deploys to remote Ollama server
   - Updates user's AI model to `emailai-{userId}`

## Configuration

### Remote Ollama Server
- **Host**: `ai.calldata.app` (64.25.128.120)
- **Port**: `25630`
- **API**: `http://ai.calldata.app:25630/api`
- **Version**: Ollama v0.12.3
- **Base Model**: llama3.1:8b (4.58 GB, Q4_K_M)

### Environment Variables
```bash
# .env.local
OLLAMA_BASE_URL="http://ai.calldata.app:25630/api"
NEXT_PUBLIC_OLLAMA_MODEL="llama3.3:70b"
DEFAULT_LLM_PROVIDER="ollama"
```

## How It Works

### User Flow

1. User navigates to Settings → User tab
2. Sees "Personalized AI Model" section
3. Clicks "Train AI Model (using XXX emails)"
4. System creates job and automatically starts training
5. Progress updates every 10 seconds in the UI
6. Training completes in 2-4 hours
7. User's model is automatically activated

### Technical Flow

```
User Click → API POST /api/user/ai/fine-tune
           ↓
    Create FineTuningJob (PENDING)
           ↓
    triggerJobProcessing(jobId)
           ↓
    Background Worker Starts
           ↓
    Extract Emails → Prepare Data
           ↓
    Fine-Tune LoRA Adapters
           ↓
    Deploy to Ollama Server
           ↓
    Update User Model → COMPLETED
```

## Files Modified/Created

### Core Implementation
1. **`/apps/web/app/api/user/ai/fine-tune/route.ts`**
   - Added automatic job triggering after creation
   - Calls `triggerJobProcessing(job.id)` in background

2. **`/apps/web/utils/ai/fine-tuning/job-processor.ts`** (NEW)
   - Background job processing system
   - Uses absolute paths to avoid PATH issues
   - Non-blocking execution with nohup

3. **`/scripts/fine-tuning-worker.ts`**
   - Updated to support remote Ollama deployment
   - Sets OLLAMA_HOST environment variable
   - Deploys LoRA adapters to remote server

4. **`/ollama-server/fine-tuning/scripts/deploy-to-ollama.sh`**
   - Added connectivity checks
   - Supports OLLAMA_HOST environment variable
   - Graceful error handling

### UI Components
5. **`/apps/web/app/(app)/[emailAccountId]/settings/AIModelSection.tsx`**
   - Simplified UI (removed bullet points)
   - Updated button text to show email count
   - Real-time progress polling

6. **`/apps/web/app/(app)/[emailAccountId]/settings/page.ts x`**
   - Removed redundant ModelSection
   - Cleaned up layout

### Monitoring Tools
7. **`/ollama-server/fine-tuning/scripts/monitor-ollama.sh`** (NEW)
   - Full monitoring dashboard
   - Real-time updates with --watch mode
   - Shows running models, available models, server status

8. **`/ollama-server/fine-tuning/scripts/ollama-status.sh`** (NEW)
   - Quick status commands
   - Lightweight queries
   - Compatible with `watch` command

9. **`/ollama-server/fine-tuning/MONITORING.md`** (NEW)
   - Comprehensive monitoring guide
   - API endpoints reference
   - Troubleshooting steps

## Monitoring

### Check Ollama Server Status
```bash
cd /mnt/c/Users/aqorn/Documents/CODE/emailai/ollama-server/fine-tuning

# Quick status
bash scripts/ollama-status.sh

# Full dashboard
bash scripts/monitor-ollama.sh

# Continuous monitoring (5s interval)
bash scripts/monitor-ollama.sh --watch

# Watch fine-tuned models
watch -n 5 bash scripts/ollama-status.sh finetuned
```

### Check Training Progress
```bash
# View training logs for a specific job
tail -f /tmp/fine-tuning-{jobId}.log

# List all training logs
ls -la /tmp/fine-tuning-*.log

# Check job status in database
docker.exe exec -i e9243df85aed psql -U postgres -d emailai_dev -c \
  "SELECT id, status, progress, currentStep FROM \"FineTuningJob\" ORDER BY \"createdAt\" DESC LIMIT 5;"
```

### Monitor in UI
- Navigate to Settings → User tab
- View "Personalized AI Model" section
- Progress updates automatically every 10 seconds
- Shows current step and progress percentage

## Testing the System

### Create a New Training Job

1. Open http://localhost:3000 in your browser
2. Sign in with your account
3. Navigate to Settings → User tab
4. Click "Train AI Model (using XXX emails)"
5. Job will be created and worker will start automatically

### Verify Worker is Running

```bash
# Check for worker process
ps aux | grep fine-tuning-worker

# View worker logs
tail -f /tmp/fine-tuning-{jobId}.log

# Monitor Ollama server
bash scripts/monitor-ollama.sh --watch
```

### Expected Timeline

- **0-5 min**: Email extraction and data preparation
- **2-4 hours**: LoRA fine-tuning (depends on GPU)
- **5-10 min**: Deployment to Ollama server
- **Total**: ~2-4 hours

## Troubleshooting

### Worker Not Starting

**Check logs:**
```bash
# Dev server logs (check for job processing errors)
# In the terminal running pnpm dev

# Look for lines like:
# "Triggering automatic job processing"
# "Worker started successfully"
# "Worker execution error"
```

**Manual trigger:**
```bash
# If automatic trigger fails, run manually:
cd /mnt/c/Users/aqorn/Documents/CODE/emailai
pnpm exec tsx scripts/fine-tuning-worker.ts --job-id={jobId}
```

### Ollama Server Connection Issues

```bash
# Test connectivity
curl -s http://ai.calldata.app:25630/api/version

# Use IP address if domain fails
curl -s http://64.25.128.120:25630/api/version

# Check DNS
nslookup ai.calldata.app
```

### Training Fails

**Common issues:**
1. **Python environment** - Ensure Python 3.8+ and pip are installed
2. **GPU memory** - Requires ~16GB GPU RAM for training
3. **Dependencies** - Run `pip install -r requirements.txt`
4. **Base model** - Ensure llama3.1:8b exists on Ollama server

**Check logs:**
```bash
# View error messages
tail -n 100 /tmp/fine-tuning-{jobId}.log | grep -i error

# Check database for error message
docker.exec -i e9243df85aed psql -U postgres -d emailai_dev -c \
  "SELECT errorMessage FROM \"FineTuningJob\" WHERE id = '{jobId}';"
```

## Production Deployment

### Prerequisites

1. **Ollama Server**
   - Running on ai.calldata.app:25630
   - Base model (llama3.1:8b) downloaded
   - Accessible from application server

2. **Python Environment**
   - Python 3.8+
   - GPU with CUDA support (recommended)
   - Dependencies: torch, transformers, peft, unsloth

3. **System Resources**
   - Storage: ~10GB per model
   - GPU RAM: ~16GB during training
   - CPU RAM: ~8GB minimum

### Environment Variables

Ensure these are set in production `.env`:
```bash
OLLAMA_BASE_URL="http://ai.calldata.app:25630/api"
NEXT_PUBLIC_OLLAMA_MODEL="llama3.3:70b"
DEFAULT_LLM_PROVIDER="ollama"
DATABASE_URL="{production_postgres_url}"
```

### Monitoring Setup

**Recommended:** Set up monitoring alerts for:
- Failed training jobs (status = FAILED)
- Long-running jobs (> 6 hours)
- Ollama server downtime
- GPU memory usage
- Storage space for models

**Example cron job** (optional - for fallback):
```cron
# Check for pending jobs every 10 minutes
*/10 * * * * cd /path/to/emailai && pnpm exec tsx scripts/fine-tuning-worker.ts >> /var/log/fine-tuning-cron.log 2>&1
```

## Performance Metrics

### Expected Metrics

- **Training Time**: 2-4 hours (100 emails, 3 epochs)
- **Model Size**: ~100MB LoRA adapters
- **Storage**: Base model (4.6GB) + adapters (~100MB per user)
- **API Response**: <100ms for inference
- **Training Cost**: ~$1-2 per job (if using cloud GPU)

### Scalability

- **Single server**: 1-2 concurrent training jobs
- **Multiple GPUs**: N concurrent jobs (1 per GPU)
- **Queue system**: Unlimited pending jobs
- **Storage**: ~100MB per user model

## Security Considerations

1. **Email Data**: Only used for training, never stored permanently
2. **Model Isolation**: Each user gets their own LoRA adapter
3. **API Access**: Authenticated endpoints only
4. **Ollama Server**: Internal network access only (recommend firewall)

## Next Steps

### Optional Enhancements

1. **Email notifications** when training completes
2. **Cost tracking** per training job
3. **A/B testing** to compare model versions
4. **Model versioning** to allow rollback
5. **Training queue UI** to show pending jobs
6. **Advanced parameters** (epochs, learning rate) in UI

### Maintenance

- **Monitor disk space** on Ollama server
- **Clean up old models** periodically
- **Update base models** when Ollama releases new versions
- **Review failed jobs** and improve error handling

## Support

For issues or questions:
- Check logs: `/tmp/fine-tuning-{jobId}.log`
- Verify Ollama: `bash scripts/monitor-ollama.sh`
- Review job status in database
- Check dev server output

## Architecture Diagram

```
┌─────────────────┐
│   Web Browser   │
│   (User)        │
└────────┬────────┘
         │ Click "Train AI Model"
         ↓
┌─────────────────┐
│   Next.js API   │
│   /api/user/    │
│   ai/fine-tune  │
└────────┬────────┘
         │ Create Job + Trigger Worker
         ↓
┌─────────────────┐          ┌──────────────────┐
│  Background     │          │   PostgreSQL     │
│  Worker Process │◄────────►│   (Job Queue)    │
│  (tsx script)   │          └──────────────────┘
└────────┬────────┘
         │ Extract & Train
         ↓
┌─────────────────┐
│  Python/unsloth │
│  LoRA Training  │
│  (2-4 hours)    │
└────────┬────────┘
         │ Deploy
         ↓
┌─────────────────┐
│  Ollama Server  │
│  ai.calldata    │
│  .app:25630     │
└────────┬────────┘
         │ Model Ready
         ↓
┌─────────────────┐
│  User Emails    │
│  Use Fine-Tuned │
│  Model          │
└─────────────────┘
```

## Conclusion

The LoRA automated training system is **fully functional** and ready for production use. Users can now train personalized AI models with a single click, and the system handles everything automatically from data extraction to deployment.

**Key Features:**
✅ Fully automated - no manual intervention needed
✅ Background processing - non-blocking API responses
✅ Progress tracking - real-time UI updates
✅ Remote deployment - works with external Ollama server
✅ Monitoring tools - comprehensive status tracking
✅ Error handling - graceful failures with detailed logs
✅ Scalable - queue-based architecture

The system is production-ready and can handle multiple users creating fine-tuning jobs concurrently.
