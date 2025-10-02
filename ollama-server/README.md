# Ollama Server for EmailAI

This directory contains deployment scripts and configurations for running Ollama as a separate AI inference server for EmailAI.

## Overview

Ollama provides local AI model inference for EmailAI, allowing you to run powerful language models like Llama 3.1 and Llama 3.3 on your own hardware instead of using cloud APIs.

### Why Separate Deployment?

Ollama requires significant computational resources (RAM, GPU) that may not be suitable for the same server running EmailAI. Running Ollama separately allows you to:

- **Scale independently**: Run Ollama on hardware optimized for AI workloads
- **Cost optimization**: Use spot instances or dedicated GPU servers only when needed
- **Flexibility**: Deploy Ollama on-premise, cloud, or hybrid
- **Performance**: Dedicated resources for AI inference without affecting EmailAI performance

## Supported Models

| Model | Size | RAM Required | Best For | Quality Score |
|-------|------|--------------|----------|---------------|
| **llama3.3:70b** | ~40GB | 48GB+ | Production, best quality | 95/100 |
| **llama3.1:8b** | ~4.7GB | 8GB+ | Development, cost-effective | 80/100 |
| **qwen2.5:7b** | ~4.4GB | 8GB+ | Balanced performance | 78/100 |
| **qwen2.5:14b** | ~8.2GB | 16GB+ | Good quality, moderate cost | 85/100 |
| **phi3:3.8b** | ~2.3GB | 4GB+ | Ultra lightweight | 70/100 |
| **fine-tuned** | Varies | Same as base | **Personalized user voice** | **95+/100** |

### 🎯 Fine-Tuned Models (NEW!)

Train custom models on each user's email history to write in their unique voice:

