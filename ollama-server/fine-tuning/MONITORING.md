# Ollama Server Monitoring

This guide explains how to monitor your remote Ollama server activity for LoRA fine-tuning operations.

## Quick Start

```bash
# From the fine-tuning directory
cd /mnt/c/Users/aqorn/Documents/CODE/emailai/ollama-server/fine-tuning

# Quick status check
bash scripts/ollama-status.sh

# Full monitoring dashboard
bash scripts/monitor-ollama.sh

# Continuous monitoring (updates every 5 seconds)
bash scripts/monitor-ollama.sh --watch

# Custom interval (10 seconds)
bash scripts/monitor-ollama.sh --watch 10
```

## Server Configuration

- **Host**: `ai.calldata.app` (64.25.128.120)
- **Port**: `25630`
- **API Endpoint**: `http://ai.calldata.app:25630/api`
- **Ollama Version**: 0.12.3

## Monitoring Scripts

### 1. `monitor-ollama.sh` - Full Dashboard

Comprehensive monitoring dashboard with real-time updates.

**Features:**
- Server connection status and version
- Running models (currently active)
- Available models with details (size, parameters, quantization)
- Fine-tuned model detection (marked with 🎯)
- Summary statistics
- Watch mode for continuous monitoring

**Usage:**
```bash
# One-time check
./scripts/monitor-ollama.sh

# Watch mode (5s interval)
./scripts/monitor-ollama.sh --watch

# Custom interval (10s)
./scripts/monitor-ollama.sh --watch 10

# Different server
./scripts/monitor-ollama.sh --host http://64.25.128.120:25630
```

### 2. `ollama-status.sh` - Quick Commands

Lightweight script for specific information.

**Commands:**
```bash
# All information (default)
./scripts/ollama-status.sh all

# Running models only
./scripts/ollama-status.sh ps

# List all models
./scripts/ollama-status.sh models

# Fine-tuned models only
./scripts/ollama-status.sh finetuned

# Server version
./scripts/ollama-status.sh version
```

**With watch command:**
```bash
# Monitor models every 5 seconds
watch -n 5 ./scripts/ollama-status.sh models

# Monitor fine-tuned models
watch -n 5 ./scripts/ollama-status.sh finetuned
```

## API Endpoints

You can also query the Ollama API directly:

### List Available Models
```bash
curl -s http://ai.calldata.app:25630/api/tags | python3 -m json.tool
```

### Check Running Models
```bash
curl -s http://ai.calldata.app:25630/api/ps | python3 -m json.tool
```

### Server Version
```bash
curl -s http://ai.calldata.app:25630/api/version | python3 -m json.tool
```

### Show Model Details
```bash
curl -s http://ai.calldata.app:25630/api/show \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.1:8b"}' | python3 -m json.tool
```

### Test Model Inference
```bash
curl -s http://ai.calldata.app:25630/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "prompt": "Write a professional email",
    "stream": false
  }' | python3 -m json.tool
```

## Monitoring During Training

When a fine-tuning job is running, monitor:

### 1. Training Worker Logs
```bash
# View real-time logs for a specific job
tail -f /tmp/fine-tuning-{jobId}.log

# View all training logs
ls -la /tmp/fine-tuning-*.log
```

### 2. Job Status in Database
```bash
# Query job status from database
psql "$DATABASE_URL" -c "SELECT id, status, progress, currentStep FROM \"FineTuningJob\" ORDER BY createdAt DESC LIMIT 5;"
```

### 3. Ollama Server Activity
```bash
# Watch for new models appearing
watch -n 10 './scripts/ollama-status.sh finetuned'

# Monitor running models during deployment
watch -n 5 './scripts/ollama-status.sh ps'
```

## Model Naming Convention

Fine-tuned models follow this pattern:
- **Format**: `emailai-{userId}`
- **Example**: `emailai-cm91x123`
- **Size**: ~100MB LoRA adapters (not merged)

## Troubleshooting

### Connection Issues

```bash
# Test basic connectivity
curl -I http://ai.calldata.app:25630/api/version

# Test with IP address
curl -I http://64.25.128.120:25630/api/version

# Check DNS resolution
nslookup ai.calldata.app
```

### Model Not Appearing

```bash
# Refresh model list (Ollama caches)
curl -s http://ai.calldata.app:25630/api/tags

# Check if model creation was successful
./scripts/ollama-status.sh models | grep emailai-
```

### Training Logs

```bash
# Find all training logs
find /tmp -name "fine-tuning-*.log" -type f

# View recent errors
grep -i error /tmp/fine-tuning-*.log
```

## Useful Aliases

Add these to your `~/.bashrc` or `~/.zshrc`:

```bash
# Navigate to fine-tuning directory
alias ft='cd /mnt/c/Users/aqorn/Documents/CODE/emailai/ollama-server/fine-tuning'

# Quick Ollama checks
alias ollama-status='bash scripts/ollama-status.sh all'
alias ollama-models='bash scripts/ollama-status.sh models'
alias ollama-watch='bash scripts/monitor-ollama.sh --watch'
alias ollama-ft='bash scripts/ollama-status.sh finetuned'

# Training logs
alias ft-logs='ls -laht /tmp/fine-tuning-*.log'
alias ft-tail='tail -f /tmp/fine-tuning-*.log'
```

## Integration with EmailAI

The EmailAI web application automatically:
1. Creates fine-tuning jobs when users click "Train AI Model"
2. Triggers background worker to process training
3. Deploys LoRA adapters to Ollama server
4. Updates user's AI model to `emailai-{userId}`

Monitor the end-to-end flow:
```bash
# Terminal 1: Watch job progress
watch -n 5 './scripts/ollama-status.sh finetuned'

# Terminal 2: Follow training logs
tail -f /tmp/fine-tuning-*.log

# Terminal 3: Monitor server activity
./scripts/monitor-ollama.sh --watch
```

## Performance Metrics

Expected metrics for LoRA training:

- **Training Time**: 2-4 hours (depends on email count and GPU)
- **Model Size**: ~100MB LoRA adapters
- **Base Model**: llama3.1:8b (4.58 GB)
- **Memory Usage**: ~16GB GPU RAM during training
- **API Response Time**: <100ms for inference

## Support

For issues or questions:
- Check logs: `/tmp/fine-tuning-{jobId}.log`
- Verify Ollama connectivity: `./scripts/monitor-ollama.sh`
- Review job status in database
- Check EmailAI logs: Check dev server output
