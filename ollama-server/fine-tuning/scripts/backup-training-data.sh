#!/bin/bash

#######################################################################
# Backup Training Data Script
#
# This script backs up training data and models from Vast.ai server
# to prevent data loss when the ephemeral instance is destroyed.
#
# IMPORTANT: Vast.ai instances are ephemeral. Always backup:
# - Training data (contains user emails - sensitive!)
# - Fine-tuned models
# - Training configs and logs
#
# Backup destinations:
# 1. S3 bucket (recommended for production)
# 2. Local machine (scp)
# 3. External storage
#
# Usage:
#   ./backup-training-data.sh --method s3 --bucket my-bucket
#   ./backup-training-data.sh --method local --dest /path/to/backup
#
# Security:
# - Training data contains user emails (SENSITIVE)
# - Encrypt backups before uploading
# - Use separate S3 bucket with encryption
# - Clean up data from Vast.ai after backup
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

# Default values
METHOD="local"
ENCRYPT=true
CLEANUP=false
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Parse arguments
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
        --dest)
            LOCAL_DEST="$2"
            shift 2
            ;;
        --user-id)
            USER_ID="$2"
            shift 2
            ;;
        --no-encrypt)
            ENCRYPT=false
            shift
            ;;
        --cleanup)
            CLEANUP=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

if [ -z "$USER_ID" ]; then
    error "User ID required: --user-id <user-id>"
fi

info "Backup Configuration:"
echo "  Method: $METHOD"
echo "  User ID: $USER_ID"
echo "  Timestamp: $TIMESTAMP"
echo "  Encrypt: $ENCRYPT"
echo "  Cleanup after: $CLEANUP"
echo ""

#######################################################################
# Step 1: Collect Files to Backup
#######################################################################

info "Collecting files to backup..."

BACKUP_DIR="/tmp/emailai-backup-${USER_ID}-${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"

# Copy training data
if [ -d "./training-data" ]; then
    cp -r ./training-data "$BACKUP_DIR/"
    success "Training data collected"
else
    warn "No training data found"
fi

# Copy fine-tuned models
if [ -d "./output" ]; then
    cp -r ./output "$BACKUP_DIR/"
    success "Model outputs collected"
else
    warn "No model outputs found"
fi

# Copy configs
if [ -d "./configs" ]; then
    cp -r ./configs "$BACKUP_DIR/"
    success "Configs collected"
fi

# Create manifest
cat > "$BACKUP_DIR/manifest.json" << EOF
{
  "user_id": "$USER_ID",
  "timestamp": "$TIMESTAMP",
  "backup_method": "$METHOD",
  "encrypted": $ENCRYPT,
  "contents": {
    "training_data": $([ -d "$BACKUP_DIR/training-data" ] && echo "true" || echo "false"),
    "models": $([ -d "$BACKUP_DIR/output" ] && echo "true" || echo "false"),
    "configs": $([ -d "$BACKUP_DIR/configs" ] && echo "true" || echo "false")
  }
}
EOF

#######################################################################
# Step 2: Encrypt (if enabled)
#######################################################################

if [ "$ENCRYPT" = true ]; then
    info "Encrypting backup..."

    # Generate encryption key (or use existing)
    if [ -z "$ENCRYPTION_KEY" ]; then
        warn "No ENCRYPTION_KEY environment variable set"
        warn "Generating random key (SAVE THIS!):"
        ENCRYPTION_KEY=$(openssl rand -base64 32)
        echo ""
        echo "🔑 ENCRYPTION KEY (SAVE THIS!):"
        echo "   $ENCRYPTION_KEY"
        echo ""
        warn "Without this key, you cannot decrypt the backup!"
        echo ""
        read -p "Press Enter to continue..."
    fi

    # Create encrypted archive
    ARCHIVE_FILE="${USER_ID}-backup-${TIMESTAMP}.tar.gz.enc"
    tar -czf - -C /tmp "$(basename $BACKUP_DIR)" | \
        openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"$ENCRYPTION_KEY" \
        > "/tmp/$ARCHIVE_FILE"

    success "Backup encrypted: $ARCHIVE_FILE"

    # Clean up unencrypted directory
    rm -rf "$BACKUP_DIR"

else
    info "Creating unencrypted archive..."
    ARCHIVE_FILE="${USER_ID}-backup-${TIMESTAMP}.tar.gz"
    tar -czf "/tmp/$ARCHIVE_FILE" -C /tmp "$(basename $BACKUP_DIR)"
    success "Backup archived: $ARCHIVE_FILE"
    rm -rf "$BACKUP_DIR"
