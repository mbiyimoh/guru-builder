/**
 * Domain Detection Module
 *
 * Exports utilities for detecting specialized domains in guru profiles
 * and suggesting appropriate ground truth engines.
 */

export {
  detectDomainFromProfile,
  detectDomainFromProject,
  type DomainDetectionResult
} from './detectDomain';

export {
  BACKGAMMON_KEYWORDS,
  DOMAIN_KEYWORDS,
  matchDomainKeywords,
  getKeywordsForDomain
} from './keywords';
