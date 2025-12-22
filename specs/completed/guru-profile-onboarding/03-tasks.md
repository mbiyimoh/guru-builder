# Task Breakdown: Guru Profile Brain Dump Onboarding
Generated: 2025-12-10
Source: specs/guru-profile-onboarding/02-specification.md
Last Decompose: 2025-12-10

---

## Overview

This document provides a detailed task breakdown for implementing the Guru Profile Brain Dump Onboarding feature. Users describe their teaching guru through natural language (voice or text), which is synthesized into a structured 15-field profile. This profile is then injected into all teaching artifact generation prompts.

**User Flow:**
```
"Define Your Guru" → Brain Dump (voice/text) → AI Synthesis → Preview → Refine Light Areas → Confirm → Project Created
```

---

## Phase 1: Database Foundation

### Task 1.1: Create GuruProfile Model

**Description:** Add the `GuruProfile` model to Prisma schema with all required fields and relations.

**Size:** Medium

**Priority:** High

**Dependencies:** None

**Technical Requirements:**
- Create `GuruProfile` model with JSON storage for profile data
- Add `SynthesisMode` enum (NEW, ADAPT)
- Establish relations to Project model
- Add appropriate indexes for performance

**Implementation Code:**

```prisma
// Add to prisma/schema.prisma

model GuruProfile {
  id          String   @id @default(cuid())
  projectId   String
  version     Int      @default(1)

  // The structured profile data (15 fields)
  profileData Json     // GuruProfileData interface

  // The raw input that generated this version
  rawBrainDump      String?  @db.Text
  additionalContext String?  @db.Text  // For refinement iteration

  // Synthesis metadata
  synthesisMode     SynthesisMode  @default(NEW)
  previousVersionId String?        // Link to prior version if ADAPT

  // Timestamps
  createdAt   DateTime @default(now())

  // Relations
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, version])
  @@index([projectId, createdAt])
}

enum SynthesisMode {
  NEW     // Generated from scratch
  ADAPT   // Adapted from previous version (Part 2)
}
```

**Acceptance Criteria:**
- [ ] `GuruProfile` model exists in schema
- [ ] All fields are properly typed
- [ ] Relations to Project are correctly defined
- [ ] Indexes are created for query performance
- [ ] `SynthesisMode` enum includes NEW and ADAPT values

---

### Task 1.2: Update Project Model

**Description:** Add guru profile relations to the existing Project model.

**Size:** Small

**Priority:** High

**Dependencies:** Task 1.1

**Technical Requirements:**
- Add `currentProfileId` field (nullable for backward compatibility)
- Create "CurrentProfile" relation (1:1)
- Create "ProfileHistory" relation (1:many)
- Ensure all fields are nullable for existing projects

**Implementation Code:**

```prisma
model Project {
  // ... existing fields ...

  // Current active profile (latest version)
  currentProfileId  String?  @unique
  currentProfile    GuruProfile?  @relation("CurrentProfile", fields: [currentProfileId], references: [id], onDelete: SetNull)

  // All profile versions (for history - Part 2)
  profileHistory    GuruProfile[] @relation("ProfileHistory")
}
```

**Acceptance Criteria:**
- [ ] `currentProfileId` field added to Project
- [ ] `currentProfile` relation (1:1) established
- [ ] `profileHistory` relation (1:many) established
- [ ] Fields are nullable for backward compatibility
- [ ] Existing projects continue to work with null values

---

### Task 1.3: Create TypeScript Types and Zod Schemas

**Description:** Define TypeScript interfaces and Zod validation schemas for the guru profile data structure.

**Size:** Medium

**Priority:** High

**Dependencies:** None

**Technical Requirements:**
- Create comprehensive Zod schema for 15-field profile
- Define enums for audienceLevel and tone
- Create types for synthesis result with light areas
- Export all types for use across codebase

**Implementation Code:**

```typescript
// lib/guruFunctions/schemas/guruProfileSchema.ts
import { z } from 'zod'

// Enum for audience level
export const audienceLevelSchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
  'mixed'
])

// Enum for tone
export const guruToneSchema = z.enum([
  'formal',
  'casual',
  'encouraging',
  'challenging',
  'socratic'
])

// Main profile schema (15 fields across 5 categories)
export const guruProfileDataSchema = z.object({
  // IDENTITY (2 fields)
  name: z.string().min(1).max(100),
  tagline: z.string().max(200).nullable(),

  // DOMAIN (2 fields)
  domain: z.string().min(1).max(500),
  expertiseAreas: z.array(z.string()).min(1).max(10),

  // AUDIENCE (3 fields)
  targetAudience: z.string().min(1).max(500),
  audienceLevel: audienceLevelSchema,
  learnerGoals: z.array(z.string()).min(1).max(10),

  // PEDAGOGY (3 fields)
  teachingPhilosophy: z.string().min(1).max(1000),
  preferredMethods: z.array(z.string()).min(1).max(10),
  avoidApproaches: z.array(z.string()).max(10),

  // STYLE (3 fields)
  tone: guruToneSchema,
  communicationStyle: z.string().min(1).max(500),
  personalityTraits: z.array(z.string()).min(1).max(10),

  // CONTEXT (2 fields)
  uniquePerspective: z.string().max(500).nullable(),
  additionalNotes: z.string().max(1000).nullable(),
})

export type GuruProfileData = z.infer<typeof guruProfileDataSchema>
export type AudienceLevel = z.infer<typeof audienceLevelSchema>
export type GuruTone = z.infer<typeof guruToneSchema>

// Schema for synthesis API response (includes light area detection)
export const synthesisResultSchema = z.object({
  profile: guruProfileDataSchema,
  lightAreas: z.array(z.object({
    field: z.string(),
    category: z.string(),
    suggestion: z.string(),
  })),
  suggestedProjectName: z.string(),
})

export type SynthesisResult = z.infer<typeof synthesisResultSchema>
```

**Acceptance Criteria:**
- [ ] All 15 profile fields defined in schema
- [ ] Validation rules match spec requirements
- [ ] Audience level enum has all 4 values
- [ ] Tone enum has all 5 values
- [ ] SynthesisResult includes profile, lightAreas, suggestedProjectName
- [ ] All types properly exported

