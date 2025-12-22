# Teaching Pipeline Developer Guide

**Created:** 2025-12-16
**Purpose:** Understanding the Mental Model → Curriculum → Drill Series generation pipeline

---

## Overview

The Teaching Pipeline is a three-stage artifact generation system that creates structured teaching content:

```
Mental Model → Curriculum → Drill Series
     ↓              ↓             ↓
  Foundation    Structure     Practice
```

Each stage depends on the previous, forming a pedagogical hierarchy.

---

## Pipeline Architecture

### Stage 1: Mental Model

**Purpose:** Define the foundational concepts and thinking patterns for a domain.

**Output Structure:**
```typescript
interface MentalModelOutput {
  title: string;
  introduction: string;
  coreFramework: {
    principles: Principle[];
    concepts: Concept[];
  };
  thinkingPatterns: ThinkingPattern[];
  commonMistakes: Mistake[];
  progressionPath: ProgressionLevel[];
}
```

**Generation:**
- Triggered by `guru/mental-model.generate` event
- Uses project corpus (context layers + knowledge files)
- Optionally includes Guru Profile for personality/pedagogy injection
- No dependencies on other artifacts

### Stage 2: Curriculum

**Purpose:** Structure learning progression based on the mental model.

**Output Structure:**
```typescript
interface CurriculumOutput {
  title: string;
  overview: string;
  modules: Module[];       // Ordered learning units
  assessmentStrategy: AssessmentStrategy;
  learningObjectives: Objective[];
}
```

**Generation:**
- Triggered by `guru/curriculum.generate` event
- **Requires:** Mental Model artifact
- References mental model principles to structure modules
- Optionally verified against ground truth engine

### Stage 3: Drill Series

**Purpose:** Create practice exercises that reinforce curriculum concepts.

**Output Structure:**
```typescript
interface DrillSeriesOutput {
  title: string;
  overview: string;
  drills: Drill[];         // Individual practice exercises
  progressionLogic: string;
}
```

**Generation:**
- Triggered by `guru/drill-series.generate` event
- **Requires:** Curriculum artifact
- Uses Position Library for scenario-based drills (if ground truth enabled)
- Most complex generation with verification and position seeding

---

## Dependency Chain

```
                    ┌─────────────────┐
                    │   Guru Profile  │ (optional)
                    │    (persona)    │
                    └────────┬────────┘
                             │ injected into prompts
                             ▼
┌─────────────┐     ┌─────────────────┐
│   Corpus    │────▶│  Mental Model   │
│ (knowledge) │     │   Generation    │
└─────────────┘     └────────┬────────┘
                             │ depends on
                             ▼
                    ┌─────────────────┐
                    │   Curriculum    │
                    │   Generation    │
                    └────────┬────────┘
                             │ depends on
                             ▼
                    ┌─────────────────┐     ┌─────────────────┐
                    │  Drill Series   │◀────│ Position Library│
                    │   Generation    │     │   (scenarios)   │
                    └─────────────────┘     └─────────────────┘
```

---

## Key Files

### Inngest Functions
- `lib/inngest-functions.ts` - All three generation jobs defined here
  - Lines ~390-480: Mental Model generation
  - Lines ~500-680: Curriculum generation
  - Lines ~700-950: Drill Series generation

### Generators
- `lib/guruFunctions/generators/mentalModelGenerator.ts`
- `lib/guruFunctions/generators/curriculumGenerator.ts`
- `lib/guruFunctions/generators/drillDesigner.ts`

### Prompts
- `lib/guruFunctions/prompts/mentalModelPrompt.ts`
- `lib/guruFunctions/prompts/curriculumPrompt.ts`
- `lib/guruFunctions/prompts/drillDesignerPrompt.ts`

### Schemas (Zod + OpenAI Structured Output)
- `lib/guruFunctions/schemas/mentalModelSchema.ts`
- `lib/guruFunctions/schemas/curriculumSchema.ts`
- `lib/guruFunctions/schemas/drillSeriesSchema.ts`

### UI Components
- `components/guru/GuruTeachingManager.tsx` - Main dashboard
- `components/guru/FullWidthProgressTracker.tsx` - Progress during generation
- `components/artifacts/` - Artifact viewers

---

## Generation Flow (Detailed)

### 1. Trigger Generation

From UI (`GuruTeachingManager.tsx`):
```typescript
const response = await fetch(`/api/projects/${projectId}/guru/generate`, {
  method: 'POST',
  body: JSON.stringify({
    type: 'MENTAL_MODEL', // or 'CURRICULUM', 'DRILL_SERIES'
    userNotes: 'Optional guidance'
  })
});
```

### 2. API Creates Placeholder Artifact

```typescript
// app/api/projects/[id]/guru/generate/route.ts
const artifact = await prisma.guruArtifact.create({
  data: {
    projectId,
    type,
    status: 'PENDING',
    version: nextVersion,
    // ... other fields
  }
});

// Send event to Inngest
await inngest.send({
  name: `guru/${type.toLowerCase().replace('_', '-')}.generate`,
  data: { projectId, artifactId: artifact.id, userNotes }
});
```

### 3. Inngest Job Executes

