/**
 * Match Archive Scraper
 *
 * Discovers and downloads match archive files from public backgammon
 * match collections like Hardy's Backgammon Pages.
 */

// Timeout for fetch requests (30 seconds)
const FETCH_TIMEOUT_MS = 30000

// File size limits for validation
const MIN_VALID_FILE_SIZE = 50 // Minimum bytes for valid JellyFish file
const MAX_VALID_FILE_SIZE = 10_000_000 // 10MB - anything larger is likely corrupted

/**
 * Fetch with timeout to prevent hanging on slow/unresponsive servers.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    return response
  } catch (error) {
    clearTimeout(timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`)
    }
    throw error
  }
}

export interface DiscoveredArchive {
  url: string
  filename: string
  metadata: {
    tournamentName?: string
    round?: string
    player1?: { name: string; country?: string }
    player2?: { name: string; country?: string }
    year?: number
  }
}

export interface ScrapeResult {
  discovered: number
  alreadyImported: number
  toProcess: DiscoveredArchive[]
}

/**
 * Discover all .txt match archives from Hardy's Backgammon Pages.
 *
 * Site structure:
 * - Main page: https://www.hardyhuebener.de/engl/matches.html
 * - Downloads: https://www.hardyhuebener.de/downloads/{filename}.txt
 * - Links are relative: ../downloads/{filename}.txt
 */
export async function discoverHardyArchives(): Promise<DiscoveredArchive[]> {
  const BASE_URL = 'https://www.hardyhuebener.de'
  const MATCHES_PAGE = `${BASE_URL}/engl/matches.html`
  const DOWNLOADS_BASE = `${BASE_URL}/downloads/`

  // Fetch the matches page with timeout
  const response = await fetchWithTimeout(MATCHES_PAGE)
  if (!response.ok) {
    throw new Error(`Failed to fetch Hardy's matches page: ${response.status}`)
  }

  const html = await response.text()
  const archives: DiscoveredArchive[] = []

  // Parse all .txt file links
  // Pattern: href="../downloads/filename.txt" or href="../downloads/filename.mat"
  const linkRegex = /href="\.\.\/downloads\/([^"]+\.(?:txt|mat))"/gi
  let match: RegExpExecArray | null

  while ((match = linkRegex.exec(html)) !== null) {
    const filename = match[1]
    const url = `${DOWNLOADS_BASE}${filename}`

    // Extract metadata from filename and surrounding context
    const metadata = parseFilenameMetadata(filename)

    // Try to find surrounding context in HTML for richer metadata
    const contextMetadata = extractContextMetadata(html, match.index)

    archives.push({
      url,
      filename,
      metadata: {
        ...metadata,
        ...contextMetadata,
      },
    })
  }

  return archives
}

/**
 * Parse metadata from the filename.
 *
 * Examples:
 * - 2011_mc_final_suzuki_vs_gullota.txt
 * - 2005mc_round2_jonas-tardieu.txt
 * - 1979mc_final_westheimer-villa.txt
 */
function parseFilenameMetadata(filename: string): DiscoveredArchive['metadata'] {
  const metadata: DiscoveredArchive['metadata'] = {}

  // Extract year (4 digits at start or after underscore)
  const yearMatch = filename.match(/^(\d{4})|_(\d{4})/)
  if (yearMatch) {
    metadata.year = parseInt(yearMatch[1] || yearMatch[2], 10)
  }

  // Extract tournament abbreviation
  if (filename.toLowerCase().includes('mc')) {
    metadata.tournamentName = 'Monte Carlo World Championship'
  } else if (filename.toLowerCase().includes('wc')) {
    metadata.tournamentName = 'World Championship'
  }

  // Extract round
  if (filename.toLowerCase().includes('final')) {
    metadata.round = 'Final'
  } else if (filename.toLowerCase().includes('semi')) {
    metadata.round = 'Semifinal'
  } else if (filename.toLowerCase().includes('quarter')) {
    metadata.round = 'Quarterfinal'
  }

  // Extract player names (pattern: name-name or name_vs_name)
  const playerMatch = filename.match(/([a-z]+)[-_](?:vs[-_])?([a-z]+)\.(?:txt|mat)$/i)
  if (playerMatch) {
    metadata.player1 = { name: capitalize(playerMatch[1]) }
    metadata.player2 = { name: capitalize(playerMatch[2]) }
  }

  return metadata
}