---

### Task 1.4: Run Database Migration

**Description:** Execute safe database migration to add the new schema changes.

**Size:** Small

**Priority:** High

**Dependencies:** Tasks 1.1, 1.2, 1.3

**Technical Requirements:**
- Follow Database Safety Protocol from CLAUDE.md
- Create backup before migration
- Use `migrate:safe` script
- Verify migration success

**Implementation Steps:**

```bash
# 1. BACKUP FIRST (mandatory)
npm run db:backup

# 2. Use safe migration script
npm run migrate:safe -- add-guru-profile-model

# 3. Verify migration applied
npx prisma studio  # Inspect schema visually
```

**Acceptance Criteria:**
- [ ] Database backup created before migration
- [ ] Migration executed successfully
- [ ] `GuruProfile` table exists in database
- [ ] Project table has `currentProfileId` column
- [ ] All indexes created properly
- [ ] No existing data lost

---

## Phase 2: Synthesis Backend

### Task 2.1: Create Profile Synthesis Service

**Description:** Build the core GPT-4o service that transforms natural language into structured profile data.

**Size:** Large

**Priority:** High

**Dependencies:** Task 1.3 (types must exist)

**Technical Requirements:**
- Lazy-load OpenAI client (prevent build-time errors)
- Implement 60-second timeout with AbortController
- Use GPT-4o with JSON mode for reliability
- Temperature 0.3 for consistent extraction
- Return structured result with light areas and project name suggestion

**Implementation Code:**

```typescript
// lib/guruFunctions/profileSynthesizer.ts
import { guruProfileDataSchema, synthesisResultSchema, type SynthesisResult } from './schemas/guruProfileSchema'

const LLM_TIMEOUT_MS = 60000 // 60 second timeout

// Lazy-load OpenAI client
let openaiClient: import('openai').default | null = null

function getOpenAIClient(): import('openai').default {
  if (!openaiClient) {
    const OpenAI = require('openai').default
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient!
}

/**
 * Synthesize a guru profile from natural language brain dump.
 */
export async function synthesizeGuruProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesisResult> {
  const prompt = buildSynthesisPrompt(rawInput, additionalContext)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const openai = getOpenAIClient()

    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: PROFILE_SYNTHESIS_SYSTEM_PROMPT,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low for consistent extraction
        max_tokens: 4096,
      },
      { signal: controller.signal }
    )

    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to synthesize profile: Empty response')
    }

    const parsed = JSON.parse(content)
    return synthesisResultSchema.parse(parsed)
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Profile synthesis timed out. Please try again.')
    }
    throw error
  }
}

const PROFILE_SYNTHESIS_SYSTEM_PROMPT = `You are an expert at understanding teaching visions and extracting structured profile data.

Your task is to transform a natural language description of a teaching guru into a comprehensive structured profile.

You must:
1. Extract all 15 profile fields from the user's description
2. Infer reasonable defaults for fields not explicitly mentioned
3. Identify "light areas" - fields that need more user input
4. Suggest a project name based on the guru's name/domain

Be generous with inference - if someone says "I want to teach chess to beginners," infer:
- Domain: "Chess strategy and tactics"
- Audience level: "beginner"
- Teaching philosophy: Something appropriate for beginners

Always return valid JSON matching the schema.`

function buildSynthesisPrompt(rawInput: string, additionalContext?: string): string {
  const contextSection = additionalContext
    ? `\n\nADDITIONAL CONTEXT (user refinements):\n${additionalContext}`
    : ''

  return `Extract a guru profile from this natural language description.

USER INPUT:
${rawInput}${contextSection}

Return JSON with this exact structure:
{
  "profile": {
    "name": "The guru's name/title (e.g., 'The Backgammon Sage')",
    "tagline": "Brief essence tagline or null",

    "domain": "What the guru teaches",
    "expertiseAreas": ["Area 1", "Area 2"],

    "targetAudience": "Who this guru teaches",
    "audienceLevel": "beginner" | "intermediate" | "advanced" | "mixed",
    "learnerGoals": ["Goal 1", "Goal 2"],

    "teachingPhilosophy": "Core teaching approach",
    "preferredMethods": ["Method 1", "Method 2"],
    "avoidApproaches": ["Approach to avoid"],

    "tone": "formal" | "casual" | "encouraging" | "challenging" | "socratic",
    "communicationStyle": "How the guru communicates",
    "personalityTraits": ["Trait 1", "Trait 2"],

    "uniquePerspective": "What makes this guru special or null",
    "additionalNotes": "Any other context or null"
  },
  "lightAreas": [
    {
      "field": "fieldName",
      "category": "IDENTITY|DOMAIN|AUDIENCE|PEDAGOGY|STYLE|CONTEXT",
      "suggestion": "What to add to flesh out this area"
    }
  ],
  "suggestedProjectName": "Suggested project name based on guru"
}

Guidelines:
- For audienceLevel: "beginner" for novices, "intermediate" for some experience, "advanced" for experts, "mixed" for all levels
- For tone: "encouraging" is warm/supportive, "challenging" pushes learners, "socratic" asks questions, "casual" is conversational, "formal" is professional
- lightAreas should list fields where user didn't provide much info (be helpful, not critical)
- suggestedProjectName should be based on the guru name or domain
- Always populate all fields - infer reasonable defaults when not explicit`
}
```

**Acceptance Criteria:**
- [ ] OpenAI client lazy-loaded (no build-time dependency)
- [ ] 60-second timeout implemented with AbortController
- [ ] Uses GPT-4o model
- [ ] JSON mode enabled for reliable parsing
- [ ] Temperature set to 0.3
- [ ] System prompt guides AI to extract all 15 fields
- [ ] Returns SynthesisResult with profile, lightAreas, suggestedProjectName
- [ ] Handles timeout errors gracefully
- [ ] Validates output with Zod schema

---

### Task 2.2: Create Synthesis Error Handling

**Description:** Implement comprehensive error detection and user-friendly error messages for synthesis failures.

**Size:** Medium

**Priority:** Medium

**Dependencies:** Task 2.1

**Technical Requirements:**
- Define error codes for all failure modes
- Provide clear user-facing messages for each error type
- Detect timeout, JSON parsing, schema validation, API errors
- Return retryable flag for frontend

