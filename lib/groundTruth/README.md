# Ground Truth Module - Response Parser

## Overview

The Response Parser provides robust parsing of GPT-4o responses that may contain JSON in various formats. It handles function calling responses, tool call extraction, and error detection.

## Files

- **`responseParser.ts`** - Core parsing functions with multiple extraction strategies
- **`responseParser.examples.ts`** - Usage examples and integration patterns
- **`types.ts`** - Type definitions for ground truth operations

## Key Functions

### `parseStructuredDrillOutput<T>(content, schema)`

Parses structured output from GPT-4o using multiple strategies:

1. **Strategy 1: Direct JSON Parse** - Tries parsing content as pure JSON
2. **Strategy 2: Markdown Code Blocks** - Extracts from ```json or ``` blocks
3. **Strategy 3: Pattern Matching** - Finds JSON embedded in prose

**Usage:**
```typescript
import { parseStructuredDrillOutput } from './responseParser'
import { drillSeriesSchema } from '../guruFunctions/schemas/drillSeriesSchema'

const result = parseStructuredDrillOutput(gptResponse, drillSeriesSchema)

if (result.success && result.data) {
  // Use validated drill series
  console.log(result.data.drillSeriesTitle)
} else {
  // Handle parse error
  console.error(result.error)
}
```

**Returns:** `ParseResult<T>`
```typescript
{
  success: boolean
  data?: T  // Only present if success is true
  error?: string  // Only present if success is false
}
```

### `extractToolCalls(response)`

Extracts all tool call requests from an OpenAI ChatCompletion response.

**Usage:**
```typescript
import { extractToolCalls } from './responseParser'

const toolCalls = extractToolCalls(openaiResponse)

for (const call of toolCalls) {
  console.log(`Tool: ${call.name}`)
  console.log(`Arguments:`, call.arguments)

  // Execute tool with validated arguments
  const result = await executeGroundTruthTool(call.name, call.arguments)
}
```

**Returns:** `ToolCall[]`
```typescript
interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
```

### `isGenerationComplete(response)`

Checks if GPT-4o has finished generating and doesn't need more tool calls.

**Usage:**
```typescript
import { isGenerationComplete } from './responseParser'

if (isGenerationComplete(openaiResponse)) {
  // Extract final output
  const result = parseStructuredDrillOutput(
    openaiResponse.choices[0]?.message.content,
    drillSeriesSchema
  )
} else {
  // Process tool calls and continue loop
  const toolCalls = extractToolCalls(openaiResponse)
}
```

**Returns:** `boolean`
- `true` - Generation complete (finish_reason === 'stop')
- `false` - More tool calls needed or hit token limit

### `parseToolCallArguments<T>(argumentsJson, schema)`

Safely parses and validates tool call arguments using a Zod schema.

**Usage:**
```typescript
import { parseToolCallArguments } from './responseParser'
import { z } from 'zod'

const positionSchema = z.object({
  positionId: z.string(),
  cube: z.string(),
})

const result = parseToolCallArguments(toolCall.function.arguments, positionSchema)

if (result.success && result.data) {
  // Use validated arguments
  await verifyPosition(result.data.positionId, result.data.cube)
} else {
  console.error('Invalid tool arguments:', result.error)
}
```

### `extractErrorMessage(response)`

Extracts human-readable error messages from failed OpenAI responses.

**Usage:**
```typescript
import { extractErrorMessage } from './responseParser'

const error = extractErrorMessage(openaiResponse)

if (error) {
  if (error.includes('Content filtered')) {
    // Retry with safer prompt
  } else if (error.includes('truncated')) {
    // Increase max_tokens
  } else if (error.includes('content filter')) {
    // Skip this item
  }
}
```

**Returns:** `string | null`
- Detects refusal (safety filter)
- Detects length truncation
- Detects content filter blocks

## Response Formats Handled

The parser handles these GPT-4o response formats:

### 1. Pure JSON
```
{"drillSeriesTitle": "Opening Play", "series": []}
```

### 2. Markdown JSON Block
```markdown
Here's the drill series:

```json
{
  "drillSeriesTitle": "Opening Play",
  "series": []
}
```
```

### 3. Plain Code Block
````markdown
```
{
  "drillSeriesTitle": "Opening Play",
  "series": []
}
```
````

### 4. Embedded in Prose
```
I've created a drill series: {"drillSeriesTitle": "Opening Play", "series": []} as requested.
```

### 5. Multiple Blocks (uses first valid)
````markdown
First attempt (invalid):
```json
{ broken }
```

Second attempt (valid):
```json
{"drillSeriesTitle": "Opening Play", "series": []}
```
````

