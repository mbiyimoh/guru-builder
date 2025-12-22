# Simplified Frontend Wrapper for Guru Builder

**Status:** Draft
**Author:** Claude Code
**Date:** 2025-12-18
**Related:**
- Ideation: `specs/simplified-frontend-wrapper/01-ideation.md`
- Prototype: `new-simpler-UI-layer/guru-builder-v4.jsx`
- Implementation Mapping: `new-simpler-UI-layer/guru-builder-implementation-mapping.md`
- Guru Profile Spec: `specs/completed/guru-profile-onboarding/02-specification.md`

---

## Overview

This specification defines a simplified frontend wrapper for the Guru Builder system, designed to guide non-technical domain experts through creating AI teaching assistants. The wrapper introduces a 4-phase wizard flow with nested routes, multiple profile input modes, a universal Pedagogical Dimensions system for any teaching domain, and streamlined artifact creation with guru testing capabilities.

**Target User:** Domain experts (e.g., backgammon masters, chess instructors, cooking teachers) with minimal technical knowledge who want to create personalized AI teaching assistants.

---

## Background/Problem Statement

### Current State

The existing Guru Builder interface is powerful but technically oriented:
- Project creation requires understanding of "context layers" vs "knowledge files"
- Research workflow requires manually crafting research prompts
- No guidance on what knowledge is needed for a complete teaching corpus
- Artifact generation UI exposes technical details (prompt hashes, verification status)
- No way to test or preview the guru before using it
- No sharing or publishing capabilities

### Problems Addressed

1. **Cognitive Overload:** Technical terminology and complex UI overwhelms non-technical users
2. **Lack of Guidance:** Users don't know what information their guru needs
3. **No Feedback Loop:** Can't test guru personality before creating artifacts
4. **Isolation:** No way to share or publish created gurus

### Why Now

- Core infrastructure is stable and proven
- Teaching artifact generation works well but lacks discoverability
- User feedback indicates desire for simpler, guided experience
- Prototype validates the UX direction (guru-builder-v4.jsx)

---

## Goals

- Provide intuitive 4-phase wizard flow for guru creation
- Support multiple input modes (chat, voice, document import)
- Introduce domain-agnostic Pedagogical Dimensions for knowledge organization
- Guide users toward corpus completeness with gap detection
- Enable guru testing before publishing
- Deliver shareable public URLs for created gurus
- Maintain full backward compatibility with existing projects

---

## Non-Goals (Out of Scope)

- Mobile native app development (PWA is in-scope)
- Real-time collaborative editing between users
- Multi-language/internationalization support
- Embed widgets (Phase 2)
- Progressive Web App export (Phase 2)
- Assessment/quiz delivery system redesign
- Monetization or billing features
- Custom guru avatars or persona visualization

---

## Technical Dependencies

### External Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `pdf-parse` | ^1.1.1 | Server-side PDF text extraction |
| `mammoth` | ^1.6.0 | Server-side DOCX text extraction |
| `nanoid` | ^5.0.0 | Short ID generation for public URLs |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `lib/guruProfile/types.ts` | GuruProfileData schema |
| `hooks/useSpeechRecognition.ts` | Browser voice transcription |
| `lib/teaching/types.ts` | Artifact and prompt types |
| `components/ui/*` | shadcn/ui component library |

### Browser Requirements

| Feature | Support |
|---------|---------|
| Voice Input | Chrome 33+, Edge 79+ (Web Speech API) |
| Document Import | All modern browsers (server-side processing) |
| Core Functionality | All browsers with ES2020+ support |

---

## Detailed Design

### 1. Database Schema Extensions

#### 1.1 Pedagogical Dimensions Model

```prisma
// prisma/schema.prisma

model PedagogicalDimension {
  id          String   @id @default(cuid())
  key         String   @unique  // 'foundations', 'progression', etc.
  name        String            // Display name
  icon        String            // Lucide icon name
  description String   @db.Text // Long description
  question    String   @db.Text // Guiding question for research
  priority    Int               // Order in gap detection (lower = more critical)
  isCritical  Boolean  @default(false) // True for essential dimensions
  createdAt   DateTime @default(now())

  tags        CorpusDimensionTag[]
}

model CorpusDimensionTag {
  id              String   @id @default(cuid())
  dimensionId     String
  contextLayerId  String?
  knowledgeFileId String?
  confidence      Float    @default(1.0)  // AI confidence in tag
  confirmedByUser Boolean  @default(false)
  createdAt       DateTime @default(now())

  dimension       PedagogicalDimension @relation(fields: [dimensionId], references: [id], onDelete: Cascade)
  contextLayer    ContextLayer?        @relation(fields: [contextLayerId], references: [id], onDelete: Cascade)
  knowledgeFile   KnowledgeFile?       @relation(fields: [knowledgeFileId], references: [id], onDelete: Cascade)

  @@unique([dimensionId, contextLayerId])
  @@unique([dimensionId, knowledgeFileId])
}
```

#### 1.2 Publishing Model

```prisma
model PublishedGuru {
  id          String    @id @default(cuid())
  projectId   String    @unique
  shortId     String    @unique  // nanoid(10) for /g/{shortId}
  isPublished Boolean   @default(true)
  publishedAt DateTime  @default(now())
  revokedAt   DateTime?
  viewCount   Int       @default(0)

  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([shortId])
}
```

#### 1.3 Update Existing Models

```prisma
// Add to ContextLayer
model ContextLayer {
  // ... existing fields ...
  dimensionTags CorpusDimensionTag[]
}

// Add to KnowledgeFile
model KnowledgeFile {
  // ... existing fields ...
  dimensionTags CorpusDimensionTag[]
}

// Add to Project
model Project {
  // ... existing fields ...
  publishedGuru PublishedGuru?
}
```

### 2. Seed Data: Pedagogical Dimensions

