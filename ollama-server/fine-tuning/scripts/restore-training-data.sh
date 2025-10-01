#!/bin/bash

#######################################################################
# Restore Training Data Script
#
# This script restores training data and checkpoints from backup
# to resume training on a new Vast.ai instance after the previous
# instance was destroyed.
#
# This allows you to:
# - Resume training from last checkpoint
# - Avoid losing training progress
# - Switch to cheaper GPU instances mid-training
# - Recover from instance failures
#
# Usage:
#   ./restore-training-data.sh --method s3 --bucket my-bucket --user-id user123
#   ./restore-training-data.sh --method local --source /path/to/backup.tar.gz
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
METHOD="local"
USER_ID=""
SOURCE=""
S3_BUCKET=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --method)
            METHOD="$2"
            shift 2
            ;;
        --bucket)
            S3_BUCKET="$2"
            shift 2
            ;;
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        --source)
            SOURCE="$2"
            shift 2
            ;;
        --encryption-key)
            ENCRYPTION_KEY="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

if [ -z "$USER_ID" ]; then
    error "User ID required: --user-id <user-id>"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "Restoring Training Data for User: $USER_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

#######################################################################
# Step 1: Download Backup
#######################################################################

TEMP_FILE="/tmp/backup-download.tar.gz.enc"

case $METHOD in
    s3)
        if [ -z "$S3_BUCKET" ]; then
            error "S3 bucket required: --bucket <bucket-name>"
        fi

        info "Fetching latest backup from S3..."

        # List backups for user
        LATEST_BACKUP=$(aws s3 ls "s3://$S3_BUCKET/emailai-backups/" | \
            grep "$USER_ID-backup" | \
            sort -r | \
            head -1 | \
            awk '{print $4}')

        if [ -z "$LATEST_BACKUP" ]; then
            error "No backups found for user: $USER_ID"
        fi

        info "Found latest backup: $LATEST_BACKUP"

        # Download
        aws s3 cp "s3://$S3_BUCKET/emailai-backups/$LATEST_BACKUP" "$TEMP_FILE"

        success "Downloaded from S3"
        ;;

    local)
        if [ -z "$SOURCE" ]; then
            error "Source file required: --source /path/to/backup.tar.gz"
        fi

        if [ ! -f "$SOURCE" ]; then
            error "Source file not found: $SOURCE"
        fi

        info "Using local backup: $SOURCE"
        cp "$SOURCE" "$TEMP_FILE"
        success "Loaded local backup"
        ;;

    *)
        error "Unknown method: $METHOD"
        ;;
esac

#######################################################################
# Step 2: Decrypt (if needed)
#######################################################################

DECRYPTED_FILE="/tmp/backup-decrypted.tar.gz"

# Check if file is encrypted (has .enc extension or encrypted header)
if [[ "$TEMP_FILE" == *.enc ]] || file "$TEMP_FILE" | grep -q "openssl"; then
    info "Backup is encrypted"

    if [ -z "$ENCRYPTION_KEY" ]; then
        echo ""
        read -s -p "🔑 Enter encryption key: " ENCRYPTION_KEY
        echo ""
    fi

    info "Decrypting backup..."
    openssl enc -aes-256-cbc -d -pbkdf2 -in "$TEMP_FILE" -out "$DECRYPTED_FILE" -pass pass:"$ENCRYPTION_KEY"

    if [ $? -ne 0 ]; then
        error "Decryption failed. Check encryption key."
    fi

    success "Backup decrypted"
    rm "$TEMP_FILE"
else
    info "Backup is not encrypted"
    mv "$TEMP_FILE" "$DECRYPTED_FILE"
fi

#######################################################################
# Step 3: Extract Backup
#######################################################################

info "Extracting backup..."

EXTRACT_DIR="/tmp/backup-extract"
mkdir -p "$EXTRACT_DIR"

tar -xzf "$DECRYPTED_FILE" -C "$EXTRACT_DIR"

