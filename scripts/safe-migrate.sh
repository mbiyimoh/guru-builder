#!/bin/bash
# Safe migration wrapper with automatic backup

set -e

# Get migration name from argument
MIGRATION_NAME=$1

if [ -z "$MIGRATION_NAME" ]; then
  echo "Usage: npm run migrate:safe -- migration-name"
  exit 1
fi

echo "🚀 Safe Migration Process"
echo "========================"
echo ""

# Step 1: Create backup
echo "Step 1/3: Creating backup..."
./scripts/backup-database.sh

echo ""
echo "Step 2/3: Running migration..."
npx prisma migrate dev --name "$MIGRATION_NAME"

echo ""
echo "Step 3/3: Regenerating Prisma client..."
npx prisma generate

echo ""
echo "✅ Migration complete!"
echo ""
echo "⚠️  If something went wrong, restore with:"
LATEST_BACKUP=$(ls -t backups/*.sql 2>/dev/null | head -1 | sed 's|backups/||')
if [ -n "$LATEST_BACKUP" ]; then
  echo "   npm run db:restore -- $LATEST_BACKUP"
fi