/**
 * Extract richer metadata from the HTML context around the link.
 *
 * The HTML structure typically looks like:
 * "Tournament Name, Date / Round / Player1 (COUNTRY) vs. Player2 (COUNTRY)"
 */
function extractContextMetadata(
  html: string,
  linkIndex: number
): Partial<DiscoveredArchive['metadata']> {
  const metadata: Partial<DiscoveredArchive['metadata']> = {}

  // Get ~500 chars before the link for context
  const contextStart = Math.max(0, linkIndex - 500)
  const context = html.substring(contextStart, linkIndex)

  // Look for country codes in parentheses near player names
  // Pattern: "Player Name (USA)" or "Player Name (JPN)"
  const countryPattern = /([A-Za-z\s]+)\s*\(([A-Z]{2,3})\)/g
  const countries: Array<{ name: string; country: string }> = []
  let countryMatch: RegExpExecArray | null

  while ((countryMatch = countryPattern.exec(context)) !== null) {
    countries.push({
      name: countryMatch[1].trim(),
      country: countryMatch[2],
    })
  }

  // Use the last two country matches (closest to the link)
  if (countries.length >= 2) {
    const lastTwo = countries.slice(-2)
    metadata.player1 = { name: lastTwo[0].name, country: lastTwo[0].country }
    metadata.player2 = { name: lastTwo[1].name, country: lastTwo[1].country }
  } else if (countries.length === 1) {
    metadata.player1 = { name: countries[0].name, country: countries[0].country }
  }

  // Look for tournament name patterns
  const tournamentPatterns = [
    /Monte Carlo World Championship/i,
    /World Championship/i,
    /European Championship/i,
    /US Open/i,
    /Nordic Open/i,
  ]

  for (const pattern of tournamentPatterns) {
    if (pattern.test(context)) {
      const match = context.match(pattern)
      if (match) {
        metadata.tournamentName = match[0]
        break
      }
    }
  }

  return metadata
}

/**
 * Download a single match archive file.
 * Returns the raw text content.
 *
 * Includes validation to catch:
 * - HTTP errors (404s, etc.)
 * - Empty or truncated files
 * - Non-JellyFish content (HTML error pages, etc.)
 */
export async function downloadArchive(url: string): Promise<string> {
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to download archive from ${url}: ${response.status}`)
  }

  const content = await response.text()

  // Validate minimum file size
  if (content.length < MIN_VALID_FILE_SIZE) {
    throw new Error(
      `File from ${url} is too short to be a valid match file (${content.length} bytes, minimum ${MIN_VALID_FILE_SIZE})`
    )
  }

  // Validate maximum file size
  if (content.length > MAX_VALID_FILE_SIZE) {
    throw new Error(
      `File from ${url} is suspiciously large (${content.length} bytes, maximum ${MAX_VALID_FILE_SIZE}), may be corrupted`
    )
  }

  // Validate it looks like a JellyFish match file
  // Must contain match length indicator AND game markers
  const hasMatchLength = /\d+\s+point\s+match/i.test(content)
  const hasGameMarker = /Game\s+\d+/i.test(content)

  if (!hasMatchLength && !hasGameMarker) {
    // Check if it's an HTML error page
    if (content.includes('<html') || content.includes('<!DOCTYPE')) {
      throw new Error(`File from ${url} appears to be an HTML page, not a match file`)
    }
    throw new Error(`File from ${url} does not appear to be a valid JellyFish match file`)
  }

  return content
}

/**
 * Helper to capitalize a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Filter out archives that have already been imported.
 * Checks by filename in the MatchArchive table.
 */
export async function filterAlreadyImported(
  archives: DiscoveredArchive[],
  prisma: import('@prisma/client').PrismaClient
): Promise<ScrapeResult> {
  // Get all existing filenames
  const existingArchives = await prisma.matchArchive.findMany({
    where: {
      filename: {
        in: archives.map(a => a.filename),
      },
    },
    select: { filename: true },
  })

  const existingFilenames = new Set(existingArchives.map(a => a.filename))

  const toProcess = archives.filter(a => !existingFilenames.has(a.filename))

  return {
    discovered: archives.length,
    alreadyImported: existingFilenames.size,
    toProcess,
  }
}
