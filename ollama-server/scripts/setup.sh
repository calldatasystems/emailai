#!/bin/bash

#######################################################################
# Ollama Server Setup Script for EmailAI
#
# This script sets up an Ollama server to provide local AI inference
# for EmailAI. It can be run on a separate machine from EmailAI.
#
# Supported Models:
# - llama3.1 (8B) - Best for lightweight deployments (requires 8GB RAM)
# - llama3.3 (70B) - Best quality (requires 48GB+ RAM)
# - qwen2.5 (7B/14B/32B) - Good balance of quality and performance
# - phi3 (3.8B) - Ultra lightweight (requires 4GB RAM)
#
# Usage:
#   sudo bash setup.sh [dev|prod]
#
# Examples:
#   sudo bash setup.sh dev    # Install Ollama + llama3.1:8b (lightweight)
#   sudo bash setup.sh prod   # Install Ollama + llama3.3:70b (best quality)
#######################################################################

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Parse arguments
MODE="${1:-dev}"

if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
    error "Invalid mode. Use 'dev' or 'prod'"
fi

info "Starting Ollama setup in $MODE mode..."

#######################################################################
# Step 0: Install Essential Dependencies
#######################################################################

info "Installing essential dependencies..."

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt-get"
    UPDATE_CMD="apt-get update -qq"
    INSTALL_CMD="apt-get install -y"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
    UPDATE_CMD="yum check-update || true"
    INSTALL_CMD="yum install -y"
elif command -v apk &> /dev/null; then
    PKG_MANAGER="apk"
    UPDATE_CMD="apk update"
    INSTALL_CMD="apk add"
else
    warn "Could not detect package manager. Some dependencies may be missing."
    PKG_MANAGER="unknown"
fi

# Install essential tools if package manager is available
if [ "$PKG_MANAGER" != "unknown" ]; then
    info "Using package manager: $PKG_MANAGER"

    # Update package lists
    $UPDATE_CMD 2>&1 | grep -v "^Get:" | grep -v "^Ign:" | grep -v "^Hit:" || true

    # List of essential packages
    ESSENTIAL_PACKAGES=(
        "curl"
        "wget"
        "git"
        "jq"
        "screen"
        "net-tools"  # netstat
        "vim"        # vi/vim editor
        "nano"       # alternative editor
        "lsof"       # list open files
        "ca-certificates"
        "gnupg"
    )

    # Install each package if not already installed
    for package in "${ESSENTIAL_PACKAGES[@]}"; do
        if ! command -v $(echo $package | sed 's/-.*//') &> /dev/null; then
            info "Installing $package..."
            $INSTALL_CMD $package 2>&1 | grep -v "^Get:" | grep -v "^Selecting" || true
        fi
    done

    success "Essential dependencies installed"
else
    warn "Skipping dependency installation (unknown package manager)"
fi

#######################################################################
# Step 0b: Install Node.js and Claude Code
#######################################################################

info "Installing Node.js and Claude Code..."

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

    if [ "$NODE_MAJOR" -ge 18 ]; then
        success "Node.js $NODE_VERSION already installed"
    else
        warn "Node.js version too old ($NODE_VERSION). Installing Node.js 18..."
        if [ "$PKG_MANAGER" = "apt-get" ]; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
            apt-get install -y nodejs
        elif [ "$PKG_MANAGER" = "yum" ]; then
            curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
            yum install -y nodejs
        fi
    fi
