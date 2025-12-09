# Vercel AI SDK v5 - Project Reference

**Version:** 5.0.89 | **Last updated:** 2025-12-06

## TL;DR

v5 is a complete rewrite: transport-based hooks, `parts` arrays (not `content` strings), `UIMessage` as source of truth. Always use `convertToModelMessages()` before passing to AI functions. `generateObject` does NOT support tool calling—use `generateText` with `experimental_output` instead.

## Gotchas

| Issue | Severity | Fix |
|-------|----------|-----|
| **Stale body data in useChat** | HIGH | Pass dynamic state via `sendMessage(text, { body: {...} })`, NOT in hook config |
| **`stepCountIs(5)` = EXACTLY 5 steps** | HIGH | Use `({ stepNumber }) => stepNumber >= 5` for max steps |
| **`generateObject` ignores tools** | HIGH | Use `generateText` + `experimental_output` for tools + structured outputs |
| **OpenAI strict mode schema** | MEDIUM | Optional fields need `.nullable().optional()`, not just `.optional()` |
| **`experimental_output` adds +1 step** | MEDIUM | Adjust `stopWhen` to account for extra step |
| **Stream errors don't throw** | MEDIUM | Always provide `onError` callback to `streamText` |
| **Abort breaks resume** | LOW | Choose either `stop()` OR `resume: true`, not both |

## Key Patterns

### Chat API Route (Correct v5 Pattern)

```typescript
import { streamText, convertToModelMessages } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToModelMessages(messages), // REQUIRED in v5
    abortSignal: req.signal,                    // Forward cancellation
    onError: (error) => console.error(error),  // Errors don't throw!
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    onFinish: async ({ messages }) => {
      await saveChat({ messages }); // UIMessage[] format
    },
  });
}
```

### Tool Calling + Structured Output

```typescript
// generateObject does NOT support tools - use this pattern:
const result = await generateText({
  model: openai('gpt-4o'),
  tools: { search: searchTool },
  experimental_output: z.object({
    summary: z.string(),
    confidence: z.number().nullable().optional(), // Note: nullable().optional()
  }),
  stopWhen: ({ stepNumber }) => stepNumber >= 4, // +1 for structured output
});

console.log(result.experimental_output); // Structured data
console.log(result.toolCalls);           // Tool calls still available
```

### useChat with Dynamic State

```typescript
'use client';
const { sendMessage } = useChat({ api: '/api/chat' });
const [temperature, setTemperature] = useState(0.7);

// WRONG: body in hook config is stale
// CORRECT: pass at request time
const handleSubmit = () => {
  sendMessage(
    { text: input },
    { body: { temperature } } // Fresh value
  );
};
```

### Message Parts Rendering (v5)

```typescript
// v5 uses parts array, not content string
{messages.map(msg => (
  <div key={msg.id}>
    {msg.parts?.map((part, i) => {
      if (part.type === 'text') return <span key={i}>{part.text}</span>;
      if (part.type.startsWith('tool-')) {
        return <ToolResult key={i} name={part.type} output={part.output} />;
      }
      return null;
    })}
  </div>
))}
```

## Quick Reference

### Imports
```typescript
import { streamText, generateText, convertToModelMessages, tool } from 'ai';
import { useChat } from '@ai-sdk/react';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
```

### Tool Definition
```typescript
const myTool = tool({
  description: 'What this tool does',
  inputSchema: z.object({
    param: z.string().describe('Parameter description'),
  }),
  execute: async ({ param }) => {
    return { result: 'value' };
  },
});
```

### Error Handling
```typescript
const { messages, error, sendMessage, reload } = useChat({
  onError: (error) => console.error(error),
});

// Show error UI
{error && <button onClick={reload}>Retry</button>}
```

## Breaking Changes from v4

| v4 | v5 |
|----|-----|
| `message.content` (string) | `message.parts` (array) |
| `parameters` in tools | `inputSchema` |
| `args`/`result` in tool calls | `input`/`output` |
| `maxSteps` parameter | `stopWhen` conditions |
| `toolInvocations` | `tool-${toolName}` parts |
| `Message` type | `UIMessage` type |
| Cached by default | Uncached by default |

## What We DON'T Use

- WebSocket transport (using HTTP)
- `streamUI` component streaming
- `useAssistant` hook
- Custom providers
- `dynamicTool()` runtime tools