```typescript
// lib/inngest-functions.ts
export const mentalModelGeneration = inngest.createFunction(
  { id: 'guru-builder/mental-model-generation', retries: 2 },
  { event: 'guru/mental-model.generate' },
  async ({ event, step }) => {
    const { projectId, artifactId, userNotes } = event.data;

    // Step 1: Update status to GENERATING
    await step.run('update-status', async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: { status: 'GENERATING' }
      });
    });

    // Step 2: Fetch project data
    const project = await step.run('fetch-project', async () => {
      return prisma.project.findUnique({
        where: { id: projectId },
        include: {
          contextLayers: { where: { isActive: true } },
          knowledgeFiles: { where: { isActive: true } },
          currentProfile: true
        }
      });
    });

    // Step 3: Generate content
    const result = await step.run('generate', async () => {
      return generateMentalModel({
        projectId,
        contextLayers: project.contextLayers,
        knowledgeFiles: project.knowledgeFiles,
        domain: project.name,
        userNotes,
        guruProfile: project.currentProfile?.profileData
      });
    });

    // Step 4: Save artifact
    await step.run('save', async () => {
      await prisma.guruArtifact.update({
        where: { id: artifactId },
        data: {
          status: 'COMPLETED',
          content: result.data,
          generatedAt: new Date()
        }
      });
    });
  }
);
```

### 4. Progress Tracking

During generation, `progressStage` is updated:

```typescript
// Progress stages per artifact type
const MENTAL_MODEL_PHASES = [
  'ANALYZING_CORPUS',
  'GENERATING_FRAMEWORK',
  'FINALIZING'
];

const CURRICULUM_PHASES = [
  'LOADING_DEPENDENCIES',
  'GENERATING_STRUCTURE',
  'VERIFYING_CONTENT',  // If ground truth enabled
  'FINALIZING'
];

const DRILL_SERIES_PHASES = [
  'LOADING_DEPENDENCIES',
  'SEEDING_POSITIONS',   // If position library enabled
  'GENERATING_DRILLS',
  'VERIFYING_CONTENT',   // If ground truth enabled
  'FINALIZING'
];
```

---

## Ground Truth Integration

When ground truth is enabled for a project:

1. **Curriculum**: Claims are extracted and verified
2. **Drill Series**: Position analysis verified against engine

```typescript
// In inngest-functions.ts
if (gtConfig?.enabled) {
  // Extract verifiable claims
  const claims = extractVerifiableClaims(result.data);

  // Verify each claim against ground truth engine
  for (const claim of claims) {
    const verification = await verifyClaimAgainstEngine(claim, gtConfig);
    // Update verification status
  }
}
```

---

## Guru Profile Injection

The Guru Profile (persona) is injected into ALL generation prompts:

```typescript
// lib/guruProfile/promptFormatter.ts
export function formatGuruProfileForPrompt(profile: GuruProfileData | null): string {
  if (!profile) return '';

  return `
## GURU IDENTITY

You are creating teaching content for **${profile.name}**...

### Teaching Approach
**Philosophy:** ${profile.teachingPhilosophy}
**Tone:** ${profile.tone}
...
`;
}
```

This ensures all artifacts maintain consistent personality and pedagogy.

---

## Error Handling

### Common Failure Points

1. **Schema Validation** (`ZodError`)
   - GPT returned malformed JSON
   - Missing required fields
   - Check Inngest logs for specific field

2. **Dependency Missing**
   - Curriculum requires Mental Model
   - Drill Series requires Curriculum
   - Error: "Dependency artifact not found"

3. **Rate Limiting** (429)
   - Too many concurrent generations
   - Inngest automatically retries with backoff

4. **Token Limits**
   - Very large corpus can exceed context window
   - Consider chunking or summarization

### Recovery Pattern

Failed artifacts can be regenerated:
```typescript
// API allows regeneration by creating new version
await fetch(`/api/projects/${projectId}/guru/generate`, {
  method: 'POST',
  body: JSON.stringify({ type: 'DRILL_SERIES' })
});
// Creates version N+1, doesn't modify failed version
```

---

## Testing the Pipeline

### Manual Testing

1. **Start servers:**
   ```bash
   PORT=3002 npm run dev
   npx inngest-cli dev  # Separate terminal
   ```

2. **Create test project** with corpus

3. **Generate Mental Model:**
   - Click "Generate" on Mental Model tile
   - Watch Inngest UI for run status
   - Verify artifact appears in UI

4. **Generate Curriculum:**
   - Requires Mental Model to be COMPLETED
   - Click "Generate" on Curriculum tile

5. **Generate Drill Series:**
   - Requires Curriculum to be COMPLETED
   - Enable Ground Truth for verification
   - Watch for position seeding and verification steps

### Monitoring

Use the Inngest monitoring script:
```bash
./scripts/inngest-monitor.sh 5
```

See `developer-guides/07-inngest-monitoring-protocol.md` for full details.

---

## Related Documentation

- `developer-guides/09-drill-series-generation-guide.md` - Deep dive into drill generation
- `developer-guides/10-position-library-guide.md` - Position seeding for scenarios
- `developer-guides/11-ground-truth-engine-guide.md` - Verification integration
- `lib/teaching/constants.ts` - Phase definitions and artifact types
