# Setting Up Claude Code on Vast.ai for Ollama Configuration

Guide to install Claude Code CLI on your Vast.ai GPU instance so you can configure Ollama interactively.

---

## Quick Setup

SSH into your Vast.ai instance and install Claude Code:

### Method 1: Install via npm (Recommended)

```bash
# Update system and install Node.js if needed
apt update && apt install -y curl git

# Install Node.js 18+ (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### Method 2: Use npx (No installation)

```bash
# Run Claude Code directly with npx
npx @anthropic-ai/claude-code
```

Then start Claude Code:

```bash
claude
```

---

## Step-by-Step Setup

### 1. Rent Vast.ai Instance

1. Go to https://vast.ai
2. Search for instance with:
   - **GPU**: RTX 4090 (24GB VRAM) or better
   - **Disk**: 100GB+
   - **Image**: Ubuntu 22.04 with CUDA
3. Rent instance and note SSH connection details

### 2. Connect via SSH

```bash
ssh root@ssh5.vast.ai -p YOUR_PORT
```

Example:
```bash
ssh root@ssh5.vast.ai -p 12345
```

### 3. Install Claude Code

**Option A: Install via npm (Recommended)**

```bash
# Update system
apt update && apt install -y curl git

# Install Node.js 18+ (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify Node.js
node --version  # Should be 18+

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

**Option C: Use Docker**

```bash
# Pull Claude Code container
docker pull anthropic/claude-code:latest

# Run Claude Code in container
docker run -it \
  -v $(pwd):/workspace \
  anthropic/claude-code:latest
```

### 4. Authenticate Claude Code

Start Claude Code:

```bash
claude
```

Follow authentication prompts:
- It will open a browser or give you a URL
- Login with your Anthropic account
- Grant access to Claude Code

**If browser doesn't open** (common on remote servers):

```bash
# Copy the URL shown and open it on your local machine
# Complete authentication there
# Then paste the token back into the SSH session
```

### 5. Clone EmailAI Repository

```bash
# Clone the repo
git clone https://github.com/your-org/emailai.git
cd emailai
```

### 6. Start Working with Claude

```bash
# Start Claude Code in the emailai directory
claude

# Or if already running, navigate to the directory
cd emailai
```

Now you can ask Claude to help with Ollama setup:

```
Set up Ollama on this Vast.ai server for production use
```

---

## Alternative: Use Claude Desktop with SSH Tunnel

If you prefer Claude Desktop on your local machine but want to work on the Vast.ai server:

### 1. Setup SSH Tunnel (Local Machine)

**Linux/macOS:**
```bash
# Create SSH tunnel
ssh -L 2222:localhost:22 root@ssh5.vast.ai -p YOUR_PORT

# Keep this terminal open
```

**Windows (PowerShell):**
```powershell
# Using Windows OpenSSH
ssh -L 2222:localhost:22 root@ssh5.vast.ai -p YOUR_PORT
```

### 2. Configure VS Code Remote SSH (Local Machine)

If using VS Code with Claude extension:

1. Install "Remote - SSH" extension
2. Connect to `localhost:2222`
3. Open `/root/emailai` folder
4. Use Claude extension as normal

---

## Working with Claude Code on Vast.ai

Once Claude Code is installed and authenticated:

### Setup Ollama

```bash
# In Claude Code chat:
claude> Run the Ollama setup script in production mode
```

Claude will:
1. Read `ollama-server/scripts/setup.sh`
2. Execute with `sudo bash setup.sh prod`
3. Help troubleshoot any issues

### Check Ollama Status

```
claude> Check if Ollama is running and which models are installed
```

### Pull Specific Models

```
claude> Pull Llama 3.3 70B model for production use
```

### Configure for EmailAI

```
claude> Configure this Ollama server to work with EmailAI at emailai.calldata.app
```

### Test Ollama API

```
claude> Test the Ollama API endpoint to make sure it's working
```

---

## Troubleshooting

### Claude Code won't install

**Issue**: npm install fails

```bash
# Install build tools
apt update
apt install -y build-essential python3

# Try again
npm install -g @anthropic-ai/claude-code
```

**Issue**: Permission denied

```bash
# You're root on Vast.ai, but if needed:
sudo npm install -g @anthropic-ai/claude-code
```

### Can't authenticate Claude Code

**Issue**: No browser available

1. Look for the authentication URL in the terminal
2. Copy it to your local machine's browser
3. Complete authentication
4. Copy the token back to the SSH session

**Alternative**: Use Claude API key directly

```bash
# Set API key (if you have one)
export ANTHROPIC_API_KEY="your-api-key"

# Then start Claude
claude
```

### SSH connection drops

**Use screen or tmux to keep sessions alive:**

```bash
# Install screen
apt install -y screen

# Start screen session
screen -S claude

# Start Claude Code
claude

# Detach: Ctrl+A, then D
# Reattach later: screen -r claude
```

### Port conflicts

If Claude Code needs specific ports:

```bash
# Check what's using the port
lsof -i :PORT_NUMBER

# Kill process if needed
kill -9 PID
```

---

## Recommended Workflow

### Initial Setup

1. **SSH to Vast.ai**:
   ```bash
   ssh root@ssh5.vast.ai -p YOUR_PORT
   ```