**Implementation Code:**

```typescript
// lib/guruFunctions/errors.ts

export enum SynthesisErrorCode {
  TIMEOUT = 'SYNTHESIS_TIMEOUT',
  INVALID_JSON = 'INVALID_JSON_RESPONSE',
  SCHEMA_VALIDATION = 'SCHEMA_VALIDATION_FAILED',
  API_ERROR = 'OPENAI_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

export const SYNTHESIS_ERROR_MESSAGES: Record<SynthesisErrorCode, string> = {
  [SynthesisErrorCode.TIMEOUT]:
    'Profile synthesis took too long. Please try a shorter, more focused description.',
  [SynthesisErrorCode.INVALID_JSON]:
    'AI returned unexpected data. Please try again.',
  [SynthesisErrorCode.SCHEMA_VALIDATION]:
    'Generated profile was incomplete. Please add more detail about your guru.',
  [SynthesisErrorCode.API_ERROR]:
    'AI service error. Please try again in a moment.',
  [SynthesisErrorCode.NETWORK_ERROR]:
    'Network connection issue. Please check your connection and try again.',
  [SynthesisErrorCode.RATE_LIMITED]:
    'Too many requests. Please wait a moment before trying again.',
}

export class SynthesisError extends Error {
  constructor(
    public readonly code: SynthesisErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SynthesisError'
  }
}
```

**Enhanced Error Detection in profileSynthesizer.ts:**

```typescript
// Update synthesizeGuruProfile function with enhanced error handling

export async function synthesizeGuruProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesisResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)

  try {
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create(/* ... */)
    clearTimeout(timeoutId)

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new SynthesisError(SynthesisErrorCode.INVALID_JSON, 'Empty response from AI')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new SynthesisError(SynthesisErrorCode.INVALID_JSON, 'AI returned non-JSON response')
    }

    try {
      return synthesisResultSchema.parse(parsed)
    } catch (zodError) {
      throw new SynthesisError(
        SynthesisErrorCode.SCHEMA_VALIDATION,
        `Profile schema validation failed: ${zodError instanceof Error ? zodError.message : 'Unknown error'}`
      )
    }
  } catch (error) {
    clearTimeout(timeoutId)

    // Already a SynthesisError - rethrow
    if (error instanceof SynthesisError) throw error

    // Timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SynthesisError(SynthesisErrorCode.TIMEOUT, 'Synthesis timed out after 60s')
    }

    // OpenAI API errors
    if (error instanceof Error && 'status' in error) {
      const status = (error as { status: number }).status
      if (status === 429) {
        throw new SynthesisError(SynthesisErrorCode.RATE_LIMITED, 'Rate limited by OpenAI')
      }
      throw new SynthesisError(SynthesisErrorCode.API_ERROR, error.message)
    }

    // Network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new SynthesisError(SynthesisErrorCode.NETWORK_ERROR, 'Failed to connect to AI service')
    }

    throw new SynthesisError(SynthesisErrorCode.API_ERROR,
      error instanceof Error ? error.message : 'Unknown error')
  }
}
```

**Acceptance Criteria:**
- [ ] All error codes defined in enum
- [ ] User-friendly messages for each error type
- [ ] SynthesisError class properly extends Error
- [ ] Timeout detection works correctly
- [ ] JSON parsing errors caught
- [ ] Schema validation errors caught
- [ ] API errors (429, 500, etc.) detected
- [ ] Network errors detected

---

### Task 2.3: Create Synthesis API Endpoint

**Description:** Build the API route that accepts brain dump input and returns synthesized profile.

**Size:** Medium

**Priority:** High

**Dependencies:** Tasks 2.1, 2.2

**Technical Requirements:**
- Require authentication
- Validate input length (minimum 10 characters)
- Call synthesis service
- Return structured response with error handling
- Support optional additionalContext for refinement

**Implementation Code:**

```typescript
// app/api/projects/synthesize-guru-profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { synthesizeGuruProfile } from '@/lib/guruFunctions/profileSynthesizer'
import { SynthesisError, SYNTHESIS_ERROR_MESSAGES } from '@/lib/guruFunctions/errors'
import { requireAuth } from '@/lib/auth'

const requestSchema = z.object({
  rawInput: z.string().min(10, 'Please provide more detail about your guru'),
  additionalContext: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rawInput, additionalContext } = requestSchema.parse(body)

    const result = await synthesizeGuruProfile(rawInput, additionalContext)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Profile synthesis error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.errors[0].message,
          retryable: false
        },
        { status: 400 }
      )
    }

    if (error instanceof SynthesisError) {
      return NextResponse.json(
        {
          success: false,
          error: SYNTHESIS_ERROR_MESSAGES[error.code],
          code: error.code,
          retryable: error.code !== 'SCHEMA_VALIDATION_FAILED'
        },
        { status: error.code === 'RATE_LIMITED' ? 429 : 500 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Synthesis failed',
        retryable: true
      },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria:**
- [ ] Endpoint at `/api/projects/synthesize-guru-profile` exists
- [ ] Requires authentication (401 if not logged in)
- [ ] Validates input with Zod schema
- [ ] Calls synthesizeGuruProfile service
- [ ] Returns success response with profile, lightAreas, suggestedProjectName
- [ ] Returns appropriate error codes (400, 401, 429, 500)
- [ ] Includes retryable flag in error responses
- [ ] Logs errors for debugging

---

### Task 2.4: Update Project Creation Endpoint

**Description:** Modify the existing project creation API to accept and save guru profile data.

**Size:** Medium

**Priority:** High

**Dependencies:** Tasks 1.4, 2.1

**Technical Requirements:**
- Accept optional guruProfile and rawBrainDump in request
- Create GuruProfile record in transaction
- Link profile as currentProfile
- Maintain backward compatibility (profile optional)

**Implementation Code:**

```typescript
// Update app/api/projects/route.ts (POST handler)

import { guruProfileDataSchema } from '@/lib/guruFunctions/schemas/guruProfileSchema'

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  guruProfile: guruProfileDataSchema.optional(), // NEW
  rawBrainDump: z.string().optional(),           // NEW
})

