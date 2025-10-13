#!/bin/bash
# Quick Ollama status check - Simple one-liner friendly commands

OLLAMA_HOST="${OLLAMA_HOST:-http://ai.calldata.app:25630}"
OLLAMA_API="${OLLAMA_HOST}/api"

case "${1:-status}" in
    status|ps)
        echo "=== Running Models ==="
        curl -s "$OLLAMA_API/ps" | python3 -m json.tool
        ;;

    models|list)
        echo "=== Available Models ==="
        curl -s "$OLLAMA_API/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('models', []):
    size_gb = m['size'] / 1024**3
    marker = '🎯' if 'emailai-' in m['name'] else '📦'
    print(f\"{marker} {m['name']:<30} {size_gb:>8.2f} GB\")
"
        ;;

    version)
        curl -s "$OLLAMA_API/version" | python3 -m json.tool
        ;;

    finetuned)
        echo "=== Fine-tuned Models ==="
        curl -s "$OLLAMA_API/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('models', []):
    if 'emailai-' in m['name']:
        size_gb = m['size'] / 1024**3
        print(f\"🎯 {m['name']:<30} {size_gb:>8.2f} GB\")
"
        ;;

    all)
        echo "=== Ollama Server Status ==="
        echo ""
        echo "Server: $OLLAMA_HOST"
        curl -s "$OLLAMA_API/version" | python3 -c "import sys, json; print('Version:', json.load(sys.stdin)['version'])"
        echo ""

        echo "=== Running Models ==="
        RUNNING=$(curl -s "$OLLAMA_API/ps" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('models', [])))")
        echo "Count: $RUNNING"
        echo ""

        echo "=== Available Models ==="
        curl -s "$OLLAMA_API/tags" | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('models', [])
total_size = sum(m['size'] for m in models) / 1024**3
finetuned = len([m for m in models if 'emailai-' in m['name']])
print(f'Total Models: {len(models)}')
print(f'Fine-tuned: {finetuned}')
print(f'Total Size: {total_size:.2f} GB')
"
        ;;

    *)
        echo "Usage: $0 [COMMAND]"
        echo ""
        echo "Commands:"
        echo "  status, ps      - Show running models"
        echo "  models, list    - List all available models"
        echo "  finetuned       - Show only fine-tuned EmailAI models"
        echo "  version         - Show Ollama version"
        echo "  all             - Show all information (default)"
        echo ""
        echo "Examples:"
        echo "  $0              # Show all info"
        echo "  $0 models       # List models"
        echo "  $0 finetuned    # Show fine-tuned models"
        echo "  watch -n 5 $0   # Monitor every 5 seconds"
        ;;
esac