else
    info "Installing Node.js 18..."
    if [ "$PKG_MANAGER" = "apt-get" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [ "$PKG_MANAGER" = "yum" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    elif [ "$PKG_MANAGER" = "apk" ]; then
        apk add nodejs npm
    else
        warn "Could not install Node.js automatically. Please install manually."
    fi

    if command -v node &> /dev/null; then
        success "Node.js $(node --version) installed"
    else
        warn "Node.js installation may have failed"
    fi
fi

# Install Claude Code globally
if command -v claude &> /dev/null; then
    CLAUDE_VERSION=$(claude --version 2>&1 | head -1 || echo "unknown")
    success "Claude Code already installed ($CLAUDE_VERSION)"
else
    info "Installing Claude Code..."
    npm install -g @anthropic-ai/claude-code 2>&1 | grep -v "^npm WARN" || true

    if command -v claude &> /dev/null; then
        success "Claude Code installed successfully"
        info "Start with: claude"
    else
        warn "Claude Code installation may have failed. Try manually: npm install -g @anthropic-ai/claude-code"
    fi
fi

#######################################################################
# Step 1: Check System Requirements
#######################################################################

info "Checking system requirements..."

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    success "OS: Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    success "OS: macOS"
else
    error "Unsupported OS: $OSTYPE. This script supports Linux and macOS only."
fi

# Check available RAM
TOTAL_RAM=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || sysctl -n hw.memsize 2>/dev/null | awk '{print int($1/1024/1024/1024)}')

if [ -z "$TOTAL_RAM" ]; then
    warn "Could not detect RAM. Proceeding anyway..."
else
    info "Total RAM: ${TOTAL_RAM}GB"

    if [[ "$MODE" == "prod" && "$TOTAL_RAM" -lt 48 ]]; then
        warn "Production mode (Llama 3.3 70B) requires 48GB+ RAM. You have ${TOTAL_RAM}GB."
        warn "Consider using development mode or upgrading your hardware."
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    elif [[ "$MODE" == "dev" && "$TOTAL_RAM" -lt 8 ]]; then
        warn "Development mode (Llama 3.1 8B) requires 8GB+ RAM. You have ${TOTAL_RAM}GB."
        warn "Consider using a smaller model like phi3 (4GB)."
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Check GPU
if command -v nvidia-smi &> /dev/null; then
    GPU_INFO=$(nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -1)
    success "NVIDIA GPU detected: $GPU_INFO"
    USE_GPU=true
else
    info "No NVIDIA GPU detected. Will use CPU (slower)."
    USE_GPU=false
fi

#######################################################################
# Step 2: Install Ollama
#######################################################################

info "Installing Ollama..."

if command -v ollama &> /dev/null; then
    OLLAMA_VERSION=$(ollama --version 2>&1 | grep -oP 'version \K[0-9.]+' || echo "unknown")
    success "Ollama already installed (version $OLLAMA_VERSION)"
    read -p "Reinstall Ollama? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Reinstalling Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
    fi
else
    info "Downloading and installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

success "Ollama installed successfully"

#######################################################################
# Step 3: Start Ollama Service
#######################################################################

info "Starting Ollama service..."

# Detect if running in a container (Vast.ai, Docker, etc.)
RUNNING_IN_CONTAINER=false
if [ -f /.dockerenv ] || [ -f /run/.containerenv ] || grep -q 'docker\|lxc\|kubepods' /proc/1/cgroup 2>/dev/null; then
    RUNNING_IN_CONTAINER=true
    info "Container environment detected (Docker/Vast.ai)"
fi

# Check if systemd is available
if command -v systemctl &> /dev/null && [ "$RUNNING_IN_CONTAINER" = false ]; then
    info "Using systemd to manage Ollama service..."

    # Configure systemd service to bind to 0.0.0.0
    mkdir -p /etc/systemd/system/ollama.service.d
    cat > /etc/systemd/system/ollama.service.d/override.conf << EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
EOF

    # Reload systemd and restart service
    systemctl daemon-reload
    systemctl enable ollama 2>/dev/null || true
    systemctl restart ollama 2>/dev/null || true
    sleep 3

    if systemctl is-active --quiet ollama; then
        success "Ollama service is running via systemd (bound to 0.0.0.0:11434)"
    else
        warn "Could not start Ollama via systemd. Starting manually..."
        OLLAMA_HOST=0.0.0.0:11434 ollama serve > /var/log/ollama.log 2>&1 &
        sleep 3
    fi
else
    # Container or no systemd - use screen or nohup
    info "No systemd available - using alternative process management..."

    # Check if screen is available
    if command -v screen &> /dev/null; then
        info "Using screen to manage Ollama process..."

        # Kill existing screen session if it exists
        screen -S ollama -X quit 2>/dev/null || true

        # Start Ollama in screen session with proper host binding
        screen -dmS ollama bash -c 'OLLAMA_HOST=0.0.0.0:11434 ollama serve'
        sleep 5

        success "Ollama started in screen session 'ollama'"
        info "Reattach with: screen -r ollama (Ctrl+A then D to detach)"
    else
        # Install screen if not available
        info "Installing screen for process management..."
        if command -v apt-get &> /dev/null; then
            apt-get update -qq && apt-get install -y screen
        elif command -v yum &> /dev/null; then
            yum install -y screen
        else
            warn "Could not install screen. Using nohup instead..."
            OLLAMA_HOST=0.0.0.0:11434 nohup ollama serve > /var/log/ollama.log 2>&1 &
            sleep 5
            success "Ollama started with nohup (logs at /var/log/ollama.log)"
        fi

        # Try again with screen if we just installed it
        if command -v screen &> /dev/null; then
            screen -dmS ollama bash -c 'OLLAMA_HOST=0.0.0.0:11434 ollama serve'
            sleep 5
            success "Ollama started in screen session 'ollama'"
        fi
    fi
fi

# Verify Ollama is running
info "Verifying Ollama is responding..."
RETRY_COUNT=0
MAX_RETRIES=10

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        success "Ollama is running on http://localhost:11434"
        break
    else
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            info "Waiting for Ollama to start... ($RETRY_COUNT/$MAX_RETRIES)"
            sleep 2
        else
            error "Ollama is not responding after $MAX_RETRIES attempts. Check logs at /var/log/ollama.log or use: screen -r ollama"
        fi
    fi
done

# Verify IPv4 binding
info "Verifying IPv4 binding..."
if command -v netstat &> /dev/null; then
    IPV4_BINDING=$(netstat -tlnp 2>/dev/null | grep 11434 | grep -E '0.0.0.0|127.0.0.1')
    IPV6_ONLY=$(netstat -tlnp 2>/dev/null | grep 11434 | grep ':::' | grep -v '0.0.0.0')
elif command -v ss &> /dev/null; then
    IPV4_BINDING=$(ss -tlnp 2>/dev/null | grep 11434 | grep -E '0.0.0.0|127.0.0.1')
    IPV6_ONLY=$(ss -tlnp 2>/dev/null | grep 11434 | grep '::' | grep -v '0.0.0.0')
else
    warn "Cannot verify binding (netstat/ss not available)"
    IPV4_BINDING="unknown"
fi

if [ -n "$IPV4_BINDING" ] && echo "$IPV4_BINDING" | grep -q '0.0.0.0'; then
    success "Ollama is bound to IPv4 (0.0.0.0:11434) - accessible remotely"
elif [ -n "$IPV6_ONLY" ] && [ -z "$IPV4_BINDING" ]; then
    error "Ollama is only bound to IPv6 (:::11434). This may not be accessible remotely. Restarting with correct binding..."

    # Kill and restart with correct binding
    pkill ollama
    sleep 2

    if [ "$RUNNING_IN_CONTAINER" = true ]; then
        screen -S ollama -X quit 2>/dev/null || true
        screen -dmS ollama bash -c 'OLLAMA_HOST=0.0.0.0:11434 ollama serve'
        sleep 5
    else
        systemctl restart ollama
        sleep 3
    fi

    # Check again
    if netstat -tlnp 2>/dev/null | grep 11434 | grep -q '0.0.0.0' || ss -tlnp 2>/dev/null | grep 11434 | grep -q '0.0.0.0'; then
        success "Ollama now bound to IPv4 (0.0.0.0:11434)"
    else
        warn "Still having issues with IPv4 binding. Check: netstat -tlnp | grep 11434"
    fi
else
    info "Ollama binding: $IPV4_BINDING"
fi

#######################################################################
# Step 4: Pull AI Models
#######################################################################

info "Downloading AI models..."

if [[ "$MODE" == "prod" ]]; then
    MODEL_NAME="llama3.3:70b"
    MODEL_SIZE="~40GB"
    info "Production mode: Pulling Llama 3.3 70B (this will take a while...)"
    warn "This will download approximately $MODEL_SIZE of data"
else
    MODEL_NAME="llama3.1:8b"
    MODEL_SIZE="~4.7GB"
    info "Development mode: Pulling Llama 3.1 8B"
    warn "This will download approximately $MODEL_SIZE of data"
fi

read -p "Continue with download? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    warn "Skipping model download. You can pull models later with: ollama pull $MODEL_NAME"
else
    info "Pulling $MODEL_NAME..."
    ollama pull "$MODEL_NAME"
    success "Model $MODEL_NAME downloaded successfully"
fi

#######################################################################
# Step 5: Test the Model
#######################################################################

info "Testing the model..."

TEST_RESPONSE=$(ollama run "$MODEL_NAME" "Say 'Hello from Ollama!' in one sentence" --verbose=false 2>&1 || echo "ERROR")

if [[ "$TEST_RESPONSE" == *"ERROR"* ]] || [[ -z "$TEST_RESPONSE" ]]; then
    error "Model test failed. Check logs with: journalctl -u ollama -n 50"
else
    success "Model test successful!"
    info "Response: $TEST_RESPONSE"
fi

#######################################################################
# Step 6: Configure Firewall (if needed)
#######################################################################

info "Checking firewall configuration..."

# Check if ufw is installed and active
if command -v ufw &> /dev/null && ufw status | grep -q "Status: active"; then
    info "UFW firewall detected"
    read -p "Allow Ollama port 11434 through firewall? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ufw allow 11434/tcp
        success "Port 11434 opened in firewall"
    fi
fi

# Check if firewalld is installed and running
if command -v firewall-cmd &> /dev/null && systemctl is-active --quiet firewalld; then
    info "firewalld detected"
    read -p "Allow Ollama port 11434 through firewall? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        firewall-cmd --permanent --add-port=11434/tcp
        firewall-cmd --reload
        success "Port 11434 opened in firewall"
    fi
fi

#######################################################################
# Step 7: Create Configuration File
#######################################################################

info "Creating configuration file..."

CONFIG_FILE="/etc/ollama/config.env"
mkdir -p "$(dirname "$CONFIG_FILE")"

cat > "$CONFIG_FILE" << EOF
# Ollama Configuration for EmailAI
# Generated: $(date)

# Model configuration
OLLAMA_MODEL=$MODEL_NAME
OLLAMA_MODE=$MODE

# Server configuration
OLLAMA_HOST=0.0.0.0:11434
OLLAMA_ORIGINS=*

# Performance tuning
OLLAMA_NUM_PARALLEL=4
OLLAMA_MAX_LOADED_MODELS=1

# GPU configuration (if available)
OLLAMA_GPU_LAYERS=${USE_GPU:+999}

# Logging
OLLAMA_DEBUG=false
EOF

success "Configuration saved to $CONFIG_FILE"

#######################################################################
# Step 8: Create Helper Scripts
#######################################################################

info "Creating helper scripts..."

# Create status check script
cat > /usr/local/bin/ollama-status << 'EOF'
#!/bin/bash
echo "=== Ollama Status ==="
echo ""
echo "Service Status:"
if command -v systemctl &> /dev/null && systemctl is-active --quiet ollama 2>/dev/null; then
    systemctl status ollama --no-pager 2>/dev/null
elif screen -ls | grep -q ollama; then
    echo "✓ Running in screen session 'ollama'"
    echo "  Reattach with: screen -r ollama"
else
    ps aux | grep "ollama serve" | grep -v grep > /dev/null && echo "✓ Running as background process" || echo "✗ Not running"
fi
echo ""
echo "Loaded Models:"
curl -s http://localhost:11434/api/tags | jq -r '.models[] | "\(.name) - \(.size/1024/1024/1024 | floor)GB"' 2>/dev/null || echo "Could not retrieve models (is Ollama running?)"
echo ""
echo "Listening on:"
if command -v ss &> /dev/null; then
    ss -tlnp | grep 11434 || echo "Not listening"
elif command -v netstat &> /dev/null; then
    netstat -tlnp | grep 11434 || echo "Not listening"
else
    lsof -i :11434 2>/dev/null || echo "Could not check (ss/netstat/lsof not available)"
fi
EOF
chmod +x /usr/local/bin/ollama-status

# Create test script
cat > /usr/local/bin/ollama-test << 'EOF'
#!/bin/bash
MODEL="${1:-llama3.1:8b}"
echo "Testing model: $MODEL"
echo ""
ollama run "$MODEL" "Respond with exactly 5 words: I am working correctly"
EOF
chmod +x /usr/local/bin/ollama-test

success "Helper scripts created:"
success "  - ollama-status (check service status)"
success "  - ollama-test [model] (test a model)"

#######################################################################
# Step 9: Display Connection Information
#######################################################################

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}' || ip addr show | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | cut -d/ -f1 | head -1)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Ollama Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Configuration Summary:"
echo "  Mode: $MODE"
echo "  Model: $MODEL_NAME"
echo "  GPU: ${USE_GPU:-false}"
echo ""
info "Connection Details:"
echo "  Local URL: http://localhost:11434"
echo "  Network URL: http://${SERVER_IP}:11434"
echo ""
info "Add these to your EmailAI .env file:"
echo ""
echo "  OLLAMA_BASE_URL=http://${SERVER_IP}:11434/api"
echo "  NEXT_PUBLIC_OLLAMA_MODEL=$MODEL_NAME"
echo "  DEFAULT_LLM_PROVIDER=ollama"
echo ""
info "Useful Commands:"
echo "  Check status: ollama-status"
echo "  Test model: ollama-test $MODEL_NAME"
echo "  List models: ollama list"
echo "  Pull new model: ollama pull [model-name]"

