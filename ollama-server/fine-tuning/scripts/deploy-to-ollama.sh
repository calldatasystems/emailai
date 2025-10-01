#!/bin/bash

#######################################################################
# Deploy Fine-Tuned Model to Ollama
#
# This script converts a fine-tuned Llama LoRA model to Ollama format
# and makes it available for use with EmailAI.
#
# Two deployment options:
# 1. LoRA adapters (lightweight, switchable)
# 2. Merged model (standalone, better performance)
#
# Usage:
#   ./deploy-to-ollama.sh --model ./output/llama-3.1-8b-email --user-id user123
#   ./deploy-to-ollama.sh --model ./output/llama-3.3-70b-email --merge
#
#######################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }

# Parse arguments
MODEL_DIR=""
USER_ID=""
MERGE=false
QUANTIZE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --model)
            MODEL_DIR="$2"
            shift 2
            ;;
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        --merge)
            MERGE=true
            shift
            ;;
        --quantize)
            QUANTIZE="$2"  # q4_0, q5_K_M, q8_0
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

if [ -z "$MODEL_DIR" ]; then
    error "Model directory required: --model /path/to/model"
fi

if [ -z "$USER_ID" ]; then
    error "User ID required: --user-id <user-id>"
fi

if [ ! -d "$MODEL_DIR" ]; then
    error "Model directory not found: $MODEL_DIR"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Deploying Model to Ollama"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "Configuration:"
echo "  Model: $MODEL_DIR"
echo "  User ID: $USER_ID"
echo "  Merge: $MERGE"
echo "  Quantize: ${QUANTIZE:-none}"
echo ""

# Load training config to get base model
CONFIG_FILE="$MODEL_DIR/training_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    error "Training config not found: $CONFIG_FILE"
fi

BASE_MODEL=$(jq -r '.base_model' "$CONFIG_FILE")
info "Base model: $BASE_MODEL"

# Create model name
MODEL_NAME="emailai-${USER_ID}"
if [ "$MERGE" = true ]; then
    MODEL_NAME="${MODEL_NAME}-merged"
fi

echo ""

#######################################################################
# Option 1: Deploy LoRA Adapters (Lightweight)
#######################################################################

if [ "$MERGE" = false ]; then
    info "Deploying as LoRA adapters (lightweight, switchable)..."

    # Create Modelfile for Ollama
    MODELFILE="$MODEL_DIR/Modelfile"

    cat > "$MODELFILE" << EOF
# EmailAI Fine-Tuned Model (LoRA Adapters)
# User: $USER_ID
# Base Model: $BASE_MODEL

FROM $BASE_MODEL

# Load LoRA adapters
ADAPTER $MODEL_DIR

# System prompt for email writing
SYSTEM """You are an AI email assistant. Write emails in the user's voice and style. Be professional, clear, and concise."""

# Temperature and sampling parameters
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40

# Stop sequences
PARAMETER stop "### Instruction:"
PARAMETER stop "### Response:"
EOF

    success "Modelfile created: $MODELFILE"

    # Create model in Ollama
    info "Creating Ollama model: $MODEL_NAME"

    if ! command -v ollama &> /dev/null; then
        error "Ollama not found. Please install Ollama first."
    fi

    ollama create "$MODEL_NAME" -f "$MODELFILE"

    success "Model created in Ollama: $MODEL_NAME"

#######################################################################
# Option 2: Merge and Deploy (Standalone)
#######################################################################

