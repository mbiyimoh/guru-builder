# Database Backup and Data Loss Prevention System

**Status**: Draft
**Author**: Claude Code
**Date**: 2025-11-13

---

## Overview

Automated backup system and safety guards to prevent accidental data loss during Prisma schema migrations. Creates timestamped database backups before any schema changes and blocks destructive operations without explicit user approval.

## Problem Statement

**Incident**: On 2025-11-13, developer used `npx prisma db push --force-reset` during schema migration, permanently deleting all database data including user projects ("backgammon guru 2", "chess guru"), context layers, knowledge files, and research runs.

**Root Cause**:
- No mandatory backup process before schema changes
- Destructive Prisma commands (`--force-reset`, `migrate reset`) allowed without safeguards
- Developer prioritized speed (`db push --force-reset`) over safety (proper migrations with backups)

**Impact**:
- Complete data loss with no recovery option
- No backups existed
- User trust damaged

**Why This Matters**:
- Users store valuable intellectual property in context layers and knowledge files
- Research runs take 5-10 minutes to complete
- Data loss is unacceptable in production systems

## Goals

1. **Automatic Backups**: Create timestamped backups before any schema modification
2. **Destructive Operation Prevention**: Block dangerous Prisma commands without explicit user approval
3. **Safe Migration Workflow**: Enforce proper `migrate dev` instead of `db push --force-reset`
4. **Developer Guidance**: Update documentation (already complete in CLAUDE.md)

## Non-Goals

- Backup rotation/cleanup (Future Improvement)
- Backup compression (Future Improvement)
- Remote backup storage (Future Improvement)
- Automated restore functionality (Future Improvement)
- Backup integrity verification (Future Improvement)
- Support for databases other than PostgreSQL (Future Improvement)
- UI for backup management (Future Improvement)
- Scheduled/periodic backups (Future Improvement)

## Technical Approach

### Architecture

Simple shell script-based solution:
1. **Backup Script**: npm script that runs `pg_dump` with timestamped filename
2. **Pre-Migration Hook**: Automatically backup before migrations
3. **Destructive Command Guard**: Validation script that checks for dangerous flags

### Key Files/Modules

**New Files**:
- `scripts/backup-database.sh` - Shell script to create timestamped backups
- `backups/` - Directory for storing backup .sql files (git-ignored)
- `.gitignore` - Add `backups/` directory

**Modified Files**:
- `package.json` - Add backup-related npm scripts
- `.claude/CLAUDE.md` - Already updated with safety protocols

### External Dependencies

- **pg_dump** (already available at `/usr/local/bin/pg_dump`)
- **bash** (standard on macOS/Linux)
- No new npm packages required

### Integration Points

- **Prisma CLI**: Wraps `prisma migrate dev` with pre-backup hook
- **Environment Variables**: Uses `DATABASE_URL` from `.env`
- **File System**: Creates `backups/` directory structure

## Implementation Details

### 1. Backup Script (`scripts/backup-database.sh`)

```bash
#!/bin/bash
# Automated database backup before schema changes

set -e  # Exit on error

# Load DATABASE_URL from .env
if [ -f .env ]; then
  export $(cat .env | grep DATABASE_URL | xargs)
fi

# Verify DATABASE_URL exists
if [ -z "$DATABASE_URL" ]; then
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

# Run pg_dump
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(wc -c < "$BACKUP_FILE" | tr -d ' ')
  echo "✅ Backup created successfully ($BACKUP_SIZE bytes)"
  echo "   Location: $BACKUP_FILE"
else
  echo "❌ ERROR: Backup failed"
  exit 1
fi
```

### 2. Safe Migration Script (`scripts/safe-migrate.sh`)

```bash
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
echo "   npm run db:restore -- $(ls -t backups/*.sql | head -1 | sed 's/backups\///')"
```

### 3. Destructive Command Guard

**Implementation Note**: This is enforced through documentation only (CLAUDE.md already updated).

Prisma doesn't support custom hooks, so we rely on:
1. **Documentation**: CLAUDE.md explicitly forbids `--force-reset` without approval
2. **Developer Training**: AI assistant must read and follow CLAUDE.md protocols
3. **Code Review**: Human reviewers catch misuse

**Future Improvement**: Could add git pre-commit hook to block dangerous commands.

### 4. package.json Scripts

```json
{
  "scripts": {
    "db:backup": "bash scripts/backup-database.sh",
    "migrate:safe": "bash scripts/safe-migrate.sh",
    "db:restore": "bash scripts/restore-database.sh"
  }
}
```

### 5. Restore Script (`scripts/restore-database.sh`)

```bash
#!/bin/bash
# Restore database from backup

set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: npm run db:restore -- backup_YYYYMMDD_HHMMSS.sql"
  echo ""
  echo "Available backups:"
  ls -lh backups/*.sql 2>/dev/null || echo "  (no backups found)"
  exit 1
fi

# Load DATABASE_URL
if [ -f .env ]; then
  export $(cat .env | grep DATABASE_URL | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not found in .env"
  exit 1
fi

BACKUP_PATH="backups/$BACKUP_FILE"

if [ ! -f "$BACKUP_PATH" ]; then
  echo "❌ ERROR: Backup file not found: $BACKUP_PATH"
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

echo "📥 Restoring database from backup..."
psql "$DATABASE_URL" < "$BACKUP_PATH"

echo "✅ Database restored successfully"
```

