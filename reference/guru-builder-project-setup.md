# Guru Builder Project Setup
## Complete Configuration Files for Fresh Installation

This document contains all configuration files needed to bootstrap the Guru Builder system in a fresh directory.

---

## Table of Contents

1. [Package Dependencies](#package-dependencies)
2. [TypeScript Configuration](#typescript-configuration)
3. [Next.js Configuration](#nextjs-configuration)
4. [Tailwind CSS Configuration](#tailwind-css-configuration)
5. [PostCSS Configuration](#postcss-configuration)
6. [Database Schema (Base)](#database-schema-base)
7. [Environment Variables](#environment-variables)
8. [Root Layout & Global Styles](#root-layout--global-styles)
9. [Installation Commands](#installation-commands)

---

## Package Dependencies

### package.json

```json
{
  "name": "guru-builder",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^2.0.42",
    "@ai-sdk/openai": "^2.0.64",
    "@ai-sdk/react": "^2.0.89",
    "@prisma/client": "^5.22.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.1",
    "@radix-ui/react-tabs": "^1.1.13",
    "ai": "^5.0.89",
    "autoprefixer": "^10.4.21",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "inngest": "^3.30.0",
    "lucide-react": "^0.462.0",
    "next": "15.2.4",
    "react": "19.1.1",
    "react-diff-viewer": "^3.1.1",
    "react-dom": "19.1.1",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/node": "^20.17.6",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "postcss": "^8.4.49",
    "prisma": "^5.22.0",
    "tailwindcss": "^3.4.15",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

**New Dependencies Added** (beyond backgammon-guru):
- `inngest` - Serverless background job processing
- `react-diff-viewer` - Before/after diff UI component

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "target": "ES2017"
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

**Key Settings**:
- `paths: { "@/*": ["./*"] }` - Allows `@/` imports from root
- `strict: true` - Enforces strict type checking
- `moduleResolution: "bundler"` - Modern module resolution

---

## Next.js Configuration

### next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

**Note**: The default config is sufficient. Add options as needed (e.g., environment variables, image domains, experimental features).

---

## Tailwind CSS Configuration

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

**Key Features**:
- Uses CSS variables for theming (defined in `app/globals.css`)
- Supports dark mode with `class` strategy
- Includes shadcn/ui color system
- Includes `tailwindcss-animate` plugin

---

## PostCSS Configuration

### postcss.config.mjs

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

**Purpose**: Processes Tailwind CSS and adds vendor prefixes

---

## Database Schema (Base)

### prisma/schema.prisma

**Base Schema** (before Guru Builder extensions):

```prisma
// This is your Prisma schema file

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Project {
  id              String   @id @default(cuid())
  name            String
  description     String?
  contextLayers   ContextLayer[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model ContextLayer {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  // Layer metadata
  name        String              // Display name (e.g., "Backgammon Fundamentals")
  description String?             // Optional description for UI tooltips
  priority    Int                 // Lower = higher priority (1 = first, 2 = second, etc.)

  // Layer content
  content     String   @db.Text   // The actual context (markdown/text)

  // Layer behavior
  isActive    Boolean  @default(true)   // Toggle visibility without deletion
  isBuiltIn   Boolean  @default(false)  // Prevent deletion (allow editing)

  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([projectId, priority])
  @@index([projectId])
  @@index([projectId, isActive])
}
```

**To extend for Guru Builder**: Add the new models from `specs/feat-guru-builder-system-mvp.md` (KnowledgeFile, ResearchRun, Recommendation, CorpusSnapshot) to this base schema.

---

## Environment Variables

### .env.example

```bash
# OpenAI API (required for chat and research)
# Get your API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-your-key-here

# Anthropic API (optional - for extended thinking in drill mode)
# Get your API key from: https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# PostgreSQL Database (required)
# Local: postgresql://user:password@localhost:5432/dbname
# Railway: postgresql://postgres:password@host.railway.app:5432/railway
# Neon: postgresql://user:password@host.neon.tech:5432/neondb
DATABASE_URL=postgresql://user:password@localhost:5432/guru_builder

# Inngest Configuration (required for background jobs)
# Get signing key and event key from: https://www.inngest.com/docs/deploy
# Free tier: https://app.inngest.com/
INNGEST_SIGNING_KEY=signkey-prod-your-key-here
INNGEST_EVENT_KEY=inngest-your-event-key-here

# Optional: Inngest Dev Server URL (for local development)
# INNGEST_DEV_URL=http://localhost:8288
```

**Setup Instructions**:
1. Copy `.env.example` to `.env`
2. Replace placeholder values with real credentials
3. Never commit `.env` to version control (add to `.gitignore`)

---

## Root Layout & Global Styles

### app/layout.tsx

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Guru Builder',
  description: 'Build AI teaching assistants through autonomous research and structured recommendations',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

**Features**:
- Uses Inter font from Google Fonts
- Sets up metadata for SEO
- Applies global font to body

---

### app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Features**:
- Tailwind directives for base, components, utilities
- CSS variables for light and dark themes
- HSL color format for easy manipulation
- Base styles for all elements and body

---

## Installation Commands

### Step-by-Step Setup

```bash
# 1. Create new Next.js project (or clone repository)
npx create-next-app@latest guru-builder
cd guru-builder

# 2. Install dependencies
npm install

# 3. Install additional Guru Builder dependencies
npm install inngest react-diff-viewer

# 4. Install shadcn/ui components (install as needed)
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Install specific components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add label
npx shadcn-ui@latest add switch
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add tabs

# 5. Set up Prisma
npx prisma init

# 6. Update prisma/schema.prisma with the base schema above

# 7. Set up environment variables
cp .env.example .env
# Edit .env with your actual credentials

# 8. Run database migrations
npx prisma migrate dev --name init

# 9. (Optional) Seed database
npx prisma db seed

# 10. Start development server
npm run dev
```

---

## shadcn/ui Configuration

shadcn/ui uses a configuration file to manage component installation. When you run `npx shadcn-ui@latest init`, it will create a `components.json` file with the following default configuration:

### components.json (Auto-generated)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Note**: This file is auto-generated when you run `npx shadcn-ui@latest init`. You typically don't need to create it manually.

---

## Database Migration Workflow

After setting up the base schema and before implementing Guru Builder extensions:

```bash
# 1. Create initial migration (base schema)
npx prisma migrate dev --name init

# 2. Extend schema with Guru Builder models
# (Add KnowledgeFile, ResearchRun, Recommendation, CorpusSnapshot to schema.prisma)

# 3. Create migration for extensions
npx prisma migrate dev --name add_guru_builder_models

# 4. Generate Prisma client
npx prisma generate

# 5. (Optional) Open Prisma Studio to inspect database
npx prisma studio
```

---

## Python Environment Setup (for GPT Researcher)

The Guru Builder system requires Python for GPT Researcher integration.

### Python Dependencies

```bash
# Install Python dependencies (requirements.txt)
pip install gpt-researcher langchain openai python-dotenv
```

See `guru-builder-python-integration.md` for complete Python setup instructions.

---

## Deployment Checklist

Before deploying to production:

- [ ] All environment variables set in hosting platform (Vercel, Railway, etc.)
- [ ] Database connection string configured
- [ ] Prisma migrations run on production database
- [ ] Inngest functions deployed and configured
- [ ] Python runtime configured (if using Vercel, add `python` to build command)
- [ ] API keys rotated from development to production keys
- [ ] CORS settings configured if needed
- [ ] Rate limiting configured

---

## Directory Structure

After setup, your project structure should look like:

```
guru-builder/
├── app/
│   ├── api/
│   │   ├── chat/route.ts
│   │   ├── inngest/route.ts
│   │   ├── project/[id]/
│   │   │   ├── context-layers/route.ts
│   │   │   ├── knowledge-files/route.ts
│   │   │   └── research-runs/route.ts
│   │   └── projects/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── layers/               # Layer management components
│   ├── projects/             # Project management components
│   ├── corpus/               # Corpus view components
│   ├── research/             # Research run components
│   └── recommendations/      # Recommendation review components
├── lib/
│   ├── db.ts
│   ├── utils.ts
│   ├── types.ts
│   ├── validation.ts
│   ├── contextComposer.ts
│   ├── researchOrchestrator.ts
│   ├── recommendationGenerator.ts
│   ├── recommendationApplier.ts
│   └── snapshotManager.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── python/
│   ├── research_agent.py
│   └── requirements.txt
├── public/
├── .env.example
├── .env (gitignored)
├── .gitignore
├── components.json
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## Troubleshooting

### Common Issues

**1. Prisma Client Generation Fails**
```bash
# Solution: Regenerate Prisma client
npx prisma generate
```

**2. Database Connection Errors**
```bash
# Solution: Check DATABASE_URL in .env
# Test connection
npx prisma db pull
```

**3. shadcn/ui Components Not Found**
```bash
# Solution: Ensure components.json exists
npx shadcn-ui@latest init

# Re-install missing component
npx shadcn-ui@latest add [component-name]
```

**4. Tailwind CSS Not Working**
```bash
# Solution: Ensure Tailwind directives in globals.css
# Restart dev server
npm run dev
```

**5. TypeScript Path Alias Errors**
```bash
# Solution: Check tsconfig.json paths configuration
# Restart TypeScript server in VS Code (Cmd+Shift+P → "TypeScript: Restart TS Server")
```

---

**End of Project Setup Reference**
**Last Updated**: 2025-01-08
