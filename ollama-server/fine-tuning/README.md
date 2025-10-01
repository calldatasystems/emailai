# Fine-Tuning Llama Models for EmailAI User Voice

Train custom AI models to write emails in each user's unique voice and style.

## Quick Start

```bash
# 1. Prepare training data from user's emails
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data

# 2. Fine-tune Llama model (2-4 hours on RTX 4090)
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml

# 3. Deploy to Ollama
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id "user123"

# 4. Use in EmailAI (.env)
NEXT_PUBLIC_OLLAMA_MODEL=emailai-user123
```

📖 **[Full Guide](./docs/FINE_TUNING_GUIDE.md)** | 📖 **[Vast.ai Deployment](../docs/VASTAI_DEPLOYMENT.md)**

---

## What is This?

This directory contains everything needed to **fine-tune Llama models** on a user's email history, so EmailAI can generate emails that match their writing style, tone, and voice.

### Why Fine-Tuning?

**Before fine-tuning:**
- EmailAI uses generic AI models (OpenAI, Anthropic, Groq)
- Generated emails sound professional but generic
- No personalization to user's voice

**After fine-tuning:**
- AI learned from 100-500 of user's sent emails
- Generated emails match user's tone, style, vocabulary
- Feels like the user wrote it themselves

### Example

**User's typical email:**
> Hey team! Quick update on the project - we're crushing it! 🚀 Wrapped up the design phase yesterday and moving into dev next week. Let me know if you have questions!

**Generic AI model:**
> Dear Team,
>
> I am writing to provide an update on the project status. The design phase has been completed as of yesterday, and we will begin the development phase next week. Please let me know if you have any questions.

**Fine-tuned model:**
> Hey team! Just wanted to share a quick update - we finished the design phase yesterday and we're starting dev next week. Pretty excited about how it's shaping up! Hit me up if you have any questions 😊

---

## Directory Structure

```
fine-tuning/
├── README.md                     # This file
├── docs/
│   └── FINE_TUNING_GUIDE.md     # Complete guide
├── scripts/
│   ├── prepare-email-data.py     # Extract training data from DB
│   ├── finetune-lora.py          # LoRA fine-tuning script
│   ├── evaluate-model.py         # Test model quality
│   ├── deploy-to-ollama.sh       # Deploy to Ollama
│   ├── backup-training-data.sh   # Backup for Vast.ai
│   └── restore-training-data.sh  # Restore from backup
├── configs/
│   ├── lora-config-8b.yaml       # Config for Llama 3.1 8B
│   ├── lora-config-70b.yaml      # Config for Llama 3.3 70B
│   └── requirements.txt          # Python dependencies
└── data-samples/
    └── test-prompts.json         # Example test prompts
```

---

## Requirements

### Data Requirements

- **Minimum**: 50-100 sent emails
- **Recommended**: 200-500 sent emails
- **Best Results**: 500+ sent emails

**Note**: Only sent emails are used (outgoing). Received emails are not included to avoid learning other people's writing styles.

### Hardware Requirements

| Model | GPU | VRAM | Training Time | Cost (Vast.ai) |
|-------|-----|------|---------------|----------------|
| **Llama 3.1 8B** | RTX 4090 | 24GB | 2-4 hours | ~$1-2 |
| **Llama 3.3 70B** | A100 | 48GB+ | 8-12 hours | ~$10-15 |

**No GPU?** Use Vast.ai to rent GPUs by the hour: [Vast.ai Guide](../docs/VASTAI_DEPLOYMENT.md)

### Software Requirements

```bash
# Python 3.9+
python3 --version

# CUDA 11.8+ (for GPU)
nvidia-smi

# Install dependencies
pip install -r configs/requirements.txt
```

---

## Features

### ✅ LoRA Fine-Tuning

- **Efficient**: Uses 50% less GPU memory than full fine-tuning
- **Fast**: Train in 2-4 hours vs days
- **Lightweight**: Output adapters only ~100MB
- **Switchable**: Easy to swap between users

### ✅ Data Security

- **Encrypted Backups**: All training data encrypted
- **Ephemeral Servers**: Vast.ai instances auto-cleanup
- **No Data Retention**: Training data deleted after backup
- **Checkpoint Resume**: Resume training after instance loss

### ✅ Multi-User Support

- **Per-User Models**: Each user gets their own fine-tuned model
- **Dynamic Selection**: EmailAI switches models based on user
- **Shared Base Model**: Option to share base + user adapters

### ✅ Production Ready

- **Checkpoint Saving**: Auto-save every 100 steps
- **Resumable Training**: Resume from any checkpoint
- **Model Evaluation**: Test model before deployment
- **Ollama Integration**: Deploy directly to Ollama

---

## Workflow

### 1. Prepare Data

```bash
python scripts/prepare-email-data.py \
  --db-url "postgresql://user:pass@host:5432/emailai" \
  --user-id "clxyz123abc" \
  --output ./training-data \
  --min-emails 100
```

**Output:**
- `training-data/train_alpaca.jsonl` - Training set (90%)
- `training-data/val_alpaca.jsonl` - Validation set (10%)
- `training-data/dataset_alpaca.json` - Combined with metadata

### 2. Fine-Tune

```bash
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --output ./output/llama-3.1-8b-user123
```

**Monitor:**
```bash
# Watch training progress
tensorboard --logdir ./output/llama-3.1-8b-user123/runs
```

**Checkpoints saved every 100 steps:**
```
output/llama-3.1-8b-user123/
├── checkpoint-100/
├── checkpoint-200/
├── checkpoint-300/
└── checkpoint-final/
```