// In the POST handler:
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, guruProfile, rawBrainDump } = createProjectSchema.parse(body)

    const project = await prisma.$transaction(async (tx) => {
      // Create project
      const newProject = await tx.project.create({
        data: {
          name,
          description,
          userId: user.id,
        },
      })

      // Create guru profile if provided
      if (guruProfile) {
        const profile = await tx.guruProfile.create({
          data: {
            projectId: newProject.id,
            version: 1,
            profileData: guruProfile,
            rawBrainDump: rawBrainDump || null,
            synthesisMode: 'NEW',
          },
        })

        // Link as current profile
        await tx.project.update({
          where: { id: newProject.id },
          data: { currentProfileId: profile.id },
        })
      }

      return newProject
    })

    return NextResponse.json({
      success: true,
      project
    })
  } catch (error) {
    console.error('Project creation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria:**
- [ ] Endpoint accepts guruProfile and rawBrainDump
- [ ] Creates GuruProfile record when profile provided
- [ ] Links profile as currentProfile using transaction
- [ ] Works without profile (backward compatibility)
- [ ] Returns created project
- [ ] Handles validation errors
- [ ] Transaction ensures atomicity

---

### Task 2.5: Add Unit Tests for Synthesis

**Description:** Create comprehensive unit tests for the profile synthesis service.

**Size:** Medium

**Priority:** Medium

**Dependencies:** Task 2.1

**Technical Requirements:**
- Test comprehensive input handling
- Test minimal input inference
- Test light area detection
- Test project name suggestion
- Test schema validation
- Test timeout handling

**Implementation Code:**

```typescript
// lib/guruFunctions/__tests__/profileSynthesizer.test.ts
describe('synthesizeGuruProfile', () => {
  it('extracts all 15 profile fields from comprehensive input', async () => {
    // Test with rich input covering all fields
  })

  it('infers reasonable defaults from minimal input', async () => {
    // Test with "I want to teach chess to beginners"
  })

  it('identifies light areas when fields are sparse', async () => {
    // Verify lightAreas array populated correctly
  })

  it('suggests project name based on guru name', async () => {
    // Verify suggestedProjectName matches guru identity
  })

  it('validates output against Zod schema', async () => {
    // Ensure malformed responses are rejected
  })

  it('handles timeout gracefully', async () => {
    // Mock slow response, verify timeout error
  })
})

// lib/guruFunctions/__tests__/formatGuruProfile.test.ts
describe('formatGuruProfileForPrompt', () => {
  it('returns empty string for null profile', () => {
    expect(formatGuruProfileForPrompt(null)).toBe('')
  })

  it('includes all non-null profile fields', () => {
    // Verify complete profile formatting
  })

  it('omits null optional fields gracefully', () => {
    // Verify no "null" text in output
  })
})
```

**Acceptance Criteria:**
- [ ] Test file created at correct path
- [ ] All 6 test cases implemented
- [ ] Tests verify comprehensive input extraction
- [ ] Tests verify minimal input inference
- [ ] Tests verify light area detection
- [ ] Tests verify project name suggestion
- [ ] Tests verify schema validation
- [ ] Tests verify timeout handling
- [ ] All tests pass

---

## Phase 3: Onboarding UI

### Task 3.1: Create Speech Recognition Hook

**Description:** Build a React hook that provides voice input capability using the Web Speech API.

**Size:** Medium

**Priority:** Medium

**Dependencies:** None

**Technical Requirements:**
- Check browser support for SpeechRecognition
- Continuous listening with interim results
- Clean start/stop interface
- Transcript accumulation
- Error handling

**Implementation Code:**

```typescript
// hooks/useSpeechRecognition.ts
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface SpeechRecognitionHook {
  isListening: boolean
  transcript: string
  isSupported: boolean
  startListening: () => void
  stopListening: () => void
  resetTranscript: () => void
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    // Check browser support
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (SpeechRecognition) {
      setIsSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript)
        }
      }

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [isListening])

  const resetTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isListening,
    transcript: transcript.trim(),
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  }
}
```

**Acceptance Criteria:**
- [ ] Hook returns isListening, transcript, isSupported, start, stop, reset
- [ ] Browser support detection works
- [ ] Continuous listening enabled
- [ ] Interim results captured
- [ ] Final transcripts accumulated
- [ ] Error handling prevents crashes
- [ ] Cleanup on unmount
- [ ] Works in Chrome/Edge (graceful degradation in others)

---

### Task 3.2: Create Onboarding Modal Component

**Description:** Build the main UI component for the guru profile onboarding flow.

**Size:** Large

**Priority:** High

**Dependencies:** Tasks 2.3, 3.1

**Technical Requirements:**
- Two-step flow: Input → Preview
- Voice and text input support
- Guiding questions display
- Profile preview by category
- Light areas warning
- Refinement input
- Project name editing
- Loading states and error handling

**Implementation Code:**

```typescript
// app/projects/GuruProfileOnboardingModal.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import type { GuruProfileData, SynthesisResult } from '@/lib/guruFunctions/schemas/guruProfileSchema'

type Step = 'input' | 'preview'

interface Props {
  isOpen: boolean
  onClose: () => void
}

// Guiding questions to display alongside textarea
const GUIDING_QUESTIONS = [
  "What subject or skill will your guru teach?",
  "Who is the target audience? (beginners, experts, etc.)",
  "What's the teaching philosophy? (principles-first, hands-on, etc.)",
  "What tone should the guru use? (encouraging, challenging, etc.)",
  "What makes this guru unique or special?",
]

export function GuruProfileOnboardingModal({ isOpen, onClose }: Props) {
  const router = useRouter()

  // Step state
  const [step, setStep] = useState<Step>('input')

  // Input state
  const [rawInput, setRawInput] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // Synthesis state
  const [result, setResult] = useState<SynthesisResult | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Project name (auto-suggested, editable)
  const [projectName, setProjectName] = useState('')

  // Voice input
  const {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition()

  // Sync voice transcript to input
  useEffect(() => {
    if (transcript) {
      setRawInput(prev => prev + (prev ? ' ' : '') + transcript)
      resetTranscript()
    }
  }, [transcript, resetTranscript])

  // Update project name when synthesis suggests one
  useEffect(() => {
    if (result?.suggestedProjectName) {
      setProjectName(result.suggestedProjectName)
    }
  }, [result])

  const handleSynthesize = async () => {
    if (!rawInput.trim() || rawInput.length < 20) {
      setError('Please describe your guru in more detail (at least a few sentences)')
      return
    }

    setSynthesizing(true)
    setError('')

    try {
      const context = step === 'preview' ? additionalContext : undefined
      const inputToUse = step === 'preview' && result
        ? `Previous profile:\n${JSON.stringify(result.profile, null, 2)}\n\nOriginal input:\n${rawInput}`
        : rawInput

      const response = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: inputToUse, additionalContext: context }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Synthesis failed')
      }

      const data = await response.json()
      setResult(data)
      setAdditionalContext('')
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed')
    } finally {
      setSynthesizing(false)
    }
  }

  const handleSave = async () => {
    if (!result || !projectName.trim()) return

    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          guruProfile: result.profile,
          rawBrainDump: rawInput,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Failed to create project')
      }

      const { project } = await response.json()
      router.push(`/projects/${project.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {step === 'input' ? 'Define Your Guru' : 'Review Your Guru Profile'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'input'
                ? 'Describe the teaching guru you want to create'
                : 'Review and refine before creating your project'
              }
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded bg-red-50 border border-red-200 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Step 1: Input */}
        {step === 'input' && (
          <>
            {/* Guiding Questions */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm font-medium text-blue-800 mb-2">
                Consider these questions as you describe your guru:
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                {GUIDING_QUESTIONS.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {/* Input Textarea with Voice */}
            <div className="relative mb-4">
              <textarea
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="I want to create a guru that teaches backgammon to intermediate players. It should have a patient, analytical personality and focus on understanding principles rather than memorizing moves. The teaching style should be encouraging but also challenge students to think critically..."
                rows={8}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {isSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`absolute right-3 top-3 p-2 rounded-full transition-colors ${
                    isListening
                      ? 'bg-red-100 text-red-600 animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={isListening ? 'Stop recording' : 'Start voice input'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                </button>
              )}
            </div>

            {isListening && (
              <p className="text-sm text-blue-600 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                Listening... speak now
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSynthesize}
                disabled={synthesizing || rawInput.length < 20}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {synthesizing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Generating Profile...
                  </>
                ) : (
                  'Generate Profile →'
                )}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Preview */}
        {step === 'preview' && result && (
          <>
            {/* Project Name Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Profile Preview */}
            <div className="border rounded-lg divide-y mb-4">
              <ProfileSection title="Identity">
                <ProfileField label="Name" value={result.profile.name} />
                <ProfileField label="Tagline" value={result.profile.tagline} />
              </ProfileSection>

              <ProfileSection title="Domain">
                <ProfileField label="Domain" value={result.profile.domain} />
                <ProfileField label="Expertise" value={result.profile.expertiseAreas.join(', ')} />
              </ProfileSection>

              <ProfileSection title="Audience">
                <ProfileField label="Target Audience" value={result.profile.targetAudience} />
                <ProfileField label="Level" value={result.profile.audienceLevel} />
                <ProfileField label="Goals" value={result.profile.learnerGoals.join(', ')} />
              </ProfileSection>

              <ProfileSection title="Pedagogy">
                <ProfileField label="Philosophy" value={result.profile.teachingPhilosophy} />
                <ProfileField label="Methods" value={result.profile.preferredMethods.join(', ')} />
                {result.profile.avoidApproaches.length > 0 && (
                  <ProfileField label="Avoid" value={result.profile.avoidApproaches.join(', ')} />
                )}
              </ProfileSection>

              <ProfileSection title="Style">
                <ProfileField label="Tone" value={result.profile.tone} />
                <ProfileField label="Communication" value={result.profile.communicationStyle} />
                <ProfileField label="Traits" value={result.profile.personalityTraits.join(', ')} />
              </ProfileSection>

              {(result.profile.uniquePerspective || result.profile.additionalNotes) && (
                <ProfileSection title="Context">
                  {result.profile.uniquePerspective && (
                    <ProfileField label="Unique Perspective" value={result.profile.uniquePerspective} />
                  )}
                  {result.profile.additionalNotes && (
                    <ProfileField label="Notes" value={result.profile.additionalNotes} />
                  )}
                </ProfileSection>
              )}
            </div>

            {/* Light Areas Warning */}
            {result.lightAreas.length > 0 && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Some areas could use more detail:
                </p>
                <ul className="text-sm text-amber-700 space-y-1">
                  {result.lightAreas.map((area, i) => (
                    <li key={i}>
                      <strong>{area.category}:</strong> {area.suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Refinement Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add more context to refine the profile (optional)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Add any additional details to improve the profile..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              <div className="flex gap-3">
                {additionalContext.trim() && (
                  <button
                    onClick={handleSynthesize}
                    disabled={synthesizing}
                    className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    {synthesizing ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving || !projectName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Helper components
function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}:</span>{' '}
      <span className="text-sm text-gray-900">{value || <em className="text-gray-400">Not specified</em>}</span>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal opens when isOpen prop is true
- [ ] Step 1 shows guiding questions
- [ ] Textarea accepts input
- [ ] Voice button visible only when supported
- [ ] Voice input appends to textarea
- [ ] Generate Profile button validates input
- [ ] Step 2 shows profile preview in 5 categories
- [ ] Project name input auto-populated from suggestion
- [ ] Light areas warning displayed when present
- [ ] Refinement textarea allows additional context
- [ ] Regenerate button appears when refinement entered
- [ ] Create Project saves and redirects
- [ ] Error messages displayed in red banner
- [ ] Loading states show during synthesis/save

---

### Task 3.3: Update Create Project Button

**Description:** Modify the existing CreateProjectButton to use the new onboarding modal.

**Size:** Small

**Priority:** High

**Dependencies:** Task 3.2

**Technical Requirements:**
- Replace old project creation flow
- Open GuruProfileOnboardingModal on click
- No skip option (profile required)

**Implementation Code:**

```typescript
// app/projects/CreateProjectButton.tsx

'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GuruProfileOnboardingModal } from './GuruProfileOnboardingModal'

export function CreateProjectButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New Project
      </Button>

      <GuruProfileOnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        // No "onSkip" prop - profile is required
      />
    </>
  )
}
```

**Acceptance Criteria:**
- [ ] Button opens GuruProfileOnboardingModal
- [ ] Modal closes when user cancels
- [ ] Modal closes after successful project creation
- [ ] No skip/bypass option available
- [ ] Old project creation flow removed

---

### Task 3.4: Add E2E Tests for Onboarding

**Description:** Create Playwright tests for the complete onboarding flow.

**Size:** Medium

**Priority:** Medium

**Dependencies:** Task 3.3

**Technical Requirements:**
- Test full happy path from click to project creation
- Test voice input (if browser supports)
- Test refinement flow
- Test light areas display
- Test error handling

**Implementation Code:**

```typescript
// e2e/guru-profile-onboarding.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Guru Profile Onboarding', () => {
  test('creates project with synthesized profile', async ({ page }) => {
    // Purpose: Verify complete happy path from brain dump to project creation
    await page.goto('/projects')
    await page.click('button:has-text("New Project")')

    // Fill brain dump
    await page.fill('textarea', 'I want to create a guru that teaches backgammon...')
    await page.click('button:has-text("Generate Profile")')

    // Wait for synthesis
    await expect(page.locator('text=Review Your Guru Profile')).toBeVisible({ timeout: 70000 })

    // Verify profile preview
    await expect(page.locator('text=Identity')).toBeVisible()

    // Create project
    await page.click('button:has-text("Create Project")')

    // Verify redirect to project page
    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+/)
  })

  test('voice input appends to textarea', async ({ page }) => {
    // Purpose: Verify voice integration works in supported browsers
    // Note: May need to mock SpeechRecognition API
  })

  test('refinement regenerates profile', async ({ page }) => {
    // Purpose: Verify iterative refinement flow
  })

  test('light areas prompt for more detail', async ({ page }) => {
    // Purpose: Verify light areas warning displayed
  })
})
```

**Acceptance Criteria:**
- [ ] Test file created at e2e/guru-profile-onboarding.spec.ts
- [ ] Happy path test completes successfully
- [ ] Test handles 60+ second synthesis timeout
- [ ] Profile preview verification works
- [ ] Project creation and redirect verified
- [ ] Tests clean up created projects

---

## Phase 4: Prompt Integration

### Task 4.1: Create Profile Formatting Utility

**Description:** Build utility function that formats guru profile for injection into prompts.

**Size:** Small

**Priority:** High

**Dependencies:** Task 1.3

**Technical Requirements:**
- Return empty string for null profile (backward compatibility)
- Format profile as markdown sections
- Include all non-null fields
- Omit null optional fields gracefully
- Add clear instruction to AI about using profile

**Implementation Code:**

```typescript
// lib/guruFunctions/formatGuruProfile.ts
import type { GuruProfileData } from './schemas/guruProfileSchema'

/**
 * Format guru profile for injection into artifact generation prompts.
 * Returns empty string if no profile, enabling backward compatibility.
 */
export function formatGuruProfileForPrompt(profile: GuruProfileData | null): string {
  if (!profile) return ''

  const lines = [
    '## GURU IDENTITY',
    '',
    `You are creating teaching content for **${profile.name}**${profile.tagline ? ` - "${profile.tagline}"` : ''}.`,
    '',
    '### Domain',
    `**Subject:** ${profile.domain}`,
    `**Expertise Areas:** ${profile.expertiseAreas.join(', ')}`,
    '',
    '### Target Audience',
    `**Who:** ${profile.targetAudience}`,
    `**Level:** ${profile.audienceLevel}`,
    `**Learner Goals:**`,
    ...profile.learnerGoals.map(g => `- ${g}`),
    '',
    '### Teaching Approach',
    `**Philosophy:** ${profile.teachingPhilosophy}`,
    `**Preferred Methods:** ${profile.preferredMethods.join(', ')}`,
  ]

  if (profile.avoidApproaches.length > 0) {
    lines.push(`**Avoid:** ${profile.avoidApproaches.join(', ')}`)
  }

  lines.push(
    '',
    '### Communication Style',
    `**Tone:** ${profile.tone}`,
    `**Style:** ${profile.communicationStyle}`,
    `**Personality:** ${profile.personalityTraits.join(', ')}`,
  )

  if (profile.uniquePerspective) {
    lines.push('', `**Unique Perspective:** ${profile.uniquePerspective}`)
  }

  if (profile.additionalNotes) {
    lines.push('', `**Additional Context:** ${profile.additionalNotes}`)
  }

  lines.push(
    '',
    '---',
    '',
    '**IMPORTANT:** All teaching content must align with this guru\'s identity, pedagogy, and communication style.',
    ''
  )

  return lines.join('\n')
}
```

**Acceptance Criteria:**
- [ ] Returns empty string for null profile
- [ ] Formats profile as readable markdown
- [ ] Includes all 15 fields
- [ ] Omits null optional fields (no "null" text)
- [ ] Includes clear instruction to AI
- [ ] Works with partial profiles

---

### Task 4.2: Update Generator Types

**Description:** Add guruProfile parameter to GeneratorOptions interface.

**Size:** Small

**Priority:** High

**Dependencies:** Task 1.3

**Technical Requirements:**
- Import GuruProfileData type
- Add optional guruProfile field to GeneratorOptions
- Maintain backward compatibility

**Implementation Code:**

```typescript
// lib/guruFunctions/types.ts
import type { GuruProfileData } from './schemas/guruProfileSchema'

export interface GeneratorOptions {
  contextLayers: { title: string; content: string }[]
  knowledgeFiles: { title: string; content: string }[]
  domain: string
  userNotes?: string
  customSystemPrompt?: string
  customUserPromptTemplate?: string
  guruProfile?: GuruProfileData | null  // NEW
}
```

**Acceptance Criteria:**
- [ ] GuruProfileData type imported
- [ ] guruProfile field added to GeneratorOptions
- [ ] Field is optional (nullable)
- [ ] Backward compatibility maintained

---

### Task 4.3: Update Mental Model Prompt

**Description:** Inject guru profile into Mental Model generation prompts.

**Size:** Medium

**Priority:** High

**Dependencies:** Tasks 4.1, 4.2

**Technical Requirements:**
- Add guruProfile parameter to buildMentalModelPrompt
- Call formatGuruProfileForPrompt
- Inject profile section at top of prompt
- Handle null profile gracefully

**Implementation Code:**

```typescript
// lib/guruFunctions/prompts/mentalModelPrompt.ts
import { formatGuruProfileForPrompt } from '../formatGuruProfile'
import type { GuruProfileData } from '../schemas/guruProfileSchema'

interface MentalModelPromptParams {
  domain: string
  corpusSummary: string
  corpusWordCount: number
  userNotes?: string
  guruProfile?: GuruProfileData | null  // NEW
}

export function buildMentalModelPrompt(params: MentalModelPromptParams): string {
  const { domain, corpusSummary, corpusWordCount, userNotes, guruProfile } = params

  // Guru profile section (empty string if no profile)
  const guruProfileSection = formatGuruProfileForPrompt(guruProfile || null)

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\nThe user has provided these additional notes:\n${userNotes}\n\nIntegrate this guidance into your design process and final output.\n`
    : ''

  return `
# TASK: Design Mental Model for ${domain}

${guruProfileSection}
You are designing the foundational mental model that will guide all teaching of ${domain}. This mental model must transform novices who see surface features into principle-driven thinkers who recognize deep structure.

---

## DESIGN PROTOCOL (Required)
// ... rest of existing prompt ...
`.trim()
}
```

**Acceptance Criteria:**
- [ ] guruProfile parameter added
- [ ] formatGuruProfileForPrompt called
- [ ] Profile section injected at top
- [ ] Works with null profile (empty string)
- [ ] Existing prompt structure preserved

---

### Task 4.4: Update Curriculum Prompt

**Description:** Inject guru profile into Curriculum generation prompts.

**Size:** Medium

**Priority:** High

**Dependencies:** Tasks 4.1, 4.2

**Technical Requirements:**
- Add guruProfile parameter to buildCurriculumPrompt
- Call formatGuruProfileForPrompt
- Inject profile section at top of prompt
- Handle null profile gracefully

**Implementation Code:**

```typescript
// lib/guruFunctions/prompts/curriculumPrompt.ts
import { formatGuruProfileForPrompt } from '../formatGuruProfile'
import type { GuruProfileData } from '../schemas/guruProfileSchema'

interface CurriculumPromptParams {
  domain: string
  mentalModel: MentalModelOutput
  userNotes?: string
  guruProfile?: GuruProfileData | null  // NEW
}

export function buildCurriculumPrompt(params: CurriculumPromptParams): string {
  const { domain, mentalModel, userNotes, guruProfile } = params

  // Guru profile section (empty string if no profile)
  const guruProfileSection = formatGuruProfileForPrompt(guruProfile || null)

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : ''

  return `
# TASK: Design Curriculum for ${domain}

${guruProfileSection}
You are designing a comprehensive curriculum based on the mental model below.

---

## DESIGN PROTOCOL (Required)
// ... rest of existing prompt ...
`.trim()
}
```

**Acceptance Criteria:**
- [ ] guruProfile parameter added
- [ ] formatGuruProfileForPrompt called
- [ ] Profile section injected at top
- [ ] Works with null profile (empty string)
- [ ] Existing prompt structure preserved

---

### Task 4.5: Update Drill Series Prompt

**Description:** Inject guru profile into Drill Series generation prompts.

**Size:** Medium

**Priority:** High

**Dependencies:** Tasks 4.1, 4.2

**Technical Requirements:**
- Add guruProfile parameter to buildDrillDesignerPrompt
- Call formatGuruProfileForPrompt
- Inject profile section at top of prompt
- Handle null profile gracefully

**Implementation Code:**

```typescript
// lib/guruFunctions/prompts/drillDesignerPrompt.ts
import { formatGuruProfileForPrompt } from '../formatGuruProfile'
import type { GuruProfileData } from '../schemas/guruProfileSchema'

interface DrillDesignerPromptParams {
  domain: string
  curriculum: CurriculumOutput
  userNotes?: string
  guruProfile?: GuruProfileData | null  // NEW
}

export function buildDrillDesignerPrompt(params: DrillDesignerPromptParams): string {
  const { domain, curriculum, userNotes, guruProfile } = params

  // Guru profile section (empty string if no profile)
  const guruProfileSection = formatGuruProfileForPrompt(guruProfile || null)

  const userNotesSection = userNotes
    ? `\n## USER GUIDANCE\n\n${userNotes}\n`
    : ''

  return `
# TASK: Design Drill Series for ${domain}

${guruProfileSection}
You are designing a comprehensive drill series based on the curriculum below.

---

## DESIGN PROTOCOL (Required)
// ... rest of existing prompt ...
`.trim()
}
```

**Acceptance Criteria:**
- [ ] guruProfile parameter added
- [ ] formatGuruProfileForPrompt called
- [ ] Profile section injected at top
- [ ] Works with null profile (empty string)
- [ ] Existing prompt structure preserved

---

### Task 4.6: Update Inngest Jobs to Pass Profile

**Description:** Modify all three Inngest jobs (Mental Model, Curriculum, Drill Series) to fetch and pass guru profile.

**Size:** Large

**Priority:** High

**Dependencies:** Tasks 4.3, 4.4, 4.5

**Technical Requirements:**
- Include currentProfile in project fetch
- Extract profileData as GuruProfileData
- Pass profile to generator functions
- Handle null profile gracefully

**Implementation Code:**

```typescript
// lib/inngest-functions.ts

// Mental Model Job Update
const project = await step.run('fetch-project', async () => {
  return await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      contextLayers: { where: { isActive: true }, orderBy: { priority: 'asc' } },
      knowledgeFiles: { where: { isActive: true } },
      currentProfile: true,  // NEW: Include current profile
    },
  })
})

