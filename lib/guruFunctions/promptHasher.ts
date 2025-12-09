/**
 * Prompt Hasher Utility
 *
 * Creates consistent, short hashes for prompt versioning.
 * Used to track which prompts generated each artifact.
 */

import { createHash } from 'crypto'

/**
 * Generate a 12-character hash of a prompt string.
 * Uses SHA-256 for consistency and truncates for storage efficiency.
 *
 * @param prompt - The prompt string to hash
 * @returns A 12-character hexadecimal hash
 */
export function hashPrompt(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex').slice(0, 12)
}
