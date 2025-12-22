# Profile Synthesizer Implementation Report

**Task:** STM Tasks 78-79 - Create Profile Synthesizer Service with Error Handling
**Status:** ✅ Complete
**File:** `/lib/guruProfile/synthesizer.ts`
**Lines of Code:** ~370

---

## Implementation Summary

The Profile Synthesizer Service transforms natural language brain dumps into structured `GuruProfileData` using GPT-4o with comprehensive error handling and confidence tracking.

### Key Features

✅ **Lazy-loaded OpenAI Client** - Build-safe pattern matching existing generators
✅ **60-Second Timeout** - AbortController prevents hanging requests
✅ **Light Areas Detection** - Identifies fields inferred with low confidence
✅ **Comprehensive Error Handling** - 6 error types with retry classification
✅ **Structured Error Class** - `SynthesisError` with error codes and retry flags
✅ **Type-Safe Validation** - Zod schema validation for all outputs
✅ **Detailed System Prompt** - 15-field schema explanation with examples

---

## Public API

### Main Function

```typescript
export async function synthesizeGuruProfile(
  rawInput: string,
  additionalContext?: string
): Promise<SynthesisResult>
```

**Parameters:**
- `rawInput` - Natural language brain dump (voice or text)
- `additionalContext` - Optional refinement context for regeneration

**Returns:** `SynthesisResult` containing:
- `profile` - Complete 15-field `GuruProfileData`
- `lightAreas` - Field names inferred with low confidence
- `confidence` - Overall synthesis quality (0-1)
- `rawInput` - Original input (for traceability)
- `synthesisMode` - Input mode ('TEXT', 'VOICE', 'MIXED')

**Throws:** `SynthesisError` on failures

---

### Error Handling

#### SynthesisError Class

```typescript
export class SynthesisError extends Error {
  constructor(
    public readonly code: SynthesisErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  )
}
```

#### Error Codes & Retry Strategy

| Code | Description | Retryable | User Message |
|------|-------------|-----------|--------------|
| `TIMEOUT` | 60s timeout exceeded | ✅ Yes | "Synthesis timed out. Try with shorter input." |
| `INVALID_JSON` | JSON parsing failed | ✅ Yes | "Failed to parse response. Please retry." |
| `SCHEMA_VALIDATION` | Zod validation failed | ✅ Yes | "Profile validation failed. Please retry." |
| `API_ERROR` | OpenAI API error | ✅ Yes | "OpenAI API error. Please retry." |
| `NETWORK_ERROR` | Network/fetch error | ✅ Yes | "Network error. Check connection." |
| `RATE_LIMITED` | 429 rate limit | ✅ Yes | "Rate limit reached. Wait and retry." |

**Error Detection Logic:**
- **TIMEOUT**: `AbortController` signal with 60s timer
- **INVALID_JSON**: `JSON.parse()` try-catch
- **SCHEMA_VALIDATION**: Zod `parse()` try-catch, also validates empty input
- **API_ERROR**: OpenAI response status codes (non-429)
- **NETWORK_ERROR**: Error message contains 'fetch', 'network', or 'ECONNREFUSED'
- **RATE_LIMITED**: `error.status === 429`

---

## System Prompt Design

The system prompt explains all 15 guru profile fields with detailed descriptions:

### Structure

1. **Guru Profile Concept** - What is a guru?
2. **Field Definitions** - All 15 fields with examples
   - Domain & Expertise (3 fields)
   - Audience (2 fields)
   - Teaching Style (3 fields)
   - Content Preferences (3 fields)
   - Unique Characteristics (3 fields)
   - Meta (1 field)
3. **Task Instructions** - Extract, infer, identify light areas, assess confidence
4. **Output Format** - JSON schema with exact structure
5. **Guidelines** - Best practices for synthesis

### Key Prompt Features

- **Enum validation**: Explicit values for `audienceLevel` and `tone`
- **Array handling**: Empty arrays valid for optional fields
- **Null handling**: Distinguish null from empty string
- **Light areas**: Mark fields with heavy inference
- **Confidence scoring**: Overall synthesis quality (0-1)
- **Reasoning field**: Internal debugging (not exposed in result)

---

## Light Areas Detection

GPT-4o identifies fields where it had to infer heavily without explicit input. These are returned in the `lightAreas` array.

**Example:**
```json
{
  "profile": { /* 15 fields */ },
  "lightAreas": ["yearsOfExperience", "commonMisconceptions"],
  "confidence": 0.72,
  "rawInput": "I teach backgammon...",
  "synthesisMode": "TEXT"
}
```

**Validation:** Only field names that exist in the profile are included (invalid names filtered out).

---

## GPT-4o Configuration

```typescript
{
  model: 'gpt-4o',
  response_format: { type: 'json_object' },
  temperature: 0.3,  // Low temp for consistent extraction
  signal: abortController.signal,  // 60s timeout
}
```

