#!/bin/bash
# Automated database backup before schema changes

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Catch errors in pipes

# Load DATABASE_URL from .env securely
if [ -f .env ]; then
  # Secure approach: Direct assignment to avoid shell injection
  DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | sed 's/^["'\'']//' | sed 's/["'\'']$//')
  export DATABASE_URL
fi

# Verify DATABASE_URL exists
if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL not found in .env"
  exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup filename
BACKUP_FILE="backups/backup_${TIMESTAMP}.sql"

echo "📦 Creating database backup..."
echo "   File: $BACKUP_FILE"

# Find pg_dump - prefer PostgreSQL 17 if available, fallback to system pg_dump
if [ -f "/usr/local/opt/postgresql@17/bin/pg_dump" ]; then
  PG_DUMP="/usr/local/opt/postgresql@17/bin/pg_dump"
elif command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP="$(command -v pg_dump)"
else
  echo "❌ ERROR: pg_dump not found. Install PostgreSQL client tools:"
  echo "   brew install postgresql@17"
  exit 1
fi

# Run pg_dump with --clean and --if-exists for cleaner restores
# --clean: Add DROP statements before CREATE
# --if-exists: Use IF EXISTS with DROP statements to avoid errors
if ! "$PG_DUMP" --clean --if-exists "$DATABASE_URL" > "$BACKUP_FILE" 2>&1; then
  echo "❌ ERROR: pg_dump failed. Check:"
  echo "   1. DATABASE_URL is correct"
  echo "   2. Database is accessible"
  echo "   3. pg_dump version matches server version"
  rm -f "$BACKUP_FILE"  # Clean up partial backup
  exit 1
fi

# Verify backup was created and is valid
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')

  # Check minimum size (schemas should be >1KB even for empty database)
  if [ "$BACKUP_SIZE" -lt 1024 ]; then
    echo "❌ ERROR: Backup file suspiciously small ($BACKUP_SIZE bytes)"
    echo "   This may indicate an incomplete backup"
    rm -f "$BACKUP_FILE"
    exit 1
  fi

  # Verify SQL syntax (basic check)
  if ! grep -q "PostgreSQL database dump" "$BACKUP_FILE"; then
    echo "❌ ERROR: Backup file doesn't appear to be a valid pg_dump output"
    rm -f "$BACKUP_FILE"
    exit 1
  fi

  # Verify schema structures exist
  if ! grep -q "CREATE TABLE\|CREATE TYPE" "$BACKUP_FILE"; then
    echo "⚠️  WARNING: No tables or types found in backup"
    echo "   Database may be empty, but backup is valid"
  fi

  echo "✅ Backup created successfully ($BACKUP_SIZE bytes)"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ ERROR: Backup file was not created"
  exit 1
fi
