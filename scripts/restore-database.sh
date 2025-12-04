#!/bin/bash
# Restore database from backup

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Catch errors in pipes

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: npm run db:restore -- backup_YYYYMMDD_HHMMSS.sql"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

# Load DATABASE_URL from .env securely
if [ -f .env ]; then
  # Secure approach: Direct assignment to avoid shell injection
  DATABASE_URL=$(grep "^DATABASE_URL=" .env | cut -d= -f2- | sed 's/^["'\'']//' | sed 's/["'\'']$//')
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL not found in .env"
  exit 1
fi

BACKUP_PATH="backups/$BACKUP_FILE"

if [ ! -f "$BACKUP_PATH" ]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_PATH"
  exit 1
fi

# Find PostgreSQL binaries - prefer PostgreSQL 17 if available, fallback to system binaries
if [ -f "/usr/local/opt/postgresql@17/bin/psql" ]; then
  PSQL="/usr/local/opt/postgresql@17/bin/psql"
elif command -v psql >/dev/null 2>&1; then
  PSQL="$(command -v psql)"
else
  echo "❌ ERROR: psql not found. Install PostgreSQL client tools:"
  echo "   brew install postgresql@17"
  exit 1
fi

if [ -f "/usr/local/opt/postgresql@17/bin/pg_dump" ]; then
  PG_DUMP="/usr/local/opt/postgresql@17/bin/pg_dump"
elif command -v pg_dump >/dev/null 2>&1; then
  PG_DUMP="$(command -v pg_dump)"
else
  echo "❌ ERROR: pg_dump not found. Install PostgreSQL client tools:"
  echo "   brew install postgresql@17"
  exit 1
fi

echo "⚠️  WARNING: This will REPLACE the current database with the backup"
echo "   Backup: $BACKUP_PATH"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled"
  exit 0
fi

# Create pre-restore safety backup
PRERESTORE_BACKUP="backups/pre-restore_$(date +%Y%m%d_%H%M%S).sql"
echo ""
echo "📦 Creating safety backup before restore..."
echo "   File: $PRERESTORE_BACKUP"

if "$PG_DUMP" --clean --if-exists "$DATABASE_URL" > "$PRERESTORE_BACKUP" 2>/dev/null; then
  SAFETY_SIZE=$(wc -c < "$PRERESTORE_BACKUP" | tr -d ' ')
  echo "✅ Safety backup created: $PRERESTORE_BACKUP ($SAFETY_SIZE bytes)"
else
  echo "⚠️  WARNING: Could not create safety backup"
  echo ""
  read -p "Continue restore anyway? (yes/no): " FORCE_CONFIRM
  if [ "$FORCE_CONFIRM" != "yes" ]; then
    echo "Cancelled for safety"
    rm -f "$PRERESTORE_BACKUP"  # Clean up failed backup
    exit 0
  fi
fi

echo ""
echo "📥 Restoring database from backup..."

if ! "$PSQL" "$DATABASE_URL" < "$BACKUP_PATH" 2>&1; then
  echo ""
  echo "❌ ERROR: Restore failed"
  echo "   Your database may be in an inconsistent state"
  if [ -f "$PRERESTORE_BACKUP" ]; then
    echo "   You can restore the pre-restore backup:"
    echo "   npm run db:restore -- $(basename "$PRERESTORE_BACKUP")"
  fi
  exit 1
fi

echo ""
echo "✅ Database restored successfully"
if [ -f "$PRERESTORE_BACKUP" ]; then
  echo "   Pre-restore backup saved: $PRERESTORE_BACKUP"
fi