2. **Install Claude Code**:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh
   ```

3. **Start screen session** (to prevent disconnection issues):
   ```bash
   screen -S ollama-setup
   ```

4. **Clone EmailAI**:
   ```bash
   git clone https://github.com/your-org/emailai.git
   cd emailai
   ```

5. **Start Claude Code**:
   ```bash
   claude
   ```

6. **Ask Claude to setup Ollama**:
   ```
   Setup Ollama for production use with Llama 3.3 70B model
   ```

### Daily Work

```bash
# SSH to Vast.ai
ssh root@ssh5.vast.ai -p YOUR_PORT

# Reattach to screen session
screen -r ollama-setup

# Claude Code should still be running
# If not, start it:
cd emailai && claude
```

---

## Using Claude Code for Specific Tasks

### 1. Initial Ollama Setup

```
claude> I need to setup Ollama on this Vast.ai GPU server.
Please run the setup script in ollama-server/scripts/setup.sh in production mode.
```

### 2. Install Specific Model

```
claude> Pull and setup Llama 3.3 70B model optimized for this GPU
```

### 3. Configure Networking

```
claude> Configure Ollama to be accessible from emailai.calldata.app.
Set up proper firewall rules and security.
```

### 4. Test Configuration

```
claude> Test the Ollama API to make sure it's working correctly.
Try generating a sample email response.
```

### 5. Setup Monitoring

```
claude> Setup monitoring for Ollama. I want to track GPU usage,
memory, and API response times.
```

### 6. Optimize Performance

```
claude> Optimize Ollama configuration for maximum throughput
on this RTX 4090. Adjust batch sizes and concurrency.
```

---

## Environment Setup for Claude

Create a `.claude-config.json` in your home directory for better context:

```json
{
  "project": "EmailAI Ollama Server",
  "context": {
    "environment": "Vast.ai GPU Server",
    "gpu": "RTX 4090 24GB",
    "purpose": "Production Ollama server for emailai.calldata.app",
    "model": "llama3.3:70b"
  },
  "directories": {
    "emailai": "/root/emailai",
    "ollama_scripts": "/root/emailai/ollama-server/scripts",
    "ollama_docs": "/root/emailai/ollama-server/docs"
  }
}
```

This gives Claude better context about your setup.

---

## Quick Reference Commands

```bash
# Install Claude Code
curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh

# Start Claude Code
claude

# Use with screen (recommended)
screen -S claude
claude
# Detach: Ctrl+A, then D
# Reattach: screen -r claude

# Clone EmailAI
git clone https://github.com/your-org/emailai.git
cd emailai

# Run Ollama setup via Claude
# In Claude chat:
# "Run ollama-server/scripts/setup.sh in production mode"

# Check Ollama status
# In Claude chat:
# "Check if Ollama is running and show me the installed models"

# Test Ollama
# In Claude chat:
# "Test Ollama API by generating a sample response"
```

---

## Security Considerations

### Don't expose Anthropic API keys

```bash
# If using API key, use environment variable
export ANTHROPIC_API_KEY="your-key"

# Don't commit to git
echo "ANTHROPIC_API_KEY" >> .gitignore
```

### Secure SSH

```bash
# Use SSH keys instead of passwords
ssh-keygen -t ed25519 -C "vastai-ollama"

# Copy public key to Vast.ai instance
cat ~/.ssh/id_ed25519.pub
# Add to ~/.ssh/authorized_keys on Vast.ai
```

### Firewall Configuration

```bash
# Claude can help with this:
claude> Setup UFW firewall to only allow:
- SSH from my IP
- Ollama API (11434) from emailai.calldata.app
- Block everything else
```

---

## Cost Optimization

### Pause instance when not using Claude

```bash
# Before pausing instance, exit Claude
exit

# Exit screen session
exit

# On Vast.ai dashboard: Pause instance
```

### Use cheaper instances for setup

For initial Claude-assisted setup (not running models yet):
- You can use cheaper CPU-only instances
- Switch to GPU instance after setup is complete

---

## Getting Help

### Claude Code Issues

- Documentation: https://docs.claude.com/claude-code
- GitHub: https://github.com/anthropics/claude-code/issues

### Vast.ai Issues

- Documentation: https://vast.ai/docs
- Support: https://vast.ai/console/support

### EmailAI + Ollama Issues

- Ask Claude! It has full context of the EmailAI codebase
- See: `ollama-server/docs/VASTAI_DEPLOYMENT.md`

---

## Example Session

Here's what a typical setup session looks like:

```bash
# 1. SSH to Vast.ai
$ ssh root@ssh5.vast.ai -p 12345

# 2. Install Claude Code
root@vast:~# curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh
✓ Claude Code installed successfully

# 3. Start screen session
root@vast:~# screen -S setup

# 4. Clone repo
root@vast:~# git clone https://github.com/your-org/emailai.git
root@vast:~# cd emailai

# 5. Start Claude
root@vast:~/emailai# claude
Claude Code v1.0.0
Authenticated as: your-email@example.com

claude> I'm on a Vast.ai GPU server with RTX 4090.
I need to setup Ollama for production use with EmailAI.
Can you run the setup script in ollama-server/scripts/setup.sh?

[Claude reads the script and executes it]