/**
 * Domain keyword definitions for detecting specialized domains in guru profiles.
 * Used by domain detection to suggest relevant ground truth engines.
 */

/**
 * Keywords for detecting backgammon domain in profile content.
 * Case-insensitive matching applied by caller.
 */
export const BACKGAMMON_KEYWORDS = [
  'backgammon',
  'doubling cube',
  'pip count',
  'bearing off',
  'blot',
  'anchor',
  'prime',
  'gammon',
  'match play',
  'money game',
  'jacoby rule',
  'crawford rule',
  'checker play',
  'cube decision',
  'equity',
  'take point',
  'pass point',
  'gnubg',
  'xg',
] as const;

/**
 * Map domain names to their keyword arrays.
 * Extensible for future domains (chess, poker, etc.)
 */
export const DOMAIN_KEYWORDS: Record<string, readonly string[]> = {
  backgammon: BACKGAMMON_KEYWORDS,
};

/**
 * Get all keywords for a specific domain.
 */
export function getKeywordsForDomain(domain: string): readonly string[] {
  return DOMAIN_KEYWORDS[domain] ?? [];
}

/**
 * Check if content matches any keyword for a domain.
 * Returns matched keywords for transparency.
 */
export function matchDomainKeywords(
  content: string,
  domain: string
): string[] {
  const keywords = getKeywordsForDomain(domain);
  const lowerContent = content.toLowerCase();

  return keywords.filter(keyword =>
    lowerContent.includes(keyword.toLowerCase())
  );
}