// Pass profile to generator:
result = await step.run('generate-mental-model', async () => {
  return await generateMentalModel({
    projectId,
    contextLayers: project.contextLayers.map(l => ({ title: l.title, content: l.content })),
    knowledgeFiles: project.knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
    domain: project.name,
    userNotes,
    customSystemPrompt: prompts.isCustomSystem ? prompts.systemPrompt : undefined,
    customUserPromptTemplate: prompts.isCustomUser ? prompts.userPromptTemplate ?? undefined : undefined,
    guruProfile: project.currentProfile?.profileData as GuruProfileData | null,  // NEW
  })
})

// Repeat similar changes for Curriculum and Drill Series jobs
```

**Acceptance Criteria:**
- [ ] All three Inngest jobs updated
- [ ] currentProfile included in fetch
- [ ] profileData extracted and typed
- [ ] Profile passed to generator functions
- [ ] Null profile handled gracefully
- [ ] No build errors
- [ ] Existing projects without profiles still work

---

### Task 4.7: Add Integration Tests for Prompt Injection

**Description:** Create comprehensive tests verifying guru profile is correctly injected into all artifact types.

**Size:** Medium

**Priority:** Medium

**Dependencies:** Task 4.6

**Technical Requirements:**
- Test Mental Model prompt injection
- Test Curriculum prompt injection
- Test Drill Series prompt injection
- Test backward compatibility (null profile)
- Test artifact generation without profile

**Implementation Code:**

```typescript
// lib/guruFunctions/__tests__/promptIntegration.test.ts
describe('Guru Profile Prompt Injection', () => {
  const mockProfile: GuruProfileData = {
    name: 'The Backgammon Sage',
    tagline: 'Master the game through principles',
    domain: 'Backgammon strategy and tactics',
    expertiseAreas: ['Opening theory', 'Cube decisions', 'Endgame technique'],
    targetAudience: 'Intermediate players seeking tournament readiness',
    audienceLevel: 'intermediate',
    learnerGoals: ['Consistent money game wins', 'Tournament qualification'],
    teachingPhilosophy: 'Principles over memorization',
    preferredMethods: ['Pattern recognition', 'Position analysis'],
    avoidApproaches: ['Rote memorization without understanding'],
    tone: 'encouraging',
    communicationStyle: 'Patient and analytical with clear explanations',
    personalityTraits: ['Patient', 'Analytical', 'Supportive'],
    uniquePerspective: 'Former tournament champion with 20 years experience',
    additionalNotes: null,
  }

  it('injects guru profile into Mental Model prompt', async () => {
    // Purpose: Verify profile is correctly included in mental model generation
    const prompt = buildMentalModelPrompt({
      domain: 'Backgammon',
      corpusSummary: 'Sample corpus',
      corpusWordCount: 1000,
      guruProfile: mockProfile,
    })

    expect(prompt).toContain('## GURU IDENTITY')
    expect(prompt).toContain('**The Backgammon Sage**')
    expect(prompt).toContain('Principles over memorization')
    expect(prompt).toContain('encouraging')
  })

  it('injects guru profile into Curriculum prompt', async () => {
    // Purpose: Verify profile is correctly included in curriculum generation
    const prompt = buildCurriculumPrompt({
      domain: 'Backgammon',
      mentalModel: mockMentalModel,
      guruProfile: mockProfile,
    })

    expect(prompt).toContain('## GURU IDENTITY')
    expect(prompt).toContain('intermediate')
    expect(prompt).toContain('Tournament qualification')
  })

  it('injects guru profile into Drill Series prompt', async () => {
    // Purpose: Verify profile is correctly included in drill generation
    const prompt = buildDrillDesignerPrompt({
      domain: 'Backgammon',
      curriculum: mockCurriculum,
      guruProfile: mockProfile,
    })

    expect(prompt).toContain('## GURU IDENTITY')
    expect(prompt).toContain('Patient and analytical')
  })

  it('returns empty string for null profile (backward compat)', () => {
    // Purpose: Verify existing projects without profiles still work
    const formatted = formatGuruProfileForPrompt(null)
    expect(formatted).toBe('')
  })

  it('artifact generation succeeds without profile', async () => {
    // Purpose: Verify backward compatibility with existing projects
    const project = await prisma.project.create({
      data: { name: 'Legacy Project', userId: testUser.id }
      // No currentProfileId - simulates pre-feature project
    })

    // Should not throw, should generate artifact without guru context
    const result = await generateMentalModel({
      projectId: project.id,
      contextLayers: [],
      knowledgeFiles: [],
      domain: project.name,
      guruProfile: null, // Explicitly null
    })

    expect(result.content).toBeDefined()
    // Prompt should NOT contain guru identity section
    expect(result.userPrompt).not.toContain('## GURU IDENTITY')
  })
})
```

**Acceptance Criteria:**
- [ ] Test file created at correct path
- [ ] Mock profile data matches schema
- [ ] Mental Model injection verified
- [ ] Curriculum injection verified
- [ ] Drill Series injection verified
- [ ] Null profile returns empty string
- [ ] Artifact generation works without profile
- [ ] All tests pass

---

## Summary

**Total Tasks:** 21

### By Phase:
- **Phase 1 (Database Foundation):** 4 tasks
- **Phase 2 (Synthesis Backend):** 5 tasks
- **Phase 3 (Onboarding UI):** 4 tasks
- **Phase 4 (Prompt Integration):** 7 tasks

### By Size:
- **Small:** 6 tasks
- **Medium:** 10 tasks
- **Large:** 3 tasks

### By Priority:
- **High:** 14 tasks
- **Medium:** 6 tasks
- **Low:** 0 tasks

### Critical Path:
1. Phase 1 (Database) must complete before Phase 2 can start
2. Phase 2 (Backend) must complete before Phase 3 can start
3. Phase 4 (Prompts) can start after Phase 1 completes
4. Full feature complete when all phases done

### Estimated Timeline:
- **Phase 1:** 1-2 days
- **Phase 2:** 2-3 days
- **Phase 3:** 2-3 days
- **Phase 4:** 2-3 days
- **Total:** 7-11 days (depending on parallelization)

---

## Notes

- All code examples are copied directly from the specification
- Tasks include full acceptance criteria for verification
- Backward compatibility maintained throughout (existing projects work without profiles)
- Error handling comprehensive across all phases
- Testing strategy covers unit, integration, and E2E levels