## Integration with Ground Truth Verification

The response parser is designed to work with the ground truth agentic loop:

```typescript
import {
  parseStructuredDrillOutput,
  extractToolCalls,
  isGenerationComplete,
  parseToolCallArguments
} from './responseParser'

async function agenticLoop() {
  const MAX_ITERATIONS = 50
  let iteration = 0

  while (iteration < MAX_ITERATIONS) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
    })

    // Check completion
    if (isGenerationComplete(response)) {
      const result = parseStructuredDrillOutput(
        response.choices[0]?.message.content,
        drillSeriesSchema
      )

      if (result.success && result.data) {
        return result.data
      }
    }

    // Process tool calls
    const toolCalls = extractToolCalls(response)

    for (const call of toolCalls) {
      // Validate arguments
      const argsResult = parseToolCallArguments(call.arguments, toolSchema)

      if (argsResult.success && argsResult.data) {
        // Execute ground truth verification
        const toolResult = await executeToolCall(call.name, argsResult.data)

        // Add result to messages
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(toolResult)
        })
      }
    }

    iteration++
  }

  throw new Error('Max iterations reached')
}
```

## Error Handling Patterns

### Pattern 1: Graceful Degradation
```typescript
const result = parseStructuredDrillOutput(content, strictSchema)

if (!result.success) {
  // Try with relaxed schema
  const relaxedResult = parseStructuredDrillOutput(content, relaxedSchema)

  if (relaxedResult.success && relaxedResult.data) {
    console.warn('Using partial data')
    return relaxedResult.data
  }
}
```

### Pattern 2: Error Recovery
```typescript
const errorMsg = extractErrorMessage(response)

if (errorMsg) {
  if (errorMsg.includes('truncated')) {
    // Retry with higher max_tokens
    return await retryWithHigherLimit()
  } else if (errorMsg.includes('Content filtered')) {
    // Modify prompt and retry
    return await retryWithSaferPrompt()
  }
}
```

### Pattern 3: Validation Chain
```typescript
// 1. Check response-level errors
const error = extractErrorMessage(response)
if (error) return { error }

// 2. Check completion status
if (!isGenerationComplete(response)) {
  return { status: 'pending', toolCalls: extractToolCalls(response) }
}

// 3. Parse and validate content
const result = parseStructuredDrillOutput(content, schema)
if (!result.success) return { error: result.error }

// 4. Return validated data
return { success: true, data: result.data }
```

## Type Safety

All functions use TypeScript generics and Zod schemas for full type safety:

```typescript
import { z } from 'zod'

// Define schema
const mySchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
})

// Type is inferred from schema
type MyType = z.infer<typeof mySchema>

// Parse with full type safety
const result = parseStructuredDrillOutput<MyType>(content, mySchema)

if (result.success && result.data) {
  // result.data is fully typed as MyType
  console.log(result.data.title) // TypeScript knows this exists
  console.log(result.data.items) // TypeScript knows this is string[]
}
```

## Best Practices

1. **Always check `success` AND `data`** - Both must be true/present for type safety
2. **Use Zod schemas** - Don't parse raw JSON without validation
3. **Handle all error cases** - Check `extractErrorMessage()` before parsing
4. **Validate tool arguments** - Use `parseToolCallArguments()` with schemas
5. **Set iteration limits** - Prevent infinite loops in agentic systems
6. **Log raw responses** - When debugging, log the full response for analysis

## Testing

See `responseParser.examples.ts` for comprehensive usage examples including:

- All response format variations
- Tool call handling
- Error recovery strategies
- Complete agentic loop implementation
- Integration patterns

## Performance

- **Strategy 1 (Direct Parse)**: O(n) - Fastest for pure JSON
- **Strategy 2 (Markdown)**: O(n*m) - n=content length, m=number of blocks
- **Strategy 3 (Patterns)**: O(n*p) - n=content length, p=number of patterns

The parser tries strategies in order of speed, returning as soon as valid JSON is found.

## Future Enhancements

Potential improvements for future iterations:

1. **Caching** - Cache parsed results to avoid re-parsing identical responses
2. **Partial Parsing** - Extract partial results when schema validation fails
3. **Custom Patterns** - Allow callers to provide custom extraction patterns
4. **Streaming Support** - Handle streaming responses that build up over time
5. **Multi-format Support** - Handle YAML, TOML, or other structured formats

## Related Files

- `generatorWithVerification.ts` - Uses response parser in agentic loop
- `types.ts` - Ground truth type definitions
- `../guruFunctions/schemas/*` - Zod schemas for artifacts