```typescript
// prisma/seeds/pedagogical-dimensions.ts

export const PEDAGOGICAL_DIMENSIONS = [
  {
    key: 'foundations',
    name: 'Foundations',
    icon: 'BookOpen',
    description: 'Core concepts, terminology, and fundamental principles that every learner must understand first.',
    question: 'What are the essential building blocks someone needs to know before anything else?',
    priority: 1,
    isCritical: true,
  },
  {
    key: 'progression',
    name: 'Progression',
    icon: 'TrendingUp',
    description: 'How skills build on each other, learning paths, and prerequisite relationships.',
    question: 'What is the ideal order for learning these concepts? What should come before what?',
    priority: 2,
    isCritical: true,
  },
  {
    key: 'mistakes',
    name: 'Common Mistakes',
    icon: 'AlertTriangle',
    description: 'Typical errors, misconceptions, and pitfalls that learners encounter.',
    question: 'What mistakes do beginners (and even intermediates) commonly make? What misconceptions need correcting?',
    priority: 3,
    isCritical: true,
  },
  {
    key: 'examples',
    name: 'Examples',
    icon: 'FileText',
    description: 'Concrete examples, case studies, and practical applications.',
    question: 'What are the best examples that illustrate key concepts? What real-world applications help understanding?',
    priority: 4,
    isCritical: false,
  },
  {
    key: 'nuance',
    name: 'Nuance & Edge Cases',
    icon: 'Lightbulb',
    description: 'Exceptions to rules, contextual variations, and advanced considerations.',
    question: 'What are the exceptions to the rules? When do standard approaches not apply?',
    priority: 5,
    isCritical: false,
  },
  {
    key: 'practice',
    name: 'Practice & Application',
    icon: 'Dumbbell',
    description: 'Exercises, drills, and opportunities to apply learned concepts.',
    question: 'What exercises or practice scenarios help reinforce learning? How should students test their understanding?',
    priority: 6,
    isCritical: false,
  },
];
```

### 3. TypeScript Types

#### 3.1 Wizard Types

```typescript
// lib/wizard/types.ts

export type WizardPhase = 'profile' | 'research' | 'readiness' | 'artifacts';

export interface WizardState {
  currentPhase: WizardPhase;
  projectId: string | null;
  profile: GuruProfileData | null;
  researchRuns: string[];  // IDs of research runs
  readinessScore: ReadinessScore | null;
  artifacts: ArtifactSummary[];
}

export interface ReadinessScore {
  overall: number;           // 0-100
  profile: number;           // 0-100 (profile completeness)
  knowledge: number;         // 0-100 (dimension coverage)
  criticalGaps: string[];    // Dimension keys missing critical content
  suggestedGaps: string[];   // Dimension keys that could be improved
  dimensionScores: Record<string, number>;  // Per-dimension scores
}

export interface DimensionCoverage {
  dimensionKey: string;
  dimensionName: string;
  itemCount: number;
  confirmedCount: number;
  isCritical: boolean;
  coveragePercent: number;
}
```

#### 3.2 Research Chat Types

```typescript
// lib/research/chat-types.ts

export interface ResearchPlan {
  title: string;
  objective: string;
  queries: string[];
  focusAreas: string[];
  expectedOutcomes: string[];
  depth: 'QUICK' | 'MODERATE' | 'DEEP';
}

export interface ResearchChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  planUpdate?: Partial<ResearchPlan>;  // If assistant suggests plan changes
}

export interface ResearchChatState {
  messages: ResearchChatMessage[];
  currentPlan: ResearchPlan | null;
  isRefining: boolean;
}
```

#### 3.3 Guru Testing Types

```typescript
// lib/testing/types.ts

export interface GuruTestMessage {
  id: string;
  role: 'user' | 'guru';
  content: string;
  timestamp: Date;
}

export interface GuruTestSession {
  projectId: string;
  messages: GuruTestMessage[];
  messageCount: number;
  maxMessages: number;  // 20
  startedAt: Date;
}
```

### 4. API Endpoints

#### 4.1 Document Parsing

```typescript
// app/api/documents/parse/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split('.').pop()?.toLowerCase();

  let text = '';
  let metadata = { pages: 0, words: 0 };

  try {
    if (extension === 'pdf') {
      const data = await pdf(buffer);
      text = data.text;
      metadata.pages = data.numpages;
    } else if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (extension === 'txt') {
      text = buffer.toString('utf-8');
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Use PDF, DOCX, or TXT.' },
        { status: 400 }
      );
    }

    metadata.words = text.split(/\s+/).filter(Boolean).length;

    return NextResponse.json({
      success: true,
      text: text.trim(),
      metadata,
    });
  } catch (error) {
    console.error('Document parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse document' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
```

#### 4.2 Research Plan Refinement

```typescript
// app/api/research/refine-plan/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import OpenAI from 'openai';

const requestSchema = z.object({
  projectId: z.string(),
  message: z.string().min(1),
  currentPlan: z.object({
    title: z.string(),
    objective: z.string(),
    queries: z.array(z.string()),
    focusAreas: z.array(z.string()),
    expectedOutcomes: z.array(z.string()),
    depth: z.enum(['QUICK', 'MODERATE', 'DEEP']),
  }).nullable(),
  guruProfile: z.any().optional(),
});

const SYSTEM_PROMPT = `You are a research planning assistant helping users create effective research plans for building AI teaching assistants (gurus).

Your role is to:
1. Understand what knowledge the user wants their guru to have
2. Suggest specific, actionable research queries
3. Identify focus areas that will yield the best learning content
4. Recommend appropriate research depth based on scope

When refining a plan, consider:
- The user's guru profile and teaching domain
- What pedagogical dimensions need coverage (Foundations, Progression, Mistakes, Examples, Nuance, Practice)
- Specificity of queries for better results
- Realistic scope for the chosen depth level

Always respond with:
1. A conversational message explaining your suggestions
2. An updated research plan (if changes are needed)

