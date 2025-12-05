/**
 * Corpus Hasher Utility
 *
 * Computes hashes of corpus state for staleness detection and
 * composes corpus content for LLM prompts.
 */

import crypto from 'crypto'
import type { CorpusItem } from './types'

/**
 * Compute a hash of the corpus state for staleness detection.
 * Changes to layer/file content or order will produce a different hash.
 */
export function computeCorpusHash(
  contextLayers: CorpusItem[],
  knowledgeFiles: CorpusItem[]
): string {
  const data = {
    layers: contextLayers.map(l => ({ title: l.title, content: l.content })),
    files: knowledgeFiles.map(f => ({ title: f.title, content: f.content })),
  }

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex')
    .slice(0, 16) // Short hash is sufficient
}

/**
 * Compose a summary of corpus content for LLM prompts.
 */
export function composeCorpusSummary(
  contextLayers: CorpusItem[],
  knowledgeFiles: CorpusItem[]
): string {
  const sections: string[] = []

  if (contextLayers.length > 0) {
    sections.push('## Context Layers\n')
    contextLayers.forEach((layer, i) => {
      sections.push(`### ${i + 1}. ${layer.title}\n${layer.content}\n`)
    })
  }

  if (knowledgeFiles.length > 0) {
    sections.push('## Knowledge Files\n')
    knowledgeFiles.forEach((file, i) => {
      sections.push(`### ${i + 1}. ${file.title}\n${file.content}\n`)
    })
  }

  return sections.join('\n')
}

/**
 * Count words in corpus for context size estimation.
 */
export function countCorpusWords(
  contextLayers: CorpusItem[],
  knowledgeFiles: CorpusItem[]
): number {
  const allContent = [
    ...contextLayers.map(l => l.content),
    ...knowledgeFiles.map(f => f.content),
  ].join(' ')

  return allContent.split(/\s+/).filter(w => w.length > 0).length
}
