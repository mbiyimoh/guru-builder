/**
 * Audit Trail Type Definitions
 *
 * These types support the context audit trail system.
 * Merge these with your existing types.ts file.
 */

// Context layer metadata (captured during AI generation)
export interface ContextLayerMetadata {
  id: string
  name: string
  priority: number
  contentLength: number
}

// Knowledge file metadata (conditionally-loaded reference documents)
export interface KnowledgeFileMetadata {
  id: string
  title: string
  category?: string
  contentLength: number
}

// Complete audit trail object
export interface AuditTrail {
  messageId: string
  timestamp: Date
  model: string
  reasoning?: string[]  // Claude's extended thinking traces
  contextLayers: ContextLayerMetadata[]
  knowledgeFiles: KnowledgeFileMetadata[]
  tokens: {
    prompt: number
    completion: number
    reasoning?: number  // Future: separate reasoning token count
    total: number
  }
  cost: {
    prompt: number
    completion: number
    reasoning?: number  // Future: separate reasoning cost
    total: number
  }
}
