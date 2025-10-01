# Ollama for EmailAI - Quick Start

**5-Minute Setup Guide** for deploying Ollama AI server for EmailAI.

## What is This?

Ollama provides **local AI inference** for EmailAI, allowing you to run powerful models like Llama 3.3 70B on your own hardware instead of using cloud APIs like OpenAI or Anthropic.

**Benefits:**
- 🔒 **Privacy**: All AI processing stays on your hardware
- 💰 **Cost**: ~70% cheaper than AWS (~$84/month vs $750/month for 8h/day)
- 🚀 **Performance**: 95/100 quality score with Llama 3.3 70B
- 🎯 **Control**: Choose your models and infrastructure

## Recommended Setup: Vast.ai

For the best cost/performance ratio, use **Vast.ai GPU rentals**:

### Step 1: Create Vast.ai Account

1. Go to https://vast.ai/
2. Sign up and add payment method
3. Deposit $10+ credits

### Step 2: Rent GPU Instance

1. Go to https://vast.ai/console/create/
2. **Search for**:
   - GPU: RTX 4090 (for Llama 3.3 70B)
   - RAM: 32GB+
   - Disk: 100GB+
   - Template: "Ubuntu 22.04 with CUDA"
3. **Select** an instance (~$0.35/hour)
4. **Add your SSH key**
5. **Launch instance**

### Step 3: Connect and Setup

```bash
# 1. SSH to your instance (use command provided by Vast.ai)
ssh root@ssh5.vast.ai -p 12345

# 2. Clone EmailAI repository
cd /root
git clone https://github.com/your-org/emailai.git
cd emailai/ollama-server/scripts

# 3. Run setup script
sudo bash setup.sh prod  # For Llama 3.3 70B (best quality)
# OR
sudo bash setup.sh dev   # For Llama 3.1 8B (cost-effective)

# 4. Wait 10-15 minutes for model download
# Setup script will display connection info when done
```

### Step 4: Configure EmailAI

After setup completes, you'll see output like:

```
Add these to your EmailAI .env file:

  OLLAMA_BASE_URL=http://123.45.67.89:11434/api
  NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
  DEFAULT_LLM_PROVIDER=ollama
```

**Important for Vast.ai**: You may need to adjust the port if Vast.ai uses port forwarding. Check your instance details for the external port (e.g., `http://ssh5.vast.ai:41134/api`).

Add these variables to your EmailAI `.env` file and restart EmailAI.

### Step 5: Test Connection

```bash
# From your local machine
curl http://ssh5.vast.ai:41134/api/tags

# Should return JSON with model info
```

## Alternative Setups

### Local Installation (No Cloud Cost)

If you have a machine with 8GB+ RAM or a GPU:

```bash
# Linux/macOS
cd ollama-server/scripts
sudo bash setup.sh dev

# Windows
cd ollama-server\scripts
.\setup.ps1 -Mode dev
```

### Docker (Containerized)

```bash
cd ollama-server/docker

# CPU only
docker-compose up -d

# With GPU
docker-compose -f docker-compose.gpu.yml up -d
```

## Model Selection

Choose based on your hardware and quality needs:

| Model | RAM Required | Quality | Cost (Vast.ai 8h/day) |
|-------|--------------|---------|------------------------|
| **llama3.3:70b** | 48GB+ | 95/100 | ~$84/month |
| **llama3.1:8b** | 8GB+ | 80/100 | ~$53/month |
| **phi3** | 4GB+ | 70/100 | ~$30/month |

Update your EmailAI `.env`:
```bash
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b  # Change to desired model
```

## Cost Comparison

| Solution | Monthly Cost (8h/day) | Quality |
|----------|----------------------|---------|
| **Vast.ai (Llama 3.3 70B)** | ~$84 | Best (95/100) |
| **Vast.ai (Llama 3.1 8B)** | ~$53 | Good (80/100) |
| **Groq Cloud API** | ~$30-40 | Best (95/100) |
| **AWS GPU (g5.2xlarge)** | ~$750 | Best (95/100) |

**Recommendation**: Use Vast.ai for best value. Pause instance when not in use to save costs.

## Troubleshooting

### Connection Refused

```bash
# 1. Check if Ollama is running on server
ssh root@ssh5.vast.ai -p 12345
sudo systemctl status ollama

# 2. Check firewall
sudo ufw allow 11434/tcp

# 3. Check Vast.ai port forwarding in console
```

### Model Not Found

```bash
# SSH to server and pull the model
ollama pull llama3.3:70b

# Update EmailAI .env to match
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
```

### Out of Memory

Use a smaller model:
```bash
# On Ollama server
ollama pull llama3.1:8b

# In EmailAI .env
NEXT_PUBLIC_OLLAMA_MODEL=llama3.1:8b
```

## Next Steps

1. ✅ Ollama deployed
2. ✅ Connected to EmailAI
3. 📖 Read [Full Documentation](./README.md)
4. 📖 Read [Vast.ai Guide](./docs/VASTAI_DEPLOYMENT.md)
5. 💰 Monitor costs in Vast.ai console
6. 🔄 Pause instance when not needed

## Support

- **Documentation**: [README.md](./README.md)
- **Vast.ai Guide**: [VASTAI_DEPLOYMENT.md](./docs/VASTAI_DEPLOYMENT.md)
- **Ollama Docs**: https://github.com/ollama/ollama
- **Vast.ai Support**: https://vast.ai/faq

---

**Quick Commands**:

```bash
# Check Ollama status
ollama-status

# Test model
curl http://localhost:11434/api/generate -d '{"model":"llama3.3:70b","prompt":"Hello"}'

# List models
ollama list

# Pull new model
ollama pull qwen2.5:14b
```