- **Quality**: Best possible (learns user's exact style, tone, vocabulary)
- **Setup**: 2-4 hours to train on Vast.ai (~$1-2 per user)
- **Result**: Emails that sound like the user wrote them

📖 **[Fine-Tuning Guide](./fine-tuning/README.md)** | 📖 **[Complete Workflow](./fine-tuning/docs/FINE_TUNING_GUIDE.md)**

## Deployment Options

### 1. Vast.ai GPU Rental (Recommended for Production)

**Best for**: Production deployments with best cost/performance ratio

Vast.ai provides affordable GPU rentals (~70% cheaper than AWS):

- **Cost**: $0.20-0.50/hour (~$50-120/month for 8h/day usage)
- **GPUs**: RTX 3090, RTX 4090, A6000, and more
- **Flexibility**: Rent by the hour, pause when not needed

**Quick Start**:
1. Create Vast.ai account at https://vast.ai/
2. Rent instance with GPU (RTX 4090 recommended for Llama 3.3 70B)
3. SSH to instance
4. Clone this repo: `git clone https://github.com/calldatasystems/emailai.git`
5. Run setup: `cd emailai/ollama-server/scripts && sudo bash setup.sh prod`

The setup script automatically installs:
- ✅ All system dependencies (curl, git, vim, netstat, screen)
- ✅ Node.js 18+
- ✅ Claude Code (for interactive AI assistance)
- ✅ Ollama with selected model
- ✅ Helper scripts for management

📖 **[Full Vast.ai Deployment Guide](./docs/VASTAI_DEPLOYMENT.md)**

**Costs**:
- Llama 3.3 70B (RTX 4090): ~$0.35/hour (~$84/month for 8h/day)
- Llama 3.1 8B (RTX 3070): ~$0.22/hour (~$53/month for 8h/day)

---

### 2. Local Installation (Linux/macOS)

**Best for**: Development, testing, on-premise deployments

```bash
# Development mode (Llama 3.1 8B)
cd ollama-server/scripts
sudo bash setup.sh dev

# Production mode (Llama 3.3 70B)
sudo bash setup.sh prod
```

**Requirements:**
- Ubuntu 20.04+ / macOS 11+
- 8GB+ RAM (dev) or 48GB+ RAM (prod)
- 50GB+ disk space

---

### 3. Local Installation (Windows)

**Best for**: Development, testing, Windows environments

```powershell
# Development mode (Llama 3.1 8B)
cd ollama-server\scripts
.\setup.ps1 -Mode dev

# Production mode (Llama 3.3 70B)
.\setup.ps1 -Mode prod
```

**Requirements:**
- Windows 10/11 or Windows Server 2019+
- 8GB+ RAM (dev) or 48GB+ RAM (prod)
- 50GB+ disk space

---

### 4. Docker Deployment

**Best for**: Containerized environments, easy deployment

```bash
cd ollama-server/docker

# CPU-only deployment
docker-compose up -d

# GPU deployment (requires nvidia-docker)
docker-compose -f docker-compose.gpu.yml up -d
```

**Features:**
- Includes Ollama Web UI on port 8080
- Persistent data volumes
- Easy model management

**Requirements:**
- Docker 20.10+
- Docker Compose 2.0+
- nvidia-docker2 (for GPU support)

---

### 5. AWS Deployment (Optional)

**Best for**: Enterprise deployments requiring AWS infrastructure

**Note**: For most users, Vast.ai (option 1) is more cost-effective.

```bash
cd ollama-server/scripts

# Development instance (r7i.xlarge)
./setup-aws.sh dev

# Production instance (g5.2xlarge with GPU)
./setup-aws.sh prod
```

**Features:**
- Automated EC2 provisioning
- Optimized instance types
- Security group configuration
- Auto-install and model pull

**Costs**:
- Development: ~$165-220/month (r7i.xlarge)
- Production: ~$450-750/month (g5.2xlarge with GPU)

## Features

### ✅ Base Model Deployment
- Deploy Llama 3.1/3.3 models on your own hardware
- No cloud API costs
- 100% data privacy
- Multiple deployment options (local, Docker, cloud)

### 🎯 Fine-Tuning (NEW!)
- **Train models on user's email history**
- **Generate emails in user's unique voice**
- Automatic backup/restore for Vast.ai
- Resume training after instance loss
- Multi-user support (one model per user)

📖 **[Fine-Tuning Documentation](./fine-tuning/README.md)**

---

## Quick Start

### 1. Choose Deployment Method

**Recommended for Production**: Use **Vast.ai** for cost-effective GPU access:

1. Create Vast.ai account at https://vast.ai/
2. Rent GPU instance (see [Vast.ai Guide](./docs/VASTAI_DEPLOYMENT.md))
3. SSH to instance and clone this repo
4. Run setup script (see below)

**For Development/Testing**: Use **local installation** or **Docker**:

```bash
# Option A: Vast.ai (Recommended for Production)
# See full guide: ./docs/VASTAI_DEPLOYMENT.md
# 1. SSH to your Vast.ai instance
# 2. Then run:
cd /root
git clone https://github.com/calldatasystems/emailai.git
cd emailai/ollama-server/scripts
sudo bash setup.sh prod

# Option B: Local install (Linux/macOS)
cd ollama-server/scripts
sudo bash setup.sh dev

# Option C: Docker
cd ollama-server/docker
docker-compose up -d
```

### 2. Verify Installation

After deployment, verify Ollama is running:

```bash
# Check if Ollama is responding
curl http://localhost:11434/api/tags

# Test the model
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Say hello in one sentence"
}'
```

### 3. Configure EmailAI

Add these environment variables to your EmailAI `.env` file:

```bash
# If Ollama is on the same machine
OLLAMA_BASE_URL=http://localhost:11434/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.1:8b
DEFAULT_LLM_PROVIDER=ollama

# If Ollama is on a different machine/server
OLLAMA_BASE_URL=http://YOUR_OLLAMA_SERVER_IP:11434/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.1:8b
DEFAULT_LLM_PROVIDER=ollama
```

### 4. Restart EmailAI

```bash
cd /path/to/emailai
pnpm dev  # or your production start command
```

### 5. Test the Connection

EmailAI should now use your Ollama server for AI inference. You can verify this in the EmailAI logs when AI features are used.

## Model Management

### Pulling New Models

```bash
# List available models
ollama list

# Pull a specific model
ollama pull llama3.3:70b
ollama pull qwen2.5:14b
ollama pull phi3

# Pull quantized versions (lower memory)
ollama pull llama3.1:8b-q4_0   # 4-bit quantization
ollama pull llama3.1:8b-q5_K_M # 5-bit quantization
```

### Switching Models in EmailAI

Update your EmailAI `.env` file:

```bash
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b  # Change to desired model
```

Then restart EmailAI.

### Removing Models

```bash
# Remove a model to free up space
ollama rm llama3.1:8b
```

## Performance Optimization

### GPU Acceleration (Recommended for Production)

If you have an NVIDIA GPU:

1. **Install NVIDIA drivers** (Linux):
   ```bash
   sudo apt-get install nvidia-driver-535
   ```

2. **Install CUDA toolkit**:
   ```bash
   wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb
   sudo dpkg -i cuda-keyring_1.1-1_all.deb
   sudo apt-get update
   sudo apt-get install cuda
   ```

3. **Restart Ollama** - it will automatically detect and use the GPU

4. **Verify GPU usage**:
   ```bash
   nvidia-smi  # Should show ollama process using GPU
   ```

### Memory Optimization

If running out of memory, use quantized models:

```bash
# Original: llama3.1:8b (~8GB RAM)
# 4-bit quantized: llama3.1:8b-q4_0 (~4GB RAM)
ollama pull llama3.1:8b-q4_0
```

Update EmailAI:
```bash
NEXT_PUBLIC_OLLAMA_MODEL=llama3.1:8b-q4_0
```

### Concurrent Requests

Configure in `/etc/ollama/config.env`:

```bash
OLLAMA_NUM_PARALLEL=4        # Number of parallel requests
OLLAMA_MAX_LOADED_MODELS=1   # Keep only 1 model in memory
```

## Monitoring & Troubleshooting

### Check Ollama Status

```bash
# Using helper script (if you used setup.sh)
ollama-status

# Manual check
systemctl status ollama  # Linux
curl http://localhost:11434/api/tags
```

### View Logs

```bash
# Linux (systemd)
sudo journalctl -u ollama -f

# Docker
docker logs -f emailai-ollama

# Manual log file
tail -f /var/log/ollama.log
```

### Common Issues

#### Issue: "Connection refused" from EmailAI

**Solution:**
1. Verify Ollama is running: `curl http://localhost:11434/api/tags`
2. Check firewall: `sudo ufw allow 11434/tcp`
3. Verify `OLLAMA_BASE_URL` in EmailAI `.env` is correct

#### Issue: "Model not found"

**Solution:**
```bash
# List available models
ollama list

# Pull the missing model
ollama pull llama3.1:8b

# Update EmailAI .env to match
NEXT_PUBLIC_OLLAMA_MODEL=llama3.1:8b
```

#### Issue: Out of memory

**Solution:**
1. Use a smaller model: `phi3` or `llama3.1:8b-q4_0`
2. Increase server RAM
3. Enable swap (not recommended for performance)

#### Issue: Slow inference

**Solution:**
1. Use GPU acceleration (see above)
2. Use quantized models (Q4, Q5)
3. Reduce concurrent requests in Ollama config
4. Use a larger instance type (AWS)

## Security Considerations

### Network Access

By default, Ollama listens on `0.0.0.0:11434` (all network interfaces). This allows EmailAI on another server to connect.

**Production recommendations:**

1. **Restrict by IP** (firewall):
   ```bash
   # Allow only from EmailAI server
   sudo ufw allow from YOUR_EMAILAI_IP to any port 11434
   ```

2. **Use private network** (AWS VPC, etc.)

3. **Add authentication** (reverse proxy):
   ```nginx
   # nginx config
   location /ollama/ {
       auth_basic "Restricted";
       auth_basic_user_file /etc/nginx/.htpasswd;
       proxy_pass http://localhost:11434/;
   }
   ```

### Data Privacy

- Ollama runs **entirely on your hardware**
- No data sent to external APIs
- Models are downloaded once and stored locally
- All inference happens locally

## Cost Comparison

| Deployment | Monthly Cost | Setup Time | Best For |
|------------|--------------|------------|----------|
| **Vast.ai (8h/day)** | ~$50-120 | 15 min | **Best value for production** |
| **Vast.ai (24/7)** | ~$150-360 | 15 min | Always-on production |
| **Local (existing hardware)** | $0 | 10 min | Small teams, dev |
| **Docker (existing server)** | $0 | 5 min | Containerized environments |
| **AWS Dev (r7i.xlarge)** | ~$220 | 15 min | Enterprise on AWS |
| **AWS Prod (g5.2xlarge)** | ~$750 | 15 min | Enterprise GPU on AWS |
| **Cloud API (Groq)** | ~$30-40 | 2 min | Low volume, testing |

**Recommendation**: Use Vast.ai for production (70% cheaper than AWS) and pause when not in use.

## Architecture

```
┌─────────────────┐
│   EmailAI App   │
│  (Next.js)      │
└────────┬────────┘
         │ HTTP API
         │ (OLLAMA_BASE_URL)
         ▼
┌─────────────────┐
│ Ollama Server   │
│ (Port 11434)    │
├─────────────────┤
│ • Model: Llama  │
│ • GPU/CPU       │
│ • Local storage │
└─────────────────┘
```

## Advanced Configuration

### Custom Model Parameters

Create a custom model with specific parameters:

```bash
# Create Modelfile
cat > Modelfile << EOF
FROM llama3.1:8b
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
EOF

# Create custom model
ollama create emailai-llama3.1 -f Modelfile

# Use in EmailAI
NEXT_PUBLIC_OLLAMA_MODEL=emailai-llama3.1
```

### Environment Variables

Full list of Ollama environment variables:

```bash
OLLAMA_HOST=0.0.0.0:11434      # Bind address
OLLAMA_ORIGINS=*               # CORS origins
OLLAMA_NUM_PARALLEL=4          # Concurrent requests
OLLAMA_MAX_LOADED_MODELS=1     # Models in memory
OLLAMA_GPU_LAYERS=999          # GPU layers (999=all)
OLLAMA_DEBUG=false             # Debug logging
```

### Load Balancing (Multiple Ollama Servers)

For high-availability, run multiple Ollama servers:

```bash
# EmailAI .env
OLLAMA_BASE_URL=http://load-balancer:11434/api

# Nginx load balancer config
upstream ollama_backend {
    server ollama-1:11434;
    server ollama-2:11434;
    server ollama-3:11434;
}

server {
    listen 11434;
    location / {
        proxy_pass http://ollama_backend;
    }
}
```

## Migration from Cloud APIs

If you're currently using OpenAI, Anthropic, or Groq:

1. **Deploy Ollama** (choose method above)
2. **Pull models**: `ollama pull llama3.3:70b`
3. **Update EmailAI `.env`**:
   ```bash
   # Old (cloud API)
   DEFAULT_LLM_PROVIDER=openai
   OPENAI_API_KEY=sk-...

   # New (Ollama)
   DEFAULT_LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434/api
   NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
   ```
4. **Restart EmailAI**
5. **Test functionality**

**Performance comparison:**
- Groq (cloud): ~1-2 second response time
- Ollama (GPU): ~2-5 second response time
- Ollama (CPU): ~10-30 second response time

## Support

### Documentation

- [Ollama Documentation](https://github.com/ollama/ollama/blob/main/docs)
- [Model Library](https://ollama.com/library)
- [EmailAI AI Features](../AI_FEATURES_OVERVIEW.md)

### Community

- [Ollama Discord](https://discord.gg/ollama)
- [Ollama GitHub Issues](https://github.com/ollama/ollama/issues)

### Troubleshooting

Check the main EmailAI documentation:
- [Deployment Guide](../docs/DEPLOYMENT_GUIDE.md)
- [Admin Guide](../docs/ADMIN_GUIDE.md)

## License

Ollama is licensed under the MIT License.

Individual models have their own licenses - check each model's page before use:
- Llama 3: [Meta Llama 3 License](https://llama.meta.com/llama3/license/)
- Qwen: [Apache 2.0](https://github.com/QwenLM/Qwen)
- Phi-3: [MIT](https://huggingface.co/microsoft/phi-3)

---

## Fine-Tuning for Personalized Email Voice

Want AI to write emails that sound exactly like your users? **Fine-tune a Llama model** on their email history!

### Quick Start: Fine-Tuning

```bash
cd ollama-server/fine-tuning

# 1. Extract training data from user's sent emails
python scripts/prepare-email-data.py \
  --db-url "$DATABASE_URL" \
  --user-id "user123" \
  --output ./training-data

# 2. Fine-tune model (2-4 hours on Vast.ai RTX 4090, ~$1-2 cost)
python scripts/finetune-lora.py \
  --config configs/lora-config-8b.yaml

# 3. Deploy to Ollama
bash scripts/deploy-to-ollama.sh \
  --model ./output/llama-3.1-8b-email \
  --user-id "user123"

# 4. Use in EmailAI
# NEXT_PUBLIC_OLLAMA_MODEL=emailai-user123
```

### Features

- ✅ **LoRA Fine-Tuning**: Efficient, uses 50% less memory
- ✅ **Checkpoint Resume**: Resume training if Vast.ai instance is lost
- ✅ **Encrypted Backups**: Secure data storage for ephemeral servers
- ✅ **Multi-User**: One fine-tuned model per user
- ✅ **Data Security**: Automatic cleanup of sensitive data

### Documentation

📖 **[Fine-Tuning Guide](./fine-tuning/README.md)** - Quick start
📖 **[Complete Workflow](./fine-tuning/docs/FINE_TUNING_GUIDE.md)** - Detailed guide
📖 **[Vast.ai Deployment](./docs/VASTAI_DEPLOYMENT.md)** - GPU rental guide

---

**Quick Links:**
- [Setup Script (Linux/macOS)](./scripts/setup.sh)
- [Setup Script (Windows)](./scripts/setup.ps1)
- [Docker Compose](./docker/docker-compose.yml)
- [AWS Deployment](./scripts/setup-aws.sh)
- **[Fine-Tuning Guide](./fine-tuning/README.md)** 🎯
