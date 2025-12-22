/**
 * Match Archive File Storage
 *
 * Simple filesystem-based storage for match archive files.
 * MVP implementation stores files locally; can upgrade to S3 later.
 */

import fs from 'fs/promises'
import path from 'path'

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Storage directory for match archive files.
 * Override with MATCH_ARCHIVE_STORAGE environment variable.
 */
const STORAGE_DIR = process.env.MATCH_ARCHIVE_STORAGE || './data/match-archives'

// =============================================================================
// DIRECTORY MANAGEMENT
// =============================================================================

/**
 * Ensure the storage directory exists.
 * Creates it recursively if it doesn't.
 */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

/**
 * Get the file path for an archive ID
 */
function getFilePath(archiveId: string): string {
  // Sanitize archiveId to prevent path traversal
  const sanitizedId = archiveId.replace(/[^a-zA-Z0-9-_]/g, '')
  return path.join(STORAGE_DIR, `${sanitizedId}.txt`)
}

// =============================================================================
// FILE OPERATIONS
// =============================================================================

/**
 * Store archive file content
 *
 * @param archiveId - Unique identifier for the archive
 * @param content - Raw text content of the match file
 */
export async function storeArchiveFile(archiveId: string, content: string): Promise<void> {
  await ensureStorageDir()
  const filePath = getFilePath(archiveId)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Read archive file content
 *
 * @param archiveId - Unique identifier for the archive
 * @returns Raw text content of the match file
 * @throws Error if file doesn't exist
 */
export async function readArchiveFile(archiveId: string): Promise<string> {
  const filePath = getFilePath(archiveId)
  return fs.readFile(filePath, 'utf-8')
}

/**
 * Check if an archive file exists
 *
 * @param archiveId - Unique identifier for the archive
 * @returns True if the file exists
 */
export async function archiveFileExists(archiveId: string): Promise<boolean> {
  const filePath = getFilePath(archiveId)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Delete archive file
 *
 * @param archiveId - Unique identifier for the archive
 * @returns True if file was deleted, false if it didn't exist
 */
export async function deleteArchiveFile(archiveId: string): Promise<boolean> {
  const filePath = getFilePath(archiveId)
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * Get file size in bytes
 *
 * @param archiveId - Unique identifier for the archive
 * @returns File size in bytes, or null if file doesn't exist
 */
export async function getArchiveFileSize(archiveId: string): Promise<number | null> {
  const filePath = getFilePath(archiveId)
  try {
    const stats = await fs.stat(filePath)
    return stats.size
  } catch {
    return null
  }
}

/**
 * List all stored archive IDs
 *
 * @returns Array of archive IDs
 */
export async function listArchiveFiles(): Promise<string[]> {
  try {
    await ensureStorageDir()
    const files = await fs.readdir(STORAGE_DIR)
    return files
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace('.txt', ''))
  } catch {
    return []
  }
}
