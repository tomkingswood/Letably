#!/bin/bash

##############################################################################
# Letably - Data Backup Script
#
# This script creates a backup of production DATA ONLY:
# - Database file (database.db)
# - Uploads directory (images, certificates, etc.)
# - Secure documents (encrypted ID documents)
#
# Code is NOT backed up (it's in Git - just pull latest)
#
# Usage:
#   ./backup-production.sh [destination_directory]
#
# Example:
#   ./backup-production.sh
#   ./backup-production.sh /mnt/backup-drive
#
# Default: /var/www/letably/backups
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="letably-backup-${TIMESTAMP}"
DEFAULT_BACKUP_DIR="/var/www/letably/backups"
BACKUP_DIR="${1:-$DEFAULT_BACKUP_DIR}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Source paths
APP_ROOT="/var/www/letably"
DATABASE_FILE="${APP_ROOT}/backend/database.db"
UPLOADS_DIR="${APP_ROOT}/backend/uploads"
SECURE_DOCS_DIR="${APP_ROOT}/secure-documents"

# Print with color
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "Starting Letably DATA backup..."
print_info "Backup destination: ${BACKUP_PATH}"

# Create backup directory
mkdir -p "${BACKUP_PATH}"

# Backup Database
print_info "Backing up database..."
if [ -f "$DATABASE_FILE" ]; then
    cp "$DATABASE_FILE" "${BACKUP_PATH}/database.db"
    DB_SIZE=$(du -sh "$DATABASE_FILE" | cut -f1)
    print_info "✓ Database backed up (${DB_SIZE})"
else
    print_error "Database file not found: $DATABASE_FILE"
    exit 1
fi

# Backup Uploads directory
print_info "Backing up uploads (images, certificates, etc.)..."
if [ -d "$UPLOADS_DIR" ]; then
    mkdir -p "${BACKUP_PATH}/uploads"
    cp -r "$UPLOADS_DIR/"* "${BACKUP_PATH}/uploads/" 2>/dev/null || true
    UPLOAD_COUNT=$(find "$UPLOADS_DIR" -type f | wc -l)
    UPLOAD_SIZE=$(du -sh "$UPLOADS_DIR" | cut -f1)
    print_info "✓ Uploads backed up (${UPLOAD_COUNT} files, ${UPLOAD_SIZE})"
else
    print_warning "Uploads directory not found: $UPLOADS_DIR (creating empty directory)"
    mkdir -p "${BACKUP_PATH}/uploads"
fi

# Backup Secure Documents
print_info "Backing up secure documents..."
if [ -d "$SECURE_DOCS_DIR" ]; then
    mkdir -p "${BACKUP_PATH}/secure-documents"
    cp -r "$SECURE_DOCS_DIR/"* "${BACKUP_PATH}/secure-documents/" 2>/dev/null || true
    DOCS_COUNT=$(find "$SECURE_DOCS_DIR" -type f | wc -l)
    DOCS_SIZE=$(du -sh "$SECURE_DOCS_DIR" | cut -f1)
    print_info "✓ Secure documents backed up (${DOCS_COUNT} files, ${DOCS_SIZE})"
else
    print_warning "Secure documents directory not found: $SECURE_DOCS_DIR (creating empty directory)"
    mkdir -p "${BACKUP_PATH}/secure-documents"
fi

# Create a backup manifest (optional)
print_info "Creating backup manifest..."
TOTAL_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
cat > "${BACKUP_PATH}/BACKUP_INFO.txt" << EOF
Letably - Data Backup
================================

Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Server: $(hostname)

Contents:
✓ Database: ${DB_SIZE}
✓ Uploads: ${UPLOAD_COUNT} files (${UPLOAD_SIZE})
✓ Secure Documents: ${DOCS_COUNT} files (${DOCS_SIZE})

Total Size: ${TOTAL_SIZE}
EOF

# Compress the backup
print_info "Compressing backup..."
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
COMPRESSED_SIZE=$(du -sh "${BACKUP_NAME}.tar.gz" | cut -f1)
print_info "✓ Backup compressed: ${BACKUP_NAME}.tar.gz (${COMPRESSED_SIZE})"

# Clean up uncompressed backup
rm -rf "${BACKUP_PATH}"

# Summary
print_info ""
print_info "========================================="
print_info "Backup completed successfully!"
print_info "========================================="
print_info "File: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
print_info "Size: ${COMPRESSED_SIZE}"
print_info ""
print_info "Download: scp ubuntu@\$(hostname):${BACKUP_DIR}/${BACKUP_NAME}.tar.gz ."
print_info "========================================="

# List recent backups
print_info ""
print_info "Recent backups in ${BACKUP_DIR}:"
ls -lht "${BACKUP_DIR}"/letably-backup-*.tar.gz 2>/dev/null | head -5 || print_info "No previous backups found"