Output format:
{
  "reply": "Your conversational response...",
  "updatedPlan": { ... } or null if no changes
}`;

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, message, currentPlan, guruProfile } = requestSchema.parse(body);

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const userContext = guruProfile
    ? `\n\nGuru Profile:\n${JSON.stringify(guruProfile, null, 2)}`
    : '';

  const planContext = currentPlan
    ? `\n\nCurrent Research Plan:\n${JSON.stringify(currentPlan, null, 2)}`
    : '\n\nNo research plan yet - help the user create one.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `User message: ${message}${userContext}${planContext}`
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: 'Empty response' }, { status: 500 });
  }

  const result = JSON.parse(content);

  return NextResponse.json({
    reply: result.reply,
    updatedPlan: result.updatedPlan || null,
  });
}
```

#### 4.3 Readiness Scoring

```typescript
// app/api/projects/[id]/readiness/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { calculateReadinessScore } from '@/lib/readiness/scoring';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await requireProjectOwnership(params.id, user.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const score = await calculateReadinessScore(project.id);

  return NextResponse.json({
    success: true,
    score,
  });
}
```

#### 4.4 Guru Testing Chat

```typescript
// app/api/projects/[id]/guru/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { formatGuruProfileForPrompt } from '@/lib/guruFunctions/formatGuruProfile';
import { composeCorpusContext } from '@/lib/contextComposer';

const MAX_MESSAGES_PER_SESSION = 20;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id, userId: user.id },
    include: {
      currentProfile: true,
      contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      knowledgeFiles: { where: { isActive: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { messages } = await request.json();

  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    return NextResponse.json(
      { error: `Maximum ${MAX_MESSAGES_PER_SESSION} messages per session` },
      { status: 400 }
    );
  }

  // Build system prompt from corpus + profile
  const corpusContext = composeCorpusContext(
    project.contextLayers,
    project.knowledgeFiles
  );

  const profileContext = project.currentProfile?.profileData
    ? formatGuruProfileForPrompt(project.currentProfile.profileData as any)
    : '';

  const systemPrompt = `You are a teaching assistant guru being tested by the creator.

${profileContext}

## KNOWLEDGE BASE
${corpusContext}

## INSTRUCTIONS
- Answer questions based on the knowledge base above
- Stay in character according to the guru profile
- Be helpful and educational
- This is a test conversation - the creator is evaluating your responses
- If asked about something not in your knowledge base, acknowledge the limitation`;

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    messages,
  });

  return result.toDataStreamResponse();
}
```

#### 4.5 Publishing Management

```typescript
// app/api/projects/[id]/publish/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { nanoid } from 'nanoid';

// GET - Check publish status
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await requireProjectOwnership(params.id, user.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const published = await prisma.publishedGuru.findUnique({
    where: { projectId: params.id },
  });

  return NextResponse.json({
    isPublished: published?.isPublished ?? false,
    shortId: published?.shortId ?? null,
    publicUrl: published?.shortId ? `/g/${published.shortId}` : null,
    publishedAt: published?.publishedAt ?? null,
    viewCount: published?.viewCount ?? 0,
  });
}

// POST - Publish or update
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await requireProjectOwnership(params.id, user.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const existing = await prisma.publishedGuru.findUnique({
    where: { projectId: params.id },
  });

  if (existing) {
    // Re-enable if previously revoked
    const updated = await prisma.publishedGuru.update({
      where: { projectId: params.id },
      data: {
        isPublished: true,
        revokedAt: null,
        publishedAt: new Date(),
      },
    });
    return NextResponse.json({
      shortId: updated.shortId,
      publicUrl: `/g/${updated.shortId}`,
      publishedAt: updated.publishedAt,
    });
  }

  // Create new published guru
  const shortId = nanoid(10);
  const published = await prisma.publishedGuru.create({
    data: {
      projectId: params.id,
      shortId,
      isPublished: true,
    },
  });

  return NextResponse.json({
    shortId: published.shortId,
    publicUrl: `/g/${published.shortId}`,
    publishedAt: published.publishedAt,
  });
}

// DELETE - Revoke publish
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await requireProjectOwnership(params.id, user.id);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  await prisma.publishedGuru.update({
    where: { projectId: params.id },
    data: {
      isPublished: false,
      revokedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
```

#### 4.6 Dimension Tagging

```typescript
// app/api/projects/[id]/dimensions/suggest/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireProjectOwnership } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert at categorizing teaching content into pedagogical dimensions.

Dimensions:
- foundations: Core concepts, terminology, fundamental principles
- progression: Learning paths, prerequisites, skill building order
- mistakes: Common errors, misconceptions, pitfalls
- examples: Concrete examples, case studies, practical applications
- nuance: Exceptions, edge cases, contextual variations
- practice: Exercises, drills, application opportunities

For each piece of content, suggest relevant dimensions with confidence scores (0-1).
Return JSON: { "suggestions": [{ "dimension": "key", "confidence": 0.9 }] }`;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await requireProjectOwnership(params.id, user.id);

  const { content, title, type } = await request.json();

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Categorize this ${type}:\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 2000)}`
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0]?.message?.content || '{}');

  return NextResponse.json({
    suggestions: result.suggestions || [],
  });
}
```

### 5. Frontend Components

#### 5.1 Wizard Shell Layout

```typescript
// app/projects/new/layout.tsx

import { ReactNode } from 'react';
import { WizardNavigation } from '@/components/wizard/WizardNavigation';

export default function WizardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <WizardNavigation />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

#### 5.2 Wizard Navigation Component

```typescript
// components/wizard/WizardNavigation.tsx

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PHASES = [
  { id: 'profile', label: 'Define Guru', path: '/projects/new/profile' },
  { id: 'research', label: 'Build Knowledge', path: '/projects/new/research' },
  { id: 'readiness', label: 'Readiness Check', path: '/projects/new/readiness' },
  { id: 'artifacts', label: 'Create Content', path: '/projects/new/artifacts' },
];