# Find the actual backup directory (has timestamp in name)
BACKUP_CONTENT=$(find "$EXTRACT_DIR" -maxdepth 1 -type d -name "emailai-backup-*" | head -1)

if [ -z "$BACKUP_CONTENT" ]; then
    error "Invalid backup structure"
fi

success "Backup extracted"

#######################################################################
# Step 4: Restore Files
#######################################################################

info "Restoring files..."

# Create directory structure
mkdir -p ./training-data
mkdir -p ./output
mkdir -p ./configs

# Restore training data
if [ -d "$BACKUP_CONTENT/training-data" ]; then
    cp -r "$BACKUP_CONTENT/training-data"/* ./training-data/
    success "Training data restored"
fi

# Restore model checkpoints
if [ -d "$BACKUP_CONTENT/output" ]; then
    cp -r "$BACKUP_CONTENT/output"/* ./output/
    success "Model checkpoints restored"
fi

# Restore configs
if [ -d "$BACKUP_CONTENT/configs" ]; then
    cp -r "$BACKUP_CONTENT/configs"/* ./configs/
    success "Configs restored"
fi

# Read manifest
if [ -f "$BACKUP_CONTENT/manifest.json" ]; then
    success "Backup manifest found:"
    cat "$BACKUP_CONTENT/manifest.json"
    echo ""
fi

#######################################################################
# Step 5: Find Latest Checkpoint
#######################################################################

info "Looking for training checkpoints..."

LATEST_CHECKPOINT=$(find ./output -type d -name "checkpoint-*" | sort -V | tail -1)

if [ -n "$LATEST_CHECKPOINT" ]; then
    success "Found latest checkpoint: $LATEST_CHECKPOINT"

    # Extract checkpoint number
    CHECKPOINT_NUM=$(basename "$LATEST_CHECKPOINT" | grep -oP 'checkpoint-\K[0-9]+')

    echo ""
    warn "🔄 Training can be resumed from checkpoint $CHECKPOINT_NUM"
    echo ""
    info "To resume training:"
    echo "  python finetune-lora.py \\"
    echo "    --config configs/lora-config-8b.yaml \\"
    echo "    --resume-from-checkpoint $LATEST_CHECKPOINT"
    echo ""
else
    warn "No checkpoints found - will start training from scratch"
fi

#######################################################################
# Step 6: Clean Up
#######################################################################

info "Cleaning up temporary files..."
rm -rf "$EXTRACT_DIR"
rm -f "$DECRYPTED_FILE"

success "Cleanup complete"

#######################################################################
# Step 7: Display Summary
#######################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Restore Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

info "Restored Contents:"
echo "  Training data: $([ -d ./training-data ] && find ./training-data -type f | wc -l || echo 0) files"
echo "  Checkpoints: $([ -d ./output ] && find ./output -type d -name "checkpoint-*" | wc -l || echo 0) found"
echo "  Configs: $([ -d ./configs ] && find ./configs -type f | wc -l || echo 0) files"
echo ""

if [ -n "$LATEST_CHECKPOINT" ]; then
    info "Next Steps (Resume Training):"
    echo "  1. Verify restored files"
    echo "  2. Resume training from checkpoint $CHECKPOINT_NUM"
    echo "  3. Run: python scripts/finetune-lora.py --config configs/lora-config-8b.yaml --resume-from-checkpoint $LATEST_CHECKPOINT"
else
    info "Next Steps (Start Fresh):"
    echo "  1. Verify training data"
    echo "  2. Start training from beginning"
    echo "  3. Run: python scripts/finetune-lora.py --config configs/lora-config-8b.yaml"
fi

echo ""
warn "Remember:"
echo "  ✓ Backup regularly during training (every few checkpoints)"
echo "  ✓ Test model after each major checkpoint"
echo "  ✓ Delete sensitive data from Vast.ai after final backup"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