### 6. .gitignore Entry

```
# Database backups (local only)
backups/
```

## Testing Approach

### Manual Testing Scenarios

1. **Backup Creation Test**
   ```bash
   npm run db:backup
   # Verify: backups/backup_YYYYMMDD_HHMMSS.sql exists
   # Verify: File size > 0
   # Verify: Console shows success message
   ```

2. **Safe Migration Test**
   ```bash
   npm run migrate:safe -- test-migration
   # Verify: Backup created before migration
   # Verify: Migration applied successfully
   # Verify: Prisma client regenerated
   ```

3. **Restore Test**
   ```bash
   npm run db:restore -- backup_YYYYMMDD_HHMMSS.sql
   # Verify: Prompts for confirmation
   # Verify: Database restored from backup
   # Verify: Data matches backup state
   ```

4. **Error Handling Test**
   ```bash
   # Test missing DATABASE_URL
   unset DATABASE_URL && npm run db:backup
   # Verify: Error message displayed

   # Test invalid backup file
   npm run db:restore -- nonexistent.sql
   # Verify: Error message displayed
   ```

### Validation Criteria

- ✅ Backup script creates timestamped .sql files
- ✅ Backup files contain valid SQL
- ✅ Safe migration creates backup before applying changes
- ✅ Restore script successfully recovers data
- ✅ Error messages are clear and actionable
- ✅ Scripts exit with proper error codes

## Migration/Rollout

### Initial Setup

1. Create `scripts/` directory
2. Add three bash scripts (backup, safe-migrate, restore)
3. Update `package.json` with new scripts
4. Add `backups/` to `.gitignore`
5. Create `backups/.gitkeep` (tracked, but backups/ contents ignored)
6. Test backup/restore workflow

### Developer Onboarding

- **CLAUDE.md** already updated with database safety protocols
- All AI-assisted development must follow these protocols
- Human developers should review the protocols

### No Breaking Changes

- Existing workflows continue to work
- New `migrate:safe` script is opt-in initially
- Can enforce later through code review process

## Open Questions

None - scope is well-defined and technically straightforward.

## Future Improvements and Enhancements

**⚠️ EVERYTHING BELOW IS OUT OF SCOPE FOR INITIAL IMPLEMENTATION**

### Backup Management
- **Automatic Rotation**: Delete backups older than N days
- **Backup Compression**: Use gzip to reduce storage (`.sql.gz`)
- **Backup Size Limits**: Warn if backup exceeds threshold
- **Backup Verification**: Check backup integrity after creation

### Advanced Restore
- **Interactive Restore**: Show backup contents before restoring
- **Partial Restore**: Restore specific tables only
- **Point-in-Time Recovery**: Restore to specific timestamp

### Remote Storage
- **S3 Integration**: Upload backups to AWS S3
- **Cloud Database Backups**: Use provider-specific backup tools
- **Backup Encryption**: Encrypt backups at rest

### Git Hooks
- **Pre-commit Hook**: Block commits with dangerous Prisma commands
- **Pre-push Hook**: Verify migrations are safe before pushing
- **Commit Message Validation**: Require migration notes

### UI/Tooling
- **Backup Browser**: Web UI to view and restore backups
- **Backup Status Dashboard**: Show backup age, size, health
- **One-Click Restore**: Restore from UI instead of CLI

### Monitoring
- **Backup Alerts**: Notify if backup hasn't run in N days
- **Slack Integration**: Send backup notifications to team channel
- **Backup Metrics**: Track backup frequency, size, duration

### Testing
- **Automated Backup Tests**: CI pipeline verifies backup/restore
- **Chaos Testing**: Randomly delete data and verify restore
- **Performance Testing**: Measure backup/restore speed at scale

### Multi-Database Support
- **MySQL Support**: Add mysql-dump scripts
- **SQLite Support**: Add SQLite-specific backup
- **MongoDB Support**: Add mongodump scripts

### Scheduled Backups
- **Cron Integration**: Daily automated backups
- **Pre-Deployment Backups**: Automatic backup before deployments
- **Continuous Backups**: Real-time replication to standby database

## References

- **Incident Report**: Data loss on 2025-11-13 from `db push --force-reset`
- **Updated Documentation**: `.claude/CLAUDE.md` Database Safety Protocol section
- **Prisma Migrations**: https://www.prisma.io/docs/concepts/components/prisma-migrate
- **PostgreSQL pg_dump**: https://www.postgresql.org/docs/current/app-pgdump.html
- **Related Spec**: `feat-recommendation-content-fields-lean.md` (migration that caused data loss)

---

## Lean Spec Self-Audit

✅ **Scope Discipline**: Implements exactly what was requested (backup, validation, prevention)
✅ **Essential Testing**: Manual tests cover critical paths only
✅ **Natural Extensions**: Restore script is natural complement to backup
✅ **Future Improvements**: 15+ items moved to Future Improvements section
✅ **No Over-Engineering**: Simple bash scripts, no complex frameworks
✅ **Implementable**: Clear, actionable implementation details

**Deferred to Future Improvements**:
- Backup rotation/cleanup
- Compression and encryption
- Remote storage
- Git hooks for enforcement
- UI/dashboard
- Monitoring and alerts
- Multi-database support
- Scheduled/automated backups

**Implementation Estimate**: 2-3 hours for initial implementation and testing.