### 3. Evaluate

```bash
python scripts/evaluate-model.py \
  --model ./output/llama-3.1-8b-user123 \
  --test-data data-samples/test-prompts.json \
  --output results.json
```

### 4. Deploy

```bash
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-user123 \
  --user-id user123
```

**Verify:**
```bash
ollama list
# Shows: emailai-user123

ollama run emailai-user123 "Write a professional email"
```

### 5. Use in EmailAI

Update EmailAI `.env`:
```bash
NEXT_PUBLIC_OLLAMA_MODEL=emailai-user123
OLLAMA_BASE_URL=http://localhost:11434/api
DEFAULT_LLM_PROVIDER=ollama
```

---

## Vast.ai Deployment

**Recommended for users without GPUs:**

### Complete Workflow

```bash
# 1. Rent Vast.ai GPU (RTX 4090, ~$0.35/hour)
# See: ../docs/VASTAI_DEPLOYMENT.md

# 2. SSH to instance
ssh root@ssh5.vast.ai -p 12345

# 3. Clone repo and install
git clone https://github.com/your-org/emailai.git
cd emailai/ollama-server/fine-tuning
pip install -r configs/requirements.txt

# 4. Prepare data (transfer from local or prepare on server)
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data

# 5. Start training
python scripts/finetune-lora.py --config configs/lora-config-8b.yaml

# 6. Backup regularly (IMPORTANT: Vast.ai is ephemeral!)
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123 \
  --cleanup

# 7. Deploy or download model
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id user123
```

### Resume After Instance Loss

```bash
# 1. Rent new instance
# 2. Clone repo
# 3. Restore backup:
bash scripts/restore-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123

# 4. Resume training:
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --resume-from-checkpoint ./output/llama-3.1-8b-email/checkpoint-300
```

---

## Security & Data Privacy

### 🔒 Critical Security Measures

#### 1. Encrypted Backups

**Always encrypt training data:**
```bash
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123
  # Encryption is enabled by default
  # SAVE THE ENCRYPTION KEY!
```

#### 2. Cleanup Ephemeral Servers

**Remove data from Vast.ai after backup:**
```bash
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123 \
  --cleanup  # Deletes training data from server
```

#### 3. Secure S3 Storage

```bash
# Enable S3 encryption
aws s3api put-bucket-encryption \
  --bucket your-emailai-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

#### 4. Data Retention

**Best practices:**
- ✅ Training data: Delete after fine-tuning
- ✅ Checkpoints: Keep 30 days (for rollback)
- ✅ Final model: Keep indefinitely (no raw emails)
- ✅ Backups: Encrypted, cold storage only

---

## Cost Comparison

### Fine-Tuning Cost (One-Time)

| Provider | Model | Cost |
|----------|-------|------|
| **Vast.ai (8B)** | Llama 3.1 8B | **$1-2** |
| **Vast.ai (70B)** | Llama 3.3 70B | **$10-15** |
| OpenAI | GPT-4o | $500-1000 |
| Anthropic | Claude 3.7 | $800-1500 |

### Inference Cost (Per Email)

| Provider | Cost per Email |
|----------|----------------|
| **Local Ollama** | **$0** |
| OpenAI API | $0.10-0.50 |
| Anthropic API | $0.15-0.60 |
| Groq API | $0.01-0.05 |

**ROI**: Fine-tuning pays for itself after ~10-50 emails

---

## Troubleshooting

### Common Issues

**Out of Memory (OOM)**
```bash
# Solution: Reduce batch size
# Edit config:
per_device_train_batch_size: 2  # From 4
gradient_accumulation_steps: 8  # Increase to compensate
```

**Training Loss Not Decreasing**
```bash
# Solutions:
# 1. Lower learning rate
learning_rate: 1.0e-4  # From 2.0e-4

# 2. Train longer
num_train_epochs: 5  # From 3

# 3. Check data quality (review training files)
```

**Model Doesn't Match User Voice**
```bash
# Solutions:
# 1. Need more training data (100+ emails minimum)
# 2. Increase LoRA rank
lora_r: 32  # From 16

# 3. Train longer
num_train_epochs: 5
```

**Vast.ai Instance Terminated**
```bash
# Restore and resume:
bash scripts/restore-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123

python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --resume-from-checkpoint ./output/.../checkpoint-<num>
```

📖 **[Full Troubleshooting Guide](./docs/FINE_TUNING_GUIDE.md#troubleshooting)**

---

## Documentation

- **[Complete Fine-Tuning Guide](./docs/FINE_TUNING_GUIDE.md)** - Detailed walkthrough
- **[Vast.ai Deployment](../docs/VASTAI_DEPLOYMENT.md)** - GPU rental guide
- **[Ollama Server Guide](../README.md)** - Main Ollama documentation
- **[EmailAI AI Features](../../AI_FEATURES_OVERVIEW.md)** - All AI capabilities

---

## Support

**Questions or issues?**
- 📖 Read the [Fine-Tuning Guide](./docs/FINE_TUNING_GUIDE.md)
- 💬 Open an issue in the EmailAI repository
- 📚 Check [Troubleshooting](./docs/FINE_TUNING_GUIDE.md#troubleshooting)

---

## License

MIT License - See main EmailAI repository for details.

**Model Licenses:**
- Llama 3: [Meta Llama License](https://llama.meta.com/llama3/license/)
- Fine-tuned models: Same as base model

---

**Ready to start?** → [Fine-Tuning Guide](./docs/FINE_TUNING_GUIDE.md)