fi

#######################################################################
# Step 3: Upload/Transfer Backup
#######################################################################

case $METHOD in
    s3)
        if [ -z "$S3_BUCKET" ]; then
            error "S3 bucket required: --bucket <bucket-name>"
        fi

        info "Uploading to S3: s3://$S3_BUCKET/"

        # Check if AWS CLI is installed
        if ! command -v aws &> /dev/null; then
            error "AWS CLI not installed. Install: apt-get install awscli"
        fi

        # Upload with server-side encryption
        aws s3 cp "/tmp/$ARCHIVE_FILE" "s3://$S3_BUCKET/emailai-backups/$ARCHIVE_FILE" \
            --storage-class STANDARD_IA \
            --server-side-encryption AES256 \
            --metadata "user-id=$USER_ID,timestamp=$TIMESTAMP"

        success "Uploaded to S3: s3://$S3_BUCKET/emailai-backups/$ARCHIVE_FILE"

        # Clean up local archive
        rm "/tmp/$ARCHIVE_FILE"
        ;;

    local)
        if [ -z "$LOCAL_DEST" ]; then
            error "Local destination required: --dest /path/to/backup"
        fi

        info "Copying to local: $LOCAL_DEST"

        mkdir -p "$LOCAL_DEST"
        cp "/tmp/$ARCHIVE_FILE" "$LOCAL_DEST/"

        success "Backup saved: $LOCAL_DEST/$ARCHIVE_FILE"

        # Clean up tmp archive
        rm "/tmp/$ARCHIVE_FILE"
        ;;

    scp)
        if [ -z "$SCP_DEST" ]; then
            error "SCP destination required: --scp-dest user@host:/path"
        fi

        info "Transferring via SCP: $SCP_DEST"

        scp "/tmp/$ARCHIVE_FILE" "$SCP_DEST/"

        success "Transferred to: $SCP_DEST"

        rm "/tmp/$ARCHIVE_FILE"
        ;;

    *)
        error "Unknown backup method: $METHOD"
        ;;
esac

#######################################################################
# Step 4: Clean Up Sensitive Data (if requested)
#######################################################################

if [ "$CLEANUP" = true ]; then
    warn "Cleaning up sensitive data from server..."

    # Remove training data (contains user emails)
    if [ -d "./training-data" ]; then
        rm -rf ./training-data
        success "Removed training data"
    fi

    # Keep models but remove training logs (may contain data)
    if [ -d "./output" ]; then
        find ./output -name "*.log" -delete
        find ./output -type d -name "runs" -exec rm -rf {} + 2>/dev/null || true
        success "Cleaned up training logs"
    fi

    warn "⚠️  Sensitive data removed from Vast.ai server"
    warn "⚠️  Backup contains all data - keep it secure!"
fi

#######################################################################
# Step 5: Display Instructions
#######################################################################

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success "Backup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$ENCRYPT" = true ]; then
    warn "🔐 IMPORTANT: Backup is encrypted!"
    echo "   To decrypt:"
    echo "   openssl enc -aes-256-cbc -d -pbkdf2 -in $ARCHIVE_FILE -out backup.tar.gz"
    echo ""
    warn "   You MUST save the encryption key shown earlier!"
fi

info "To restore this backup on a new Vast.ai instance:"
echo "  1. Rent new Vast.ai GPU instance"
echo "  2. Clone EmailAI repo"
echo "  3. Download backup (from S3 or local)"
echo "  4. Extract: tar -xzf $ARCHIVE_FILE"
echo "  5. Move files to ollama-server/fine-tuning/"
echo "  6. Continue training or deploy model"
echo ""

warn "Security Reminders:"
echo "  ✓ Training data contains user emails (SENSITIVE)"
echo "  ✓ Store backups in secure, encrypted location"
echo "  ✓ Use S3 with server-side encryption"
echo "  ✓ Enable S3 bucket encryption and versioning"
echo "  ✓ Delete backups when no longer needed"
echo "  ✓ Never commit backups to git"
echo ""

if [ "$CLEANUP" = true ]; then
    warn "Next steps (data cleaned from server):"
    echo "  ✓ You can safely destroy this Vast.ai instance"
    echo "  ✓ Restore from backup when needed"
else
    warn "Sensitive data still on server!"
    echo "  Run with --cleanup to remove after backup"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