**Why JSON mode (not structured outputs)?**
- Structured outputs (`json_schema`) require strict schemas
- Null handling in structured mode is complex (requires `.nullable().optional()`)
- JSON mode is more forgiving for synthesis tasks
- We validate with Zod after parsing anyway

---

## Integration Pattern

### Basic Usage

```typescript
import { synthesizeGuruProfile, SynthesisError } from '@/lib/guruProfile/synthesizer'

try {
  const result = await synthesizeGuruProfile(rawInput)

  // Use result.profile, result.lightAreas, result.confidence
  console.log(`Confidence: ${result.confidence}`)
  console.log(`Light areas: ${result.lightAreas.join(', ')}`)

} catch (error) {
  if (error instanceof SynthesisError) {
    if (error.retryable) {
      // Show retry button to user
      console.log(`Retryable error: ${error.message}`)
    } else {
      // Fatal error - show error message
      console.log(`Fatal error: ${error.message}`)
    }
  } else {
    // Unexpected error
    throw error
  }
}
```

### With Refinement

```typescript
// Initial synthesis
const initial = await synthesizeGuruProfile(rawInput)

// User adds context, regenerate
const refined = await synthesizeGuruProfile(
  rawInput,
  "Focus more on practical examples, less on theory"
)
```

---

## Testing Checklist

### Unit Tests
- [ ] Empty input throws `SCHEMA_VALIDATION` error
- [ ] Valid input returns complete profile
- [ ] Light areas are valid field names
- [ ] Confidence is between 0 and 1
- [ ] Retryable errors have `retryable: true`
- [ ] Non-retryable errors have `retryable: false`

### Integration Tests
- [ ] Timeout after 60 seconds
- [ ] Rate limit (429) detected correctly
- [ ] Network errors detected correctly
- [ ] Invalid JSON handled gracefully
- [ ] Schema validation failures handled

### Error Simulation Tests
- [ ] Mock AbortController timeout
- [ ] Mock invalid JSON response
- [ ] Mock schema validation failure
- [ ] Mock 429 rate limit response
- [ ] Mock network error

---

## Error Handling Coverage

### ✅ All 6 Error Codes Covered

1. **TIMEOUT** - Line 250: `error.name === 'AbortError'`
2. **INVALID_JSON** - Line 210: `JSON.parse()` catch block
3. **SCHEMA_VALIDATION** - Line 174 (empty input), Line 222 (Zod parse)
4. **API_ERROR** - Line 202 (no content), Line 261 (API status codes)
5. **NETWORK_ERROR** - Line 276: Network/fetch error detection
6. **RATE_LIMITED** - Line 257: `status === 429`

### Retry Logic

**Retryable errors (6/6):**
- TIMEOUT - Transient, likely works on retry
- INVALID_JSON - Might work with different response
- SCHEMA_VALIDATION - Might work with refined prompt
- API_ERROR - Most API errors are transient
- NETWORK_ERROR - Network issues usually temporary
- RATE_LIMITED - Works after delay

**Non-retryable (by default):**
- Generic unknown errors (Line 287) - Set to `false` for safety

---

## Best Practices Followed

✅ **Lazy-loaded client** - Matches `mentalModelGenerator.ts` pattern
✅ **AbortController** - Proper timeout handling
✅ **Type-safe errors** - Custom error class with codes
✅ **Validation at boundaries** - Input validation before API call
✅ **Comprehensive JSDoc** - All public APIs documented
✅ **Error cause chaining** - Preserves original errors
✅ **Field name validation** - Light areas filtered against actual fields
✅ **Confidence clamping** - Ensures 0-1 range
✅ **No module-level side effects** - Build-safe

---

## Code Statistics

- **Total Lines:** ~370
- **System Prompt:** ~150 lines
- **Error Handling:** ~90 lines (24% of code)
- **Type Annotations:** 100% coverage
- **JSDoc Coverage:** All public APIs

---

## Next Steps (API Integration)

To integrate this service into the API:

1. **Create API route:** `app/api/guru-profile/synthesize/route.ts`
2. **Handle request:** Validate `rawInput`, optional `additionalContext`
3. **Call service:** `await synthesizeGuruProfile(rawInput, additionalContext)`
4. **Return response:** Success with `profile` or error with `code`, `message`, `retryable`
5. **Add authentication:** Require valid session
6. **Add rate limiting:** Prevent abuse of GPT-4o calls

**Example API response:**
```json
{
  "success": true,
  "profile": {
    "profile": { /* 15 fields */ },
    "lightAreas": ["yearsOfExperience"],
    "confidence": 0.85,
    "rawInput": "...",
    "synthesisMode": "TEXT"
  }
}
```

---

## Related Files

- **Types:** `lib/guruProfile/types.ts` (schemas, error codes)
- **Patterns:** `lib/guruFunctions/generators/mentalModelGenerator.ts` (lazy-load pattern)
- **Architecture:** `docs/implementation-scaffolds/ai-brain-dump-synthesis/ARCHITECTURE.md`

---

**Implementation Date:** 2025-12-10
**Author:** Claude (AI SDK Expert)
**Status:** Ready for API integration