else
    info "Merging LoRA adapters with base model..."

    warn "This requires the 'mergekit' Python package"
    warn "Install: pip install mergekit"

    # Check if mergekit is available
    if ! python3 -c "import mergekit" 2>/dev/null; then
        error "mergekit not installed. Run: pip install mergekit"
    fi

    # Create merge script
    MERGE_SCRIPT="/tmp/merge_lora.py"

    cat > "$MERGE_SCRIPT" << 'EOFPY'
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel
import sys
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--base-model', required=True)
parser.add_argument('--lora-model', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()

print(f"Loading base model: {args.base_model}")
base_model = AutoModelForCausalLM.from_pretrained(
    args.base_model,
    torch_dtype=torch.float16,
    device_map="cpu"
)

print(f"Loading LoRA adapters: {args.lora_model}")
model = PeftModel.from_pretrained(base_model, args.lora_model)

print("Merging...")
model = model.merge_and_unload()

print(f"Saving merged model to: {args.output}")
model.save_pretrained(args.output)

# Save tokenizer
tokenizer = AutoTokenizer.from_pretrained(args.base_model)
tokenizer.save_pretrained(args.output)

print("✅ Merge complete!")
EOFPY

    MERGED_DIR="$MODEL_DIR-merged"

    python3 "$MERGE_SCRIPT" \
        --base-model "$BASE_MODEL" \
        --lora-model "$MODEL_DIR" \
        --output "$MERGED_DIR"

    rm "$MERGE_SCRIPT"

    success "Models merged: $MERGED_DIR"

    # Optionally quantize
    if [ -n "$QUANTIZE" ]; then
        info "Quantizing to $QUANTIZE format..."

        # Convert to GGUF format (required for Ollama)
        warn "Quantization requires llama.cpp"
        warn "See: https://github.com/ggerganov/llama.cpp"

        # This would use llama.cpp's quantization tools
        # For now, skip and let Ollama handle it
        warn "Skipping quantization - will use default format"
    fi

    # Create Modelfile for merged model
    MODELFILE="$MERGED_DIR/Modelfile"

    cat > "$MODELFILE" << EOF
# EmailAI Fine-Tuned Model (Merged)
# User: $USER_ID

FROM $MERGED_DIR

# System prompt
SYSTEM """You are an AI email assistant trained on this user's email style. Write emails matching their voice, tone, and communication patterns."""

PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
EOF

    success "Modelfile created for merged model"

    # Create in Ollama
    info "Creating Ollama model: $MODEL_NAME"
    ollama create "$MODEL_NAME" -f "$MODELFILE"

    success "Merged model deployed to Ollama: $MODEL_NAME"
fi

#######################################################################
# Test the Model
#######################################################################

echo ""
info "Testing model..."

TEST_PROMPT="Write a professional email thanking a colleague for their help on a project."

echo "Test prompt: $TEST_PROMPT"
echo ""
echo "Response:"
echo "─────────────────────────────────────────────────────────────"

ollama run "$MODEL_NAME" "$TEST_PROMPT"

echo "─────────────────────────────────────────────────────────────"
echo ""

#######################################################################
# Display Configuration
#######################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

info "Model Details:"
echo "  Name: $MODEL_NAME"
echo "  Type: $([ "$MERGE" = true ] && echo "Merged" || echo "LoRA Adapters")"
echo "  Base: $BASE_MODEL"
echo ""

info "To use with EmailAI, update .env:"
echo ""
echo "  # Use this specific user's fine-tuned model"
echo "  NEXT_PUBLIC_OLLAMA_MODEL=$MODEL_NAME"
echo "  OLLAMA_BASE_URL=http://localhost:11434/api"
echo "  DEFAULT_LLM_PROVIDER=ollama"
echo ""

info "Ollama Commands:"
echo "  List models: ollama list"
echo "  Test model: ollama run $MODEL_NAME"
echo "  Remove model: ollama rm $MODEL_NAME"
echo "  Show info: ollama show $MODEL_NAME"
echo ""

info "Multi-User Setup:"
echo "  Each user can have their own fine-tuned model:"
echo "  - emailai-user1"
echo "  - emailai-user2"
echo "  - emailai-user3"
echo ""
echo "  EmailAI can dynamically select the model based on user ID."
echo ""

warn "Important Notes:"
if [ "$MERGE" = false ]; then
    echo "  ✓ LoRA adapters are lightweight (~100MB)"
    echo "  ✓ Easy to switch between users"
    echo "  ✓ Can update adapters without replacing base model"
    echo "  ✗ Slightly slower inference than merged"
else
    echo "  ✓ Merged model has better performance"
    echo "  ✓ Standalone - no dependencies"
    echo "  ✗ Larger size (~8GB for 8B model)"
    echo "  ✗ Separate model per user needed"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