export function WizardNavigation() {
  const pathname = usePathname();

  const currentIndex = PHASES.findIndex(p => pathname.startsWith(p.path));

  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between py-4">
          <Link href="/projects" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Projects
          </Link>

          <ol className="flex items-center gap-2">
            {PHASES.map((phase, index) => {
              const isComplete = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isAccessible = index <= currentIndex;

              return (
                <li key={phase.id} className="flex items-center">
                  {index > 0 && (
                    <div className={cn(
                      "w-12 h-0.5 mx-2",
                      isComplete ? "bg-blue-600" : "bg-gray-200"
                    )} />
                  )}

                  <Link
                    href={isAccessible ? phase.path : '#'}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                      isCurrent && "bg-blue-100 text-blue-700",
                      isComplete && "text-blue-600",
                      !isAccessible && "text-gray-400 cursor-not-allowed"
                    )}
                    onClick={(e) => !isAccessible && e.preventDefault()}
                  >
                    <span className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                      isCurrent && "bg-blue-600 text-white",
                      isComplete && "bg-blue-600 text-white",
                      !isCurrent && !isComplete && "bg-gray-200 text-gray-500"
                    )}>
                      {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                    </span>
                    <span className="hidden sm:inline">{phase.label}</span>
                  </Link>
                </li>
              );
            })}
          </ol>

          <div className="w-24" /> {/* Spacer for balance */}
        </div>
      </div>
    </nav>
  );
}
```

#### 5.3 Profile Phase with Multiple Input Modes

```typescript
// app/projects/new/profile/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileChatMode } from '@/components/wizard/profile/ProfileChatMode';
import { ProfileVoiceMode } from '@/components/wizard/profile/ProfileVoiceMode';
import { ProfileDocumentMode } from '@/components/wizard/profile/ProfileDocumentMode';
import { ProfilePreview } from '@/components/wizard/profile/ProfilePreview';
import { MessageSquare, Mic, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GuruProfileData, SynthesisResult } from '@/lib/guruProfile/types';

type InputMode = 'chat' | 'voice' | 'document';
type Step = 'input' | 'preview';

const INPUT_MODES = [
  { id: 'chat' as const, label: 'Chat Interview', icon: MessageSquare, description: 'Answer questions about your guru' },
  { id: 'voice' as const, label: 'Voice Recording', icon: Mic, description: 'Describe your guru by speaking' },
  { id: 'document' as const, label: 'Import Document', icon: FileText, description: 'Upload existing documentation' },
];

