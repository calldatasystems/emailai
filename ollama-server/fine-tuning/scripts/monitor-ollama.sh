#!/bin/bash

#######################################################################
# Monitor Ollama Server Activity
#
# This script provides real-time monitoring of your Ollama server,
# showing running models, available models, and server status.
#
# Usage:
#   ./monitor-ollama.sh                  # One-time check
#   ./monitor-ollama.sh --watch          # Continuous monitoring (5s interval)
#   ./monitor-ollama.sh --watch 10       # Custom interval (10s)
#
#######################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Default Ollama host
OLLAMA_HOST="${OLLAMA_HOST:-http://ai.calldata.app:25630}"
OLLAMA_API="${OLLAMA_HOST}/api"

# Watch mode settings
WATCH_MODE=false
INTERVAL=5

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --watch|-w)
            WATCH_MODE=true
            if [[ -n "$2" ]] && [[ "$2" =~ ^[0-9]+$ ]]; then
                INTERVAL=$2
                shift
            fi
            shift
            ;;
        --host)
            OLLAMA_HOST="$2"
            OLLAMA_API="${OLLAMA_HOST}/api"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --watch, -w [SECONDS]   Watch mode with optional interval (default: 5s)"
            echo "  --host URL              Ollama server URL (default: http://ai.calldata.app:25630)"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      # One-time check"
            echo "  $0 --watch              # Watch mode (5s interval)"
            echo "  $0 --watch 10           # Watch mode (10s interval)"
            echo "  $0 --host http://64.25.128.120:25630"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

#######################################################################
# Function to check server status
#######################################################################
check_status() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    info "Ollama Server Monitor - $(date '+%Y-%m-%d %H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Server info
    echo -e "${CYAN}Server:${NC} $OLLAMA_HOST"

    # Check connectivity
    if curl -sf "$OLLAMA_API/version" > /dev/null 2>&1; then
        VERSION=$(curl -s "$OLLAMA_API/version" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
        success "Connected (Ollama v$VERSION)"
    else
        error "Cannot connect to server"
        return 1
    fi

    echo ""

    # Running models
    echo -e "${CYAN}═══ Running Models ═══${NC}"
    RUNNING=$(curl -s "$OLLAMA_API/ps")

    if echo "$RUNNING" | grep -q '"models":\[\]'; then
        echo "  No models currently running"
    else
        echo "$RUNNING" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for model in data.get('models', []):
    print(f\"  • {model['name']}\")
    print(f\"    Size: {model['size'] / 1024**3:.2f} GB\")
    print(f\"    Until: {model.get('expires_at', 'N/A')}\")
" 2>/dev/null || echo "$RUNNING"
    fi

    echo ""

    # Available models
    echo -e "${CYAN}═══ Available Models ═══${NC}"
    MODELS=$(curl -s "$OLLAMA_API/tags")

    if echo "$MODELS" | grep -q '"models":\[\]'; then
        warn "No models installed"
    else
        echo "$MODELS" | python3 -c "
import sys, json
from datetime import datetime

data = json.load(sys.stdin)
models = data.get('models', [])

for model in models:
    name = model['name']
    size_gb = model['size'] / (1024**3)
    modified = model.get('modified_at', '')

    # Parse and format date
    if modified:
        try:
            dt = datetime.fromisoformat(modified.replace('Z', '+00:00'))
            modified_str = dt.strftime('%Y-%m-%d %H:%M')
        except:
            modified_str = modified[:16]
    else:
        modified_str = 'Unknown'

    # Check if it's a fine-tuned model
    is_finetuned = 'emailai-' in name
    marker = '🎯' if is_finetuned else '📦'

    print(f\"  {marker} {name}\")
    print(f\"     Size: {size_gb:.2f} GB\")
    print(f\"     Modified: {modified_str}\")

    details = model.get('details', {})
    if details:
        param_size = details.get('parameter_size', '')
        quant = details.get('quantization_level', '')
        if param_size:
            print(f\"     Parameters: {param_size}\")
        if quant:
            print(f\"     Quantization: {quant}\")
    print()
" 2>/dev/null || echo "$MODELS"
    fi

    echo ""

    # Summary
    MODEL_COUNT=$(echo "$MODELS" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('models', [])))" 2>/dev/null || echo "0")
    TOTAL_SIZE=$(echo "$MODELS" | python3 -c "import sys, json; print(sum(m['size'] for m in json.load(sys.stdin).get('models', [])) / 1024**3)" 2>/dev/null || echo "0")

    echo -e "${CYAN}═══ Summary ═══${NC}"
    echo "  Total Models: $MODEL_COUNT"
    printf "  Total Size: %.2f GB\n" "$TOTAL_SIZE"

    # Check for fine-tuned models
    FINETUNED_COUNT=$(echo "$MODELS" | python3 -c "import sys, json; print(len([m for m in json.load(sys.stdin).get('models', []) if 'emailai-' in m['name']]))" 2>/dev/null || echo "0")
    if [ "$FINETUNED_COUNT" -gt 0 ]; then
        echo "  Fine-tuned Models: $FINETUNED_COUNT"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

#######################################################################
# Main execution
#######################################################################

if [ "$WATCH_MODE" = true ]; then
    info "Starting watch mode (${INTERVAL}s interval). Press Ctrl+C to exit."
    echo ""

    while true; do
        clear
        check_status
        sleep "$INTERVAL"
    done
else
    check_status
fi
