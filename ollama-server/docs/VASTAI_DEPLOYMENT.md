# Ollama Deployment on Vast.ai for EmailAI

This guide explains how to deploy Ollama on a Vast.ai GPU server for use with EmailAI.

## Why Vast.ai?

[Vast.ai](https://vast.ai/) provides affordable GPU rentals, making it cost-effective to run large language models like Llama 3.3 70B:

- **Cost**: ~$0.20-0.50/hour (vs $0.60-1.00/hour on AWS)
- **Flexibility**: Rent by the hour, pause when not needed
- **GPU Selection**: Wide variety of GPUs (RTX 3090, RTX 4090, A6000, etc.)
- **No Commitment**: No long-term contracts

## Prerequisites

1. **Vast.ai Account**
   - Sign up at https://vast.ai/
   - Add payment method
   - Deposit credits ($10+ recommended)

2. **SSH Key**
   - Generate if you don't have one: `ssh-keygen -t ed25519`
   - Copy public key: `cat ~/.ssh/id_ed25519.pub`

3. **EmailAI Instance**
   - EmailAI should already be running (locally or on cloud)
   - You'll connect EmailAI to your Vast.ai Ollama server

## Step-by-Step Deployment

### 1. Create Vast.ai Instance

1. **Go to** https://vast.ai/console/create/

2. **Search for instances** with these recommended specs:

   **For Llama 3.3 70B (Best Quality):**
   - GPU: RTX 4090 (24GB VRAM) or A6000 (48GB VRAM)
   - RAM: 32GB+
   - Disk: 100GB+
   - Bandwidth: High
   - Filter: "Verified" providers
   - Estimated cost: $0.30-0.60/hour

   **For Llama 3.1 8B (Cost-Effective):**
   - GPU: RTX 3060 Ti (8GB) or RTX 3070 (8GB)
   - RAM: 16GB+
   - Disk: 50GB+
   - Bandwidth: Medium
   - Estimated cost: $0.15-0.30/hour

3. **Select "On-demand" instance**

4. **Choose template**: Select "Ubuntu 22.04 with CUDA" (or similar)

5. **Add your SSH key** in the SSH section

6. **Launch instance**

7. **Note the connection details**:
   - SSH command will be shown (e.g., `ssh root@ssh5.vast.ai -p 12345`)
   - External IP and port

### 2. Connect to Your Instance

```bash
# Use the SSH command provided by Vast.ai
ssh root@ssh5.vast.ai -p 12345

# Or if they provide direct IP:
ssh root@123.45.67.89 -p 22
```

### 3. Clone EmailAI Repository

```bash
# Install git if not present
apt-get update && apt-get install -y git

# Clone the repo
cd /root
git clone https://github.com/calldatasystems/emailai.git
cd emailai/ollama-server/scripts
```

### 4. Run Setup Script

```bash
# For Llama 3.3 70B (production quality)
sudo bash setup.sh prod

# For Llama 3.1 8B (cost-effective)
sudo bash setup.sh dev
```

The script will:
- ✅ Install Ollama
- ✅ Detect and configure GPU
- ✅ Pull the AI model (this may take 10-30 minutes)
- ✅ Start Ollama service
- ✅ Configure firewall
- ✅ Test the model

### 5. Get Connection Information

After setup completes, you'll see output like:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Ollama Setup Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Connection Details:
  Local URL: http://localhost:11434
  Network URL: http://123.45.67.89:11434

Add these to your EmailAI .env file:

  OLLAMA_BASE_URL=http://123.45.67.89:11434/api
  NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
  DEFAULT_LLM_PROVIDER=ollama
```

**Important**: Note down the IP address and model name!

### 6. Configure Port Forwarding (Vast.ai)

Vast.ai may use non-standard ports. You need to expose port 11434:

1. **In Vast.ai console**, go to your instance
2. **Edit instance** or check "Port Mappings"
3. **Add port mapping**: Internal 11434 → External (e.g., 41134)
4. **Note the external port**

Your connection URL will be:
```
OLLAMA_BASE_URL=http://ssh5.vast.ai:41134/api
```

### 7. Test Ollama Connection

From your **local machine** (not the Vast.ai server):

```bash
# Replace with your Vast.ai external address and port
curl http://ssh5.vast.ai:41134/api/tags

# Should return JSON with model info
# If timeout, check port forwarding
```

### 8. Configure EmailAI

On your **EmailAI server**, update `.env`:

```bash
# Example for Vast.ai with port forwarding
OLLAMA_BASE_URL=http://ssh5.vast.ai:41134/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
DEFAULT_LLM_PROVIDER=ollama

# Optional: Set economy model (use Ollama for expensive tasks only)
# ECONOMY_LLM_PROVIDER=groq
# ECONOMY_LLM_MODEL=llama-3.3-70b-versatile
```

### 9. Restart EmailAI

```bash
cd /path/to/emailai
pnpm dev  # or your production command
```

### 10. Verify Connection

Check EmailAI logs when AI features are used. You should see Ollama requests succeeding.

## Cost Optimization

### Pause When Not in Use

Vast.ai charges by the hour. **Pause your instance** when not actively using EmailAI:

```bash
# From Vast.ai console:
# Instance → Actions → Stop/Pause
```

**Note**: You'll lose the IP address when paused. Update EmailAI `.env` with new IP when restarting.

### Use Spot Instances

For even lower costs, use **interruptible instances**:
- Price: ~50% cheaper
- Risk: Instance can be reclaimed
- Best for: Development, testing

### Share Across Multiple EmailAI Users

One Ollama server can serve multiple EmailAI instances:

```bash
# EmailAI Instance 1 .env
OLLAMA_BASE_URL=http://ssh5.vast.ai:41134/api

# EmailAI Instance 2 .env
OLLAMA_BASE_URL=http://ssh5.vast.ai:41134/api

# Both use the same Ollama server
```

Configure parallel requests in Ollama:
```bash
# On Vast.ai server: /etc/ollama/config.env
OLLAMA_NUM_PARALLEL=8  # Increase for multiple users
```

## Monitoring & Maintenance

### Check Ollama Status

```bash
# SSH to Vast.ai server
ssh root@ssh5.vast.ai -p 12345

# Check status
ollama-status

# View logs
sudo journalctl -u ollama -f
```

### Check GPU Usage

```bash
# Monitor GPU in real-time
watch -n 1 nvidia-smi

# Should show ollama process using GPU
```

### Model Management

```bash
# List installed models
ollama list

# Pull additional models
ollama pull qwen2.5:14b

# Remove unused models (free space)
ollama rm llama3.1:8b
```

## Troubleshooting

### Issue: Connection Refused from EmailAI

**Symptoms**: EmailAI can't connect to Ollama

**Solutions**:

1. **Check port forwarding**:
   ```bash
   # On Vast.ai server, verify Ollama is listening
   ss -tlnp | grep 11434
   ```

2. **Check firewall**:
   ```bash
   # Allow port 11434
   sudo ufw allow 11434/tcp
   ```

3. **Test from Vast.ai server**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

4. **Check Vast.ai port mapping** in console

### Issue: Slow Inference

**Symptoms**: AI responses taking >30 seconds

**Solutions**:

1. **Verify GPU is being used**:
   ```bash
   nvidia-smi
   # Should show ollama using GPU memory
   ```

2. **Check if model fits in VRAM**:
   ```bash
   # Llama 3.3 70B needs ~40GB VRAM
   # Use quantized version if limited VRAM:
   ollama pull llama3.3:70b-q4_0  # 4-bit quantization
   ```

3. **Upgrade to faster GPU** (RTX 4090, A6000)

### Issue: Instance Terminated (Interruptible)

**Symptoms**: Ollama suddenly unavailable

**Solutions**:

1. **Rent a new instance** (follow steps 1-5 again)
2. **Update EmailAI `.env`** with new IP/port
3. **Use on-demand instances** for production (more stable)

### Issue: Out of Disk Space

**Symptoms**: Can't pull models

**Solutions**:

```bash
# Check disk usage
df -h

# Remove old models
ollama rm old-model-name

# Request more storage from Vast.ai
# (Instance → Edit → Increase disk size)
```

## Security Considerations

### Network Access

By default, Ollama is accessible from anywhere. For production:

1. **Use VPN** or **Tailscale** to create private network
2. **Restrict by IP** in firewall:
   ```bash
   # Only allow from EmailAI server IP
   sudo ufw allow from YOUR_EMAILAI_IP to any port 11434
   ```

3. **Add authentication** (nginx reverse proxy):
   ```bash
   # Install nginx
   apt-get install nginx

   # Configure with basic auth
   # See full guide in main README.md
   ```

### Data Privacy

- All inference happens on Vast.ai server (not cloud APIs)
- No data sent to external services
- Data processed in server RAM/VRAM only
- Consider **dedicated instances** for sensitive data

## Cost Examples

### Llama 3.3 70B (Best Quality)

| GPU | VRAM | Hourly | Daily (8h) | Monthly (8h/day) |
|-----|------|--------|------------|------------------|
| RTX 4090 | 24GB | $0.35 | $2.80 | ~$84 |
| RTX 4090 x2 | 48GB | $0.60 | $4.80 | ~$144 |
| A6000 | 48GB | $0.50 | $4.00 | ~$120 |

### Llama 3.1 8B (Cost-Effective)

| GPU | VRAM | Hourly | Daily (8h) | Monthly (8h/day) |
|-----|------|--------|------------|------------------|
| RTX 3060 Ti | 8GB | $0.18 | $1.44 | ~$43 |
| RTX 3070 | 8GB | $0.22 | $1.76 | ~$53 |
| RTX 4060 Ti | 16GB | $0.25 | $2.00 | ~$60 |

**Comparison to AWS**:
- AWS g5.2xlarge: ~$750/month (24/7)
- Vast.ai (8h/day): ~$84/month
- **Savings**: ~88% cheaper

## Persistence & Backups

Vast.ai instances are **ephemeral**. To preserve your setup:

### 1. Snapshot Your Instance (Recommended)

Some Vast.ai providers support snapshots:
- Save instance state
- Restart later with same configuration
- Check provider details

### 2. Backup Configuration

Save these files locally:

```bash
# From Vast.ai server
scp root@ssh5.vast.ai:/etc/ollama/config.env ./ollama-config-backup.env

# List of models
ssh root@ssh5.vast.ai "ollama list" > models-backup.txt
```

### 3. Quick Re-Setup Script

If your instance is terminated:

```bash
# 1. Rent new instance
# 2. SSH to new instance
# 3. Run quick setup:

cd /root
git clone https://github.com/calldatasystems/emailai.git
cd emailai/ollama-server/scripts
sudo bash setup.sh prod

# 4. Update EmailAI .env with new IP
```

## Advanced: Hybrid Deployment

Use Ollama for expensive tasks, Groq for fast/cheap tasks:

```bash
# EmailAI .env
DEFAULT_LLM_PROVIDER=groq                      # Fast, cheap tasks
GROQ_API_KEY=your-groq-key

ECONOMY_LLM_PROVIDER=ollama                    # Expensive tasks
OLLAMA_BASE_URL=http://ssh5.vast.ai:41134/api
NEXT_PUBLIC_OLLAMA_MODEL=llama3.3:70b
```

EmailAI will automatically:
- Use Groq for simple categorization, summaries
- Use Ollama for complex drafts, custom knowledge

**Result**: Best quality + low cost

## Next Steps

1. ✅ Ollama deployed on Vast.ai
2. ✅ Connected to EmailAI
3. 📝 Test AI features in EmailAI
4. 💰 Monitor costs in Vast.ai console
5. 🔄 Pause instance when not in use

## Support

- **Vast.ai Support**: https://vast.ai/faq
- **Vast.ai Discord**: https://discord.gg/vast-ai
- **Ollama Docs**: https://github.com/ollama/ollama
- **EmailAI Issues**: https://github.com/calldatasystems/emailai/issues

---

**Quick Reference**:

```bash
# Connect to instance
ssh root@ssh5.vast.ai -p <port>

# Clone and setup
git clone https://github.com/calldatasystems/emailai.git
cd emailai/ollama-server/scripts
sudo bash setup.sh prod

# Check status
ollama-status
nvidia-smi

# Test model
curl http://localhost:11434/api/generate -d '{"model":"llama3.3:70b","prompt":"Hello"}'
```
