# Fine-Tuning Guide: Custom Email Voice for EmailAI Users

This guide explains how to fine-tune a Llama model on a user's email history so EmailAI can write emails in their unique voice and style.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Workflow](#detailed-workflow)
5. [Vast.ai Deployment](#vastai-deployment)
6. [Data Security](#data-security)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Fine-Tuning?

Fine-tuning trains an AI model on specific data (user's emails) to learn patterns, tone, and style. After fine-tuning, the model can generate emails that sound like they were written by that user.

### Why LoRA?

**LoRA (Low-Rank Adaptation)** is the recommended fine-tuning method:

- ✅ **Memory Efficient**: Uses 50% less GPU memory
- ✅ **Fast**: Trains in 2-4 hours vs days for full fine-tuning
- ✅ **Lightweight**: Output adapters are only ~100MB
- ✅ **Switchable**: Easy to swap between different users
- ✅ **Cost-Effective**: Runs on consumer GPUs (RTX 3090, 4090)

### Requirements

**Data:**
- Minimum: 50-100 sent emails
- Recommended: 200+ sent emails
- Best: 500+ sent emails

**Hardware:**
- **Llama 3.1 8B**: 24GB+ GPU VRAM (RTX 3090, RTX 4090)
- **Llama 3.3 70B**: 48GB+ GPU VRAM (A100, multi-GPU)
- **CPU**: Possible but 50-100x slower

**Time:**
- Llama 3.1 8B: 2-4 hours (100 emails)
- Llama 3.3 70B: 8-12 hours (100 emails)

---

## Prerequisites

### 1. EmailAI Database Access

You need access to the EmailAI database to extract user emails:

```bash
# Set database URL
export DATABASE_URL="postgresql://user:password@host:5432/emailai"
```

### 2. Install Dependencies

```bash
cd ollama-server/fine-tuning

# Install Python dependencies
pip install -r configs/requirements.txt

# This installs:
# - torch (PyTorch)
# - transformers (Hugging Face)
# - peft (LoRA implementation)
# - bitsandbytes (quantization)
# - datasets, accelerate, etc.
```

### 3. Verify GPU Access

```bash
# Check if GPU is available
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
python3 -c "import torch; print(f'GPU: {torch.cuda.get_device_name(0)}')"

# Should output:
# CUDA available: True
# GPU: NVIDIA GeForce RTX 4090
```

---

## Quick Start

### End-to-End Fine-Tuning (5 Steps)

```bash
cd ollama-server/fine-tuning

# Step 1: Prepare training data from user's emails
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "clxyz123abc" \
  --output ./training-data

# Step 2: Fine-tune the model (2-4 hours)
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml

# Step 3: Evaluate the model
python scripts/evaluate-model.py \
  --model ./output/llama-3.1-8b-email \
  --test-data data-samples/test-prompts.json

# Step 4: Deploy to Ollama
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id "clxyz123abc"

# Step 5: Configure EmailAI to use the model
# Update EmailAI .env:
# NEXT_PUBLIC_OLLAMA_MODEL=emailai-clxyz123abc
```

---

## Detailed Workflow

### Step 1: Prepare Training Data

The preparation script extracts sent emails from the database and formats them for training:

```bash
python scripts/prepare-email-data.py \
  --db-url "postgresql://user:password@localhost:5432/emailai" \
  --user-id "clxyz123abc" \
  --output ./training-data \
  --min-emails 50 \
  --format both  # Creates both alpaca and chat formats
```

**What it does:**
1. Fetches sent emails from the user's email accounts
2. Cleans and preprocesses the text (removes signatures, etc.)
3. Creates instruction-response pairs for training
4. Splits into train (90%) and validation (10%) sets
5. Saves as JSONL files

**Output:**
```
training-data/
├── train_alpaca.jsonl      # Training data (Alpaca format)
├── val_alpaca.jsonl        # Validation data
├── train_chat.jsonl        # Training data (Chat format)
├── val_chat.jsonl          # Validation data
└── dataset_alpaca.json     # Combined dataset with metadata
```

**Example training record:**
```json
{
  "instruction": "Write a professional email about: Project Update",
  "input": "",
  "output": "Hi team,\n\nJust wanted to share a quick update on the project..."
}
```

### Step 2: Review and Validate Data

**Important**: Always review the training data before fine-tuning:

```bash
# Check dataset statistics
cat training-data/dataset_alpaca.json | jq '.metadata'

# Sample some training examples
cat training-data/train_alpaca.jsonl | head -5 | jq '.'

# Verify no sensitive data is exposed
grep -i "password\|credit card\|ssn" training-data/*.jsonl
```

### Step 3: Configure Training

Edit the config file for your model:

**For Llama 3.1 8B (Recommended):**
```bash
# Edit: configs/lora-config-8b.yaml

# Key settings:
base_model: "meta-llama/Llama-3.1-8B-Instruct"
num_train_epochs: 3
per_device_train_batch_size: 4
learning_rate: 2.0e-4
lora_r: 16
```

**For Llama 3.3 70B (Best Quality):**
```bash
# Edit: configs/lora-config-70b.yaml

# Key settings:
base_model: "meta-llama/Llama-3.3-70B-Instruct"
num_train_epochs: 2  # Fewer epochs for larger model
per_device_train_batch_size: 1  # Smaller batch
learning_rate: 1.0e-4  # Lower learning rate
lora_r: 32  # Higher rank
```

### Step 4: Start Training

```bash
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --output ./output/llama-3.1-8b-email-user123
```

**Monitor training:**
```bash
# Watch tensorboard logs
tensorboard --logdir ./output/llama-3.1-8b-email-user123/runs

# Training will show:
# - Training loss (should decrease)
# - Validation loss (should decrease)
# - Learning rate schedule
```

**Training checkpoints:**

The trainer saves checkpoints every 100 steps (configurable):
```
output/llama-3.1-8b-email-user123/
├── checkpoint-100/
├── checkpoint-200/
├── checkpoint-300/
└── checkpoint-final/
```

### Step 5: Evaluate Model Quality

Test the model before deployment:

```bash
python scripts/evaluate-model.py \
  --model ./output/llama-3.1-8b-email-user123 \
  --test-data data-samples/test-prompts.json \
  --output evaluation-results.json
```

**Create custom test prompts:**

```json
[
  {
    "prompt": "Write a professional email thanking a colleague for their help",
    "expected": null
  },
  {
    "prompt": "Write an email declining a meeting request politely",
    "expected": null
  }
]
```

**Review results:**
```bash
cat evaluation-results.json | jq '.[] | {prompt, generated}'
```

### Step 6: Deploy to Ollama

Two deployment options:

**Option A: LoRA Adapters (Recommended)**
```bash
# Lightweight, switchable between users
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email-user123 \
  --user-id user123
```

**Option B: Merged Model (Better Performance)**
```bash
# Standalone model, better inference speed
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email-user123 \
  --user-id user123 \
  --merge
```

**Verify deployment:**
```bash
# List Ollama models
ollama list

# Should show: emailai-user123

# Test the model
ollama run emailai-user123 "Write a professional email about a project deadline"
```

### Step 7: Configure EmailAI

Update EmailAI's `.env` file:

```bash
# For single-user:
NEXT_PUBLIC_OLLAMA_MODEL=emailai-user123
OLLAMA_BASE_URL=http://localhost:11434/api
DEFAULT_LLM_PROVIDER=ollama

# For multi-user setup:
# EmailAI can dynamically switch models based on user
# See: Multi-User Setup section below
```

---

## Vast.ai Deployment

### Why Vast.ai for Fine-Tuning?

- **Cost**: ~70% cheaper than AWS
- **Flexibility**: Rent by the hour, pause when done
- **GPUs**: RTX 4090, A100, H100 available
- **No Commitment**: Pay only for training time

### Complete Vast.ai Workflow

#### 1. Setup Vast.ai Instance

```bash
# 1. Rent GPU instance (see ollama-server/docs/VASTAI_DEPLOYMENT.md)
# 2. SSH to instance
ssh root@ssh5.vast.ai -p 12345

# 3. Clone repo
git clone https://github.com/calldatasystems/emailai.git
cd emailai/ollama-server/fine-tuning

# 4. Install dependencies
pip install -r configs/requirements.txt
```

#### 2. Transfer Training Data

**Option A: Prepare data on Vast.ai (if DB accessible)**
```bash
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data
```

**Option B: Prepare locally, transfer to Vast.ai**
```bash
# On local machine:
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data

# Transfer to Vast.ai:
scp -P 12345 -r ./training-data root@ssh5.vast.ai:/root/emailai/ollama-server/fine-tuning/
```

#### 3. Fine-Tune on Vast.ai

```bash
# On Vast.ai instance:
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml
```

**Monitor training** (from local machine):
```bash
# Forward tensorboard port
ssh -L 6006:localhost:6006 root@ssh5.vast.ai -p 12345 -N &

# Open http://localhost:6006 in browser
```

#### 4. Backup During Training

**IMPORTANT**: Vast.ai instances are ephemeral. Backup regularly!

```bash
# After each major checkpoint, backup to S3:
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123 \
  --cleanup  # Remove sensitive data after backup
```

**Backup schedule:**
- After checkpoint-100: First backup
- After checkpoint-300: Mid-training backup
- After training complete: Final backup
- Before destroying instance: Final backup + cleanup

#### 5. Resume Training (if instance destroyed)

```bash
# 1. Rent new Vast.ai instance
# 2. SSH and clone repo
# 3. Restore from backup:
bash scripts/restore-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123

# 4. Resume from last checkpoint:
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --resume-from-checkpoint ./output/llama-3.1-8b-email/checkpoint-300
```

#### 6. Deploy After Training

**Option A: Deploy on Vast.ai, use remotely**
```bash
# On Vast.ai instance:
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id user123

# Configure EmailAI to use Vast.ai Ollama:
# OLLAMA_BASE_URL=http://ssh5.vast.ai:11434/api
```

**Option B: Transfer model to permanent Ollama server**
```bash
# Backup model
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123 \
  --cleanup

# On permanent Ollama server:
bash scripts/restore-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123

# Deploy
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id user123
```

---

## Data Security

### Sensitive Data Handling

**Training data contains user emails - treat as highly sensitive!**

### Security Best Practices

#### 1. Encryption

**Always encrypt backups:**
```bash
# Backup with encryption (key is generated)
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123
  # --no-encrypt flag to disable (NOT recommended)

# Save the encryption key shown during backup!
```

#### 2. Secure Storage

**Use S3 with encryption:**
```bash
# Create S3 bucket with encryption
aws s3api create-bucket \
  --bucket your-emailai-backups \
  --region us-east-1

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket your-emailai-backups \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Enable versioning (for safety)
aws s3api put-bucket-versioning \
  --bucket your-emailai-backups \
  --versioning-configuration Status=Enabled
```

#### 3. Cleanup Ephemeral Servers

**Always clean up Vast.ai after backup:**
```bash
# Backup with automatic cleanup
bash scripts/backup-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123 \
  --cleanup  # Removes training data from server

# Verify cleanup
ls -la ./training-data  # Should be empty or deleted
```

#### 4. Access Control

**Restrict who can access training data:**
```bash
# S3 bucket policy (restrict to your AWS account)
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": [
      "arn:aws:s3:::your-emailai-backups/*"
    ],
    "Condition": {
      "StringNotEquals": {
        "aws:PrincipalAccount": "YOUR-AWS-ACCOUNT-ID"
      }
    }
  }]
}
```

### Data Retention Policy

**Recommendation:**

1. **Training Data**: Delete after fine-tuning complete
2. **Model Checkpoints**: Keep for 30 days (for rollback)
3. **Final Model**: Keep indefinitely (it's safe - no raw emails)
4. **Backups**: Encrypt and keep in cold storage

**Automated cleanup:**
```bash
# After successful deployment
bash scripts/cleanup-sensitive-data.sh \
  --user-id user123 \
  --keep-model  # Keep model, delete training data
```

---

## Troubleshooting

### Common Issues

#### 1. Out of Memory (OOM)

**Symptoms:**
```
RuntimeError: CUDA out of memory
```

**Solutions:**
```bash
# A. Use smaller batch size
# Edit config:
per_device_train_batch_size: 2  # Reduce from 4
gradient_accumulation_steps: 8  # Increase to compensate

# B. Use 4-bit quantization (already default)
use_4bit: true

# C. Enable gradient checkpointing (already default)
gradient_checkpointing: true

# D. Use smaller model (Llama 3.1 8B instead of 70B)

# E. Reduce sequence length
model_max_length: 1024  # Reduce from 2048
```

#### 2. Training Loss Not Decreasing

**Symptoms:**
- Training loss stays high or increases
- Model generates gibberish

**Solutions:**
```bash
# A. Check learning rate
learning_rate: 2.0e-4  # Try: 1.0e-4 or 5.0e-5

# B. Increase training epochs
num_train_epochs: 5  # From 3

# C. Check data quality
# Review training data for errors

# D. Use smaller LoRA rank
lora_r: 8  # From 16 (forces model to learn more efficiently)
```

#### 3. Model Outputs Don't Match User Voice

**Symptoms:**
- Generated emails sound generic
- Doesn't match user's style

**Solutions:**
```bash
# A. Need more training data
# Minimum: 100+ emails
# Better: 200-500 emails

# B. Increase LoRA rank
lora_r: 32  # From 16 (more parameters to learn style)

# C. Train longer
num_train_epochs: 5  # From 3

# D. Lower learning rate
learning_rate: 1.0e-4  # From 2.0e-4 (more careful training)

# E. Check if emails are diverse enough
# User needs varied email types (not just one kind)
```

#### 4. Vast.ai Instance Terminated Mid-Training

**Solution:**
```bash
# 1. Rent new instance (same or better GPU)
# 2. Restore from last backup
bash scripts/restore-training-data.sh \
  --method s3 \
  --bucket your-emailai-backups \
  --user-id user123

# 3. Resume from checkpoint
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml \
  --resume-from-checkpoint ./output/llama-3.1-8b-email/checkpoint-<number>
```

#### 5. Backup/Restore Issues

**Decryption failed:**
```bash
# Make sure you have the encryption key
# Check if key was saved when backup was created

# Decrypt manually:
openssl enc -aes-256-cbc -d -pbkdf2 \
  -in backup-file.tar.gz.enc \
  -out backup-file.tar.gz \
  -pass pass:"YOUR-ENCRYPTION-KEY"
```

---

## Multi-User Setup

### Option 1: One Model Per User

Each user gets their own fine-tuned model:

```bash
# User 1
emailai-user1  (based on user1's emails)

# User 2
emailai-user2  (based on user2's emails)

# User 3
emailai-user3  (based on user3's emails)
```

**EmailAI dynamically selects model based on logged-in user.**

### Option 2: Shared Base Model + User Adapters

Multiple users share base model, switch LoRA adapters:

```bash
# Base: llama3.1:8b

# User adapters:
- /models/user1-adapters/
- /models/user2-adapters/
- /models/user3-adapters/

# EmailAI loads appropriate adapter at runtime
```

**Advantages:**
- Saves disk space
- Faster model switching
- Lower memory usage

---

## Cost Estimation

### Vast.ai Costs

| Model | GPU | VRAM | Hours | Hourly | Total |
|-------|-----|------|-------|--------|-------|
| Llama 3.1 8B | RTX 4090 | 24GB | 3h | $0.35 | **$1.05** |
| Llama 3.3 70B | A100 | 80GB | 10h | $1.20 | **$12.00** |

### Comparison to Cloud APIs

**One-time fine-tuning cost:**
- Vast.ai (8B): $1-2
- Vast.ai (70B): $10-15
- OpenAI fine-tuning: $500-1000
- Anthropic fine-tuning: $800-1500

**Ongoing inference cost** (after fine-tuning):
- Local Ollama: $0 (free)
- OpenAI API: ~$0.10-0.50 per email
- Anthropic API: ~$0.15-0.60 per email

---

## Next Steps

After fine-tuning:

1. ✅ **Test the model thoroughly** with real email scenarios
2. ✅ **Gather user feedback** on generated emails
3. ✅ **Iterate if needed** (retrain with more data or adjusted config)
4. ✅ **Backup final model** to secure storage
5. ✅ **Deploy to production** Ollama server
6. ✅ **Clean up Vast.ai** and sensitive data

---

## Resources

- [LoRA Paper](https://arxiv.org/abs/2106.09685)
- [Llama Documentation](https://github.com/meta-llama/llama)
- [Hugging Face PEFT](https://github.com/huggingface/peft)
- [Vast.ai Documentation](https://vast.ai/docs)
- [EmailAI AI Features](../../../AI_FEATURES_OVERVIEW.md)

---

**Questions or issues?** Open an issue in the EmailAI repository.
