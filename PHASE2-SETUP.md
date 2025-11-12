# Phase 2 Setup Instructions

## Database Setup Required

Before running migrations, you need to set up your database:

### Option 1: Local PostgreSQL

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install postgresql@16
   brew services start postgresql@16

   # Or use Postgres.app: https://postgresapp.com/
   ```

2. **Create Database**:
   ```bash
   createdb guru_builder
   ```

3. **Add to .env**:
   ```bash
   DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/guru_builder"
   # Replace YOUR_USERNAME with your Mac username
   ```

### Option 2: Railway (Free Tier)

1. **Sign up at** https://railway.app
2. **Create New Project** → **Provision PostgreSQL**
3. **Copy Connection String** from Railway dashboard
4. **Add to .env**:
   ```bash
   DATABASE_URL="postgresql://postgres:PASSWORD@HOST.railway.app:5432/railway"
   ```

### Option 3: Neon (Serverless PostgreSQL)

1. **Sign up at** https://neon.tech
2. **Create New Project**
3. **Copy Connection String**
4. **Add to .env**:
   ```bash
   DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
   ```

## Running Migrations

Once DATABASE_URL is configured:

```bash
# Create initial migration
npx prisma migrate dev --name init

# This will:
# 1. Create the database schema
# 2. Generate Prisma Client
# 3. Create migrations/ directory
```

## Verify Setup

```bash
# Check database connection
npx prisma db pull

# Open Prisma Studio to view database
npx prisma studio
```

## What Gets Created

The migration creates these tables:
- `Project` - User projects
- `ContextLayer` - Always-loaded knowledge layers
- `KnowledgeFile` - Conditionally-loaded knowledge files
- `ResearchRun` - Research task tracking
- `Recommendation` - AI-generated recommendations
- `CorpusSnapshot` - Version control snapshots
- `ApplyChangesLog` - Change history

## Next Steps

After successful migration:
1. Build Project CRUD APIs
2. Build KnowledgeFile CRUD APIs
3. Build ResearchRun APIs
4. Build Recommendation APIs
5. Test all endpoints

---

**Current Status**: Database schema ready, waiting for DATABASE_URL configuration