if [ "$RUNNING_IN_CONTAINER" = true ]; then
    echo "  Reattach to Ollama: screen -r ollama"
    echo "  View logs: screen -r ollama (Ctrl+A then D to detach)"
else
    echo "  View logs: journalctl -u ollama -f"
fi

echo ""
info "Claude Code (AI Assistant):"
if command -v claude &> /dev/null; then
    echo "  ✓ Claude Code is installed"
    echo "  Start with: claude"
    echo "  Or in screen: screen -S claude && claude"
else
    echo "  ✗ Claude Code not installed (optional)"
    echo "  Install manually: npm install -g @anthropic-ai/claude-code"
fi

echo ""
info "Next Steps:"
echo "  1. Copy the environment variables above to your EmailAI .env file"
echo "  2. Restart EmailAI application"
echo "  3. Test the connection from EmailAI"
echo "  4. (Optional) Start Claude Code for interactive assistance: claude"

if [ "$RUNNING_IN_CONTAINER" = true ]; then
    echo ""
    warn "Container Environment Notes:"
    echo "  - Ollama is running in screen session 'ollama'"
    echo "  - If you exit SSH, the process will continue running"
    echo "  - To stop Ollama: screen -r ollama, then Ctrl+C"
    echo "  - To restart: screen -dmS ollama bash -c 'OLLAMA_HOST=0.0.0.0:11434 ollama serve'"
fi
echo ""
warn "Security Note:"
echo "  Ollama is now accessible on your network at http://${SERVER_IP}:11434"
echo "  Consider setting up authentication or restricting access via firewall."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