export default function ProfilePage() {
  const router = useRouter();
  const [mode, setMode] = useState<InputMode>('chat');
  const [step, setStep] = useState<Step>('input');
  const [result, setResult] = useState<SynthesisResult | null>(null);
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSynthesisComplete = (synthesisResult: SynthesisResult) => {
    setResult(synthesisResult);
    setProjectName(synthesisResult.profile.domainExpertise || 'My Guru');
    setStep('preview');
  };

  const handleSave = async () => {
    if (!result) return;

    setSaving(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          guruProfile: {
            profileData: result.profile,
            rawBrainDump: result.rawInput,
            synthesisMode: result.synthesisMode,
            lightAreas: result.lightAreas,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const { project } = await response.json();
      router.push(`/projects/new/research?projectId=${project.id}`);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'preview' && result) {
    return (
      <ProfilePreview
        result={result}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onBack={() => setStep('input')}
        onSave={handleSave}
        saving={saving}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Define Your Guru</h1>
        <p className="mt-2 text-gray-600">
          Tell us about the teaching assistant you want to create
        </p>
      </div>

      {/* Mode Selection */}
      <div className="flex justify-center gap-4">
        {INPUT_MODES.map(({ id, label, icon: Icon, description }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors w-40",
              mode === id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <Icon className={cn(
              "w-8 h-8",
              mode === id ? "text-blue-600" : "text-gray-400"
            )} />
            <span className={cn(
              "font-medium",
              mode === id ? "text-blue-700" : "text-gray-700"
            )}>
              {label}
            </span>
            <span className="text-xs text-gray-500 text-center">{description}</span>
          </button>
        ))}
      </div>

      {/* Mode-specific Input */}
      <div className="bg-white rounded-lg border p-6">
        {mode === 'chat' && (
          <ProfileChatMode onComplete={handleSynthesisComplete} />
        )}
        {mode === 'voice' && (
          <ProfileVoiceMode onComplete={handleSynthesisComplete} />
        )}
        {mode === 'document' && (
          <ProfileDocumentMode onComplete={handleSynthesisComplete} />
        )}
      </div>
    </div>
  );
}
```

#### 5.4 Research Chat Assistant

```typescript
// components/wizard/research/ResearchChatAssistant.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Play, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ResearchPlan, ResearchChatMessage } from '@/lib/research/chat-types';
import type { GuruProfileData } from '@/lib/guruProfile/types';

interface Props {
  projectId: string;
  guruProfile: GuruProfileData | null;
  onExecutePlan: (plan: ResearchPlan) => void;
}

export function ResearchChatAssistant({ projectId, guruProfile, onExecutePlan }: Props) {
  const [messages, setMessages] = useState<ResearchChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'll help you plan what to research for your guru. What topics or knowledge areas would you like to explore?",
      timestamp: new Date(),
    },
  ]);
  const [currentPlan, setCurrentPlan] = useState<ResearchPlan | null>(null);
  const [input, setInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [editingPlan, setEditingPlan] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isRefining) return;

    const userMessage: ResearchChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsRefining(true);

    try {
      const response = await fetch('/api/research/refine-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          message: input,
          currentPlan,
          guruProfile,
        }),
      });

      const data = await response.json();

      const assistantMessage: ResearchChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
        planUpdate: data.updatedPlan,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.updatedPlan) {
        setCurrentPlan(data.updatedPlan);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-[600px]">
      {/* Chat Panel */}
      <div className="flex flex-col border rounded-lg bg-white">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Research Planning Assistant</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(message => (
            <div
              key={message.id}
              className={cn(
                "p-3 rounded-lg max-w-[85%]",
                message.role === 'user'
                  ? "ml-auto bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              )}
            >
              {message.content}
            </div>
          ))}
          {isRefining && (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to research..."
              className="resize-none"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button onClick={handleSend} disabled={!input.trim() || isRefining}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Plan Panel */}
      <div className="flex flex-col border rounded-lg bg-white">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Research Plan</h3>
          {currentPlan && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingPlan(!editingPlan)}
            >
              <Edit3 className="w-4 h-4 mr-1" />
              {editingPlan ? 'Done' : 'Edit'}
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {currentPlan ? (
            <ResearchPlanDisplay
              plan={currentPlan}
              editing={editingPlan}
              onChange={setCurrentPlan}
            />
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>No plan yet</p>
              <p className="text-sm">Chat with the assistant to create one</p>
            </div>
          )}
        </div>

        {currentPlan && (
          <div className="p-4 border-t">
            <Button
              className="w-full"
              onClick={() => onExecutePlan(currentPlan)}
            >
              <Play className="w-4 h-4 mr-2" />
              Execute Research Plan
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 5.5 Readiness Checkpoint

```typescript
// app/projects/new/readiness/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';

export default function ReadinessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('projectId');

  const [score, setScore] = useState<ReadinessScore | null>(null);
  const [dimensions, setDimensions] = useState<DimensionCoverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    const fetchReadiness = async () => {
      const response = await fetch(`/api/projects/${projectId}/readiness`);
      const data = await response.json();
      setScore(data.score);
      setDimensions(data.dimensions);
      setLoading(false);
    };

    fetchReadiness();
  }, [projectId]);

  if (loading) {
    return <div className="text-center py-12">Analyzing your guru's readiness...</div>;
  }

  if (!score) {
    return <div className="text-center py-12">Unable to calculate readiness</div>;
  }

  const isReady = score.overall >= 60 && score.criticalGaps.length === 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Readiness Checkpoint</h1>
        <p className="mt-2 text-gray-600">
          Let's see how complete your guru's knowledge is
        </p>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-lg border p-6 text-center">
        <div className="text-6xl font-bold text-gray-900 mb-2">
          {score.overall}
          <span className="text-2xl text-gray-400">/100</span>
        </div>
        <Progress value={score.overall} className="h-3 mb-4" />
        <p className={cn(
          "text-lg font-medium",
          isReady ? "text-green-600" : "text-amber-600"
        )}>
          {isReady
            ? "Your guru is ready to create content!"
            : "A few more areas could be strengthened"}
        </p>
      </div>

      {/* Critical Gaps */}
      {score.criticalGaps.length > 0 && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-red-800 mb-4">
            <XCircle className="w-5 h-5" />
            Critical Gaps (Recommended to Address)
          </h3>
          <ul className="space-y-3">
            {score.criticalGaps.map(gap => {
              const dim = dimensions.find(d => d.dimensionKey === gap);
              return (
                <li key={gap} className="flex items-center justify-between">
                  <span className="text-red-700">{dim?.dimensionName || gap}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/projects/new/research?projectId=${projectId}&focus=${gap}`)}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Research This
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Suggested Improvements */}
      {score.suggestedGaps.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-amber-800 mb-4">
            <AlertTriangle className="w-5 h-5" />
            Suggested Improvements (Optional)
          </h3>
          <ul className="space-y-3">
            {score.suggestedGaps.map(gap => {
              const dim = dimensions.find(d => d.dimensionKey === gap);
              return (
                <li key={gap} className="flex items-center justify-between text-amber-700">
                  <span>{dim?.dimensionName || gap}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/projects/new/research?projectId=${projectId}&focus=${gap}`)}
                  >
                    <Search className="w-4 h-4 mr-1" />
                    Research
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Dimension Coverage */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Knowledge Coverage by Dimension</h3>
        <div className="space-y-4">
          {dimensions.map(dim => (
            <div key={dim.dimensionKey}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  {dim.dimensionName}
                  {dim.isCritical && <span className="text-red-500 ml-1">*</span>}
                </span>
                <span className="text-sm text-gray-500">
                  {dim.itemCount} items ({dim.confirmedCount} confirmed)
                </span>
              </div>
              <Progress value={dim.coveragePercent} className="h-2" />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-4">* Critical dimensions</p>
      </div>

      {/* Continue Button */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={() => router.push(`/projects/new/research?projectId=${projectId}`)}
        >
          Add More Research
        </Button>
        <Button
          onClick={() => router.push(`/projects/new/artifacts?projectId=${projectId}`)}
          disabled={!isReady && score.criticalGaps.length > 0}
        >
          Continue to Content Creation
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
```

#### 5.6 Guru Testing Chat

```typescript
// components/wizard/testing/GuruTestChat.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from 'ai/react';
import { Send, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  projectId: string;
}

const MAX_MESSAGES = 20;

export function GuruTestChat({ projectId }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: `/api/projects/${projectId}/guru/chat`,
    initialMessages: [
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your guru, ready to be tested. Ask me anything about my teaching domain to see how I respond.",
      },
    ],
  });

  const messageCount = messages.filter(m => m.role === 'user').length;
  const canSendMore = messageCount < MAX_MESSAGES;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleReset = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your guru, ready to be tested. Ask me anything about my teaching domain to see how I respond.",
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[500px] border rounded-lg bg-white">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Test Your Guru</h3>
          <p className="text-xs text-gray-500">
            {messageCount}/{MAX_MESSAGES} messages used
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
            Test Mode
          </span>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div
            key={message.id}
            className={cn(
              "p-3 rounded-lg max-w-[85%]",
              message.role === 'user'
                ? "ml-auto bg-blue-600 text-white"
                : "bg-gray-100 text-gray-900"
            )}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        {!canSendMore ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">
              Message limit reached. Reset to start a new test session.
            </span>
            <Button size="sm" variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Textarea
              value={input}
              onChange={handleInputChange}
              placeholder="Ask your guru a question..."
              className="resize-none"
              rows={2}
              disabled={isLoading}
            />
            <Button type="submit" disabled={!input.trim() || isLoading}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
```

### 6. Readiness Scoring Algorithm

```typescript
// lib/readiness/scoring.ts

import { prisma } from '@/lib/db';
import type { ReadinessScore, DimensionCoverage } from '@/lib/wizard/types';
import type { GuruProfileData } from '@/lib/guruProfile/types';

const PROFILE_REQUIRED_FIELDS: (keyof GuruProfileData)[] = [
  'domainExpertise',
  'specificTopics',
  'audienceLevel',
  'audienceDescription',
  'pedagogicalApproach',
  'tone',
  'communicationStyle',
  'uniquePerspective',
  'successMetrics',
];

const DIMENSION_WEIGHTS: Record<string, number> = {
  foundations: 25,
  progression: 20,
  mistakes: 20,
  examples: 15,
  nuance: 10,
  practice: 10,
};

export async function calculateReadinessScore(projectId: string): Promise<{
  score: ReadinessScore;
  dimensions: DimensionCoverage[];
}> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      currentProfile: true,
      contextLayers: {
        include: { dimensionTags: true },
      },
      knowledgeFiles: {
        include: { dimensionTags: true },
      },
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Calculate profile completeness
  const profileData = project.currentProfile?.profileData as GuruProfileData | null;
  let profileScore = 0;

  if (profileData) {
    const filledFields = PROFILE_REQUIRED_FIELDS.filter(field => {
      const value = profileData[field];
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '';
    });
    profileScore = Math.round((filledFields.length / PROFILE_REQUIRED_FIELDS.length) * 100);
  }

  // Get all dimensions
  const allDimensions = await prisma.pedagogicalDimension.findMany({
    orderBy: { priority: 'asc' },
  });

  // Calculate dimension coverage
  const dimensionCoverage: DimensionCoverage[] = [];
  const criticalGaps: string[] = [];
  const suggestedGaps: string[] = [];
  let weightedKnowledgeScore = 0;

  for (const dim of allDimensions) {
    const layerTags = project.contextLayers.flatMap(l =>
      l.dimensionTags.filter(t => t.dimensionId === dim.id)
    );
    const fileTags = project.knowledgeFiles.flatMap(f =>
      f.dimensionTags.filter(t => t.dimensionId === dim.id)
    );

    const allTags = [...layerTags, ...fileTags];
    const itemCount = allTags.length;
    const confirmedCount = allTags.filter(t => t.confirmedByUser).length;

    // Coverage: has at least 1 confirmed item = 100%, has suggested = 50%, none = 0%
    let coveragePercent = 0;
    if (confirmedCount > 0) {
      coveragePercent = Math.min(100, 50 + (confirmedCount * 10));
    } else if (itemCount > 0) {
      coveragePercent = 25;
    }

    dimensionCoverage.push({
      dimensionKey: dim.key,
      dimensionName: dim.name,
      itemCount,
      confirmedCount,
      isCritical: dim.isCritical,
      coveragePercent,
    });

    // Track gaps
    if (coveragePercent < 50) {
      if (dim.isCritical) {
        criticalGaps.push(dim.key);
      } else {
        suggestedGaps.push(dim.key);
      }
    }

    // Add to weighted score
    const weight = DIMENSION_WEIGHTS[dim.key] || 10;
    weightedKnowledgeScore += (coveragePercent / 100) * weight;
  }

  // Normalize knowledge score to 0-100
  const totalWeight = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
  const knowledgeScore = Math.round((weightedKnowledgeScore / totalWeight) * 100);

  // Overall score: 40% profile + 60% knowledge
  const overallScore = Math.round((profileScore * 0.4) + (knowledgeScore * 0.6));

  return {
    score: {
      overall: overallScore,
      profile: profileScore,
      knowledge: knowledgeScore,
      criticalGaps,
      suggestedGaps,
      dimensionScores: Object.fromEntries(
        dimensionCoverage.map(d => [d.dimensionKey, d.coveragePercent])
      ),
    },
    dimensions: dimensionCoverage,
  };
}
```

### 7. Public Guru View

```typescript
// app/g/[shortId]/page.tsx

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { PublicGuruView } from '@/components/public/PublicGuruView';

interface Props {
  params: { shortId: string };
}

export default async function PublicGuruPage({ params }: Props) {
  const published = await prisma.publishedGuru.findUnique({
    where: { shortId: params.shortId },
    include: {
      project: {
        include: {
          currentProfile: true,
          guruArtifacts: {
            where: { status: 'COMPLETED' },
            orderBy: { version: 'desc' },
            take: 3,  // Latest of each type
          },
        },
      },
    },
  });

  if (!published || !published.isPublished) {
    notFound();
  }

  // Increment view count
  await prisma.publishedGuru.update({
    where: { shortId: params.shortId },
    data: { viewCount: { increment: 1 } },
  });

  const profile = published.project.currentProfile?.profileData as GuruProfileData;

  return (
    <PublicGuruView
      profile={profile}
      artifacts={published.project.guruArtifacts}
      projectName={published.project.name}
    />
  );
}
```

---

## User Experience

### Wizard Flow Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          WIZARD NAVIGATION                          │
│  ○ Define Guru  ●───────● Build Knowledge  ○───────○ Readiness     │
│                            (current)                    Check       │
│  ○───────○ Create Content                                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Profile Creation (`/projects/new/profile`)

1. User selects input mode (chat/voice/document)
2. **Chat Mode:** Guided Q&A with guiding questions
3. **Voice Mode:** Record button with live transcription, browser support indicator
4. **Document Mode:** File upload with parsing progress
5. AI synthesizes input into structured profile
6. User reviews profile preview with light areas highlighted
7. User can edit project name and refine profile
8. Click "Continue" creates project and advances to Phase 2

### Phase 2: Research & Knowledge (`/projects/new/research`)

1. Split-panel interface: Chat left, Plan right
2. User describes research goals in natural language
3. Assistant suggests structured research plan
4. Plan shows: title, queries, focus areas, depth
5. User can edit plan directly or continue chatting
6. Click "Execute" triggers research run
7. Show progress tracker during research
8. Review recommendations with dimension tagging
9. Approve/reject recommendations
10. Apply changes to corpus
11. Repeat research as needed
12. Click "Continue" advances to Phase 3

### Phase 3: Readiness Checkpoint (`/projects/new/readiness`)

1. Calculate and display overall readiness score
2. Show breakdown: profile completeness + knowledge coverage
3. Highlight critical gaps in red (must address)
4. Show suggested improvements in amber (optional)
5. Dimension-by-dimension coverage bars
6. Quick-action buttons to research specific gaps
7. Can proceed to Phase 4 if no critical gaps

### Phase 4: Artifact Creation (`/projects/new/artifacts`)

1. Three artifact cards: Mental Model, Curriculum, Drill Series
2. One-click generation with progress tracking
3. View generated artifacts in simplified viewer
4. Test guru via chat interface (20 messages max)
5. Publish guru with shareable link
6. Copy link or regenerate as needed

### Error Handling

- **Voice Input:** Show "Voice not supported in this browser" message for Firefox/Safari
- **Document Import:** Show parsing errors with retry option
- **Research Failure:** Show error with retry button, preserve chat history
- **Artifact Generation Failure:** Show error message with regenerate option
- **Publishing:** Show confirmation before revoking published link

---

## Testing Strategy

### Unit Tests

```typescript
// lib/readiness/__tests__/scoring.test.ts

describe('calculateReadinessScore', () => {
  it('returns 0 profile score when no profile exists', async () => {
    // Purpose: Verify baseline behavior for projects without profiles
    const project = await createTestProjectWithoutProfile();
    const { score } = await calculateReadinessScore(project.id);
    expect(score.profile).toBe(0);
  });

  it('calculates correct profile completeness percentage', async () => {
    // Purpose: Verify profile scoring algorithm accuracy
    const profile = createPartialProfile(['domainExpertise', 'audienceLevel']);
    const project = await createTestProjectWithProfile(profile);
    const { score } = await calculateReadinessScore(project.id);
    expect(score.profile).toBe(Math.round((2 / 9) * 100)); // 2 of 9 required fields
  });

  it('identifies critical gaps correctly', async () => {
    // Purpose: Verify critical gap detection logic
    const project = await createProjectWithDimensionTags({
      foundations: 0,
      progression: 2,
      mistakes: 0,
    });
    const { score } = await calculateReadinessScore(project.id);
    expect(score.criticalGaps).toContain('foundations');
    expect(score.criticalGaps).toContain('mistakes');
    expect(score.criticalGaps).not.toContain('progression');
  });

  it('weighs dimensions according to DIMENSION_WEIGHTS', async () => {
    // Purpose: Verify weighted scoring is applied correctly
    // Foundations (25%) fully covered should contribute 25 to knowledge score
  });
});

// lib/research/__tests__/chat-refinement.test.ts

describe('research plan refinement', () => {
  it('generates initial plan from user description', async () => {
    // Purpose: Verify AI can create a structured plan from natural language
  });

  it('updates plan based on follow-up messages', async () => {
    // Purpose: Verify iterative refinement works
  });

  it('preserves depth when not explicitly changed', async () => {
    // Purpose: Verify plan fields persist across updates
  });
});

// components/wizard/__tests__/WizardNavigation.test.tsx

describe('WizardNavigation', () => {
  it('highlights current phase correctly', () => {
    // Purpose: Verify active state styling
  });

  it('prevents navigation to future phases', () => {
    // Purpose: Verify disabled state for incomplete phases
  });

  it('allows navigation to completed phases', () => {
    // Purpose: Verify users can go back
  });
});
```

### Integration Tests

```typescript
// app/api/documents/__tests__/parse.test.ts

describe('POST /api/documents/parse', () => {
  it('extracts text from PDF files', async () => {
    // Purpose: Verify PDF parsing works end-to-end
    const pdfBuffer = createTestPDF('Hello World');
    const response = await POST(createFormDataRequest(pdfBuffer, 'test.pdf'));
    expect(response.text).toContain('Hello World');
  });

  it('extracts text from DOCX files', async () => {
    // Purpose: Verify DOCX parsing works end-to-end
  });

  it('rejects unsupported file types', async () => {
    // Purpose: Verify security boundary
    const response = await POST(createFormDataRequest(buffer, 'test.exe'));
    expect(response.status).toBe(400);
  });

  it('handles malformed files gracefully', async () => {
    // Purpose: Verify error handling for corrupted files
  });
});

// app/api/projects/[id]/readiness/__tests__/route.test.ts

describe('GET /api/projects/[id]/readiness', () => {
  it('returns readiness score for valid project', async () => {
    // Purpose: Verify API returns expected shape
  });

  it('returns 404 for non-existent project', async () => {
    // Purpose: Verify error handling
  });

  it('requires project ownership', async () => {
    // Purpose: Verify authorization
  });
});
```

### E2E Tests

```typescript
// e2e/wizard-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Wizard Flow', () => {
  test('complete flow: profile → research → readiness → artifacts', async ({ page }) => {
    // Purpose: Verify happy path through entire wizard

    // Phase 1: Profile
    await page.goto('/projects/new/profile');
    await page.click('[data-mode="chat"]');
    await page.fill('textarea', 'I want to teach chess to beginners...');
    await page.click('button:has-text("Generate Profile")');
    await expect(page.locator('text=Review Your Guru')).toBeVisible({ timeout: 60000 });
    await page.click('button:has-text("Continue")');

    // Phase 2: Research
    await expect(page).toHaveURL(/\/projects\/new\/research/);
    await page.fill('textarea', 'Research basic chess openings for beginners');
    await page.click('button:has-text("Send")');
    await expect(page.locator('[data-testid="research-plan"]')).toBeVisible();
    await page.click('button:has-text("Execute Research")');
    await expect(page.locator('text=Research completed')).toBeVisible({ timeout: 120000 });

    // Phase 3: Readiness
    await page.click('button:has-text("Continue to Readiness")');
    await expect(page).toHaveURL(/\/projects\/new\/readiness/);
    await expect(page.locator('[data-testid="readiness-score"]')).toBeVisible();

    // Phase 4: Artifacts
    await page.click('button:has-text("Continue to Content")');
    await expect(page).toHaveURL(/\/projects\/new\/artifacts/);
  });

  test('voice input shows browser support indicator', async ({ page }) => {
    // Purpose: Verify graceful degradation for unsupported browsers
    await page.goto('/projects/new/profile');
    await page.click('[data-mode="voice"]');

    // Check for support indicator (varies by browser)
    const indicator = page.locator('[data-testid="voice-support"]');
    await expect(indicator).toBeVisible();
  });

  test('guru testing enforces message limit', async ({ page }) => {
    // Purpose: Verify session limits are enforced
    await createProjectWithArtifacts();
    await page.goto('/projects/new/artifacts?projectId=xxx');

    for (let i = 0; i < 20; i++) {
      await page.fill('[data-testid="chat-input"]', `Message ${i + 1}`);
      await page.click('button:has-text("Send")');
    }

    await expect(page.locator('text=Message limit reached')).toBeVisible();
    await expect(page.locator('[data-testid="chat-input"]')).toBeDisabled();
  });
});

// e2e/publishing.spec.ts

test.describe('Publishing', () => {
  test('generates shareable link', async ({ page }) => {
    // Purpose: Verify publish flow creates accessible URL
    await createProjectWithArtifacts();
    await page.goto('/projects/xxx');
    await page.click('button:has-text("Publish")');

    const link = await page.locator('[data-testid="public-url"]').textContent();
    expect(link).toMatch(/\/g\/[a-zA-Z0-9]+/);

    // Verify link is accessible
    await page.goto(link!);
    await expect(page.locator('[data-testid="public-guru"]')).toBeVisible();
  });

  test('revoked links return 404', async ({ page }) => {
    // Purpose: Verify revoke functionality works
    const shortId = await publishProject();
    await page.click('button:has-text("Revoke")');

    const response = await page.goto(`/g/${shortId}`);
    expect(response?.status()).toBe(404);
  });
});
```

---

## Performance Considerations

| Operation | Target | Mitigation |
|-----------|--------|------------|
| Profile synthesis | < 15s | Loading indicator, 60s timeout |
| Document parsing | < 5s | Progress indicator, file size limit (10MB) |
| Research plan refinement | < 5s | Streaming response, typing indicator |
| Readiness calculation | < 2s | Server-side calculation, cache-friendly |
| Guru test chat | < 3s first token | Streaming responses |
| Public guru page load | < 1s | Static generation where possible |

### Optimization Strategies

1. **Lazy Loading:** Load wizard phases on demand, not all upfront
2. **Streaming:** Use AI SDK streaming for chat responses
3. **Caching:** Cache readiness scores with 5-minute TTL
4. **Pagination:** Limit dimension tag queries to active items
5. **Bundle Splitting:** Separate chunks per wizard phase

---

## Security Considerations

1. **Authentication:** All wizard endpoints require authenticated user
2. **Authorization:** Project ownership verified before any operation
3. **File Upload:**
   - Max size: 10MB
   - Allowed types: PDF, DOCX, TXT only
   - Server-side validation (not just extension check)
4. **Rate Limiting:** Consider adding rate limits for:
   - Document parsing: 10/minute
   - Research plan refinement: 30/minute
   - Guru testing: 100 messages/hour
5. **Public URLs:**
   - Random shortIds (nanoid 10 chars = 64^10 possibilities)
   - No enumeration possible
   - Revocable by owner
6. **Input Sanitization:** All AI-generated content validated before database storage

---

## Documentation

### To Create

- `developer-guides/12-wizard-flow-guide.md` - Wizard architecture and patterns
- Update `CLAUDE.md` with wizard patterns and pedagogical dimensions

### To Update

- `developer-guides/01-overall-architecture.md` - Add wizard flow diagram
- `developer-guides/08-teaching-pipeline-guide.md` - Reference wizard integration

---

## Implementation Phases

### Phase 1: Foundation (Core Wizard)

1. Database schema migrations (dimensions, publishing)
2. Seed pedagogical dimensions
3. Wizard layout and navigation component
4. Profile phase with chat mode only
5. Basic research phase (existing form, no chat)
6. Readiness calculation endpoint
7. Basic readiness display

### Phase 2: Enhanced Input

1. Voice input mode for profile
2. Document import endpoint and UI
3. Research chat assistant
4. Plan refinement API
5. Enhanced readiness visualization

### Phase 3: Testing & Publishing

1. Guru testing chat interface
2. Publishing API endpoints
3. Public guru view page
4. Link management UI

### Phase 4: Polish

1. Migration banner for existing projects
2. Dimension auto-tagging for corpus
3. Research suggestions based on gaps
4. Mobile responsiveness
5. Performance optimization

---

## Open Questions

1. ~~**Dimension Confidence Threshold**~~ (RESOLVED)
   **Answer:** Use 0.8 threshold - tags with confidence > 0.8 auto-apply, others require user confirmation
   **Rationale:** Balances automation with user control per hybrid approach decision

2. ~~**Public View Scope**~~ (RESOLVED)
   **Answer:** All completed artifacts are visible in public view
   **Rationale:** Artifacts add value and demonstrate guru capabilities to viewers

3. ~~**Readiness Score Thresholds**~~ (RESOLVED)
   **Answer:** Keep simple threshold (>= 60 AND no critical gaps), not configurable
   **Rationale:** YAGNI - avoid over-engineering for edge cases

4. ~~**Research Chat History**~~ (RESOLVED)
   **Answer:** Ephemeral for v1 - chat history not persisted across sessions
   **Rationale:** Simpler implementation, only final research plan matters; evaluate in v2 if needed

---

## References

- Ideation: `specs/simplified-frontend-wrapper/01-ideation.md`
- Prototype: `new-simpler-UI-layer/guru-builder-v4.jsx`
- Implementation Mapping: `new-simpler-UI-layer/guru-builder-implementation-mapping.md`
- Guru Profile Spec: `specs/completed/guru-profile-onboarding/02-specification.md`
- Architecture Guide: `developer-guides/01-overall-architecture.md`
- Stepperize Docs: https://stepperize.vercel.app/docs
- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- Vercel AI SDK: https://sdk.vercel.ai/docs
- shadcn/ui: https://ui.shadcn.com/
- nanoid: https://github.com/ai/nanoid
