interface AssessmentResultData {
  guruMatchedBest: boolean | null
  userRating: number | null
}

interface SessionScore {
  totalProblems: number
  correctMatches: number
  matchAccuracy: number // 0-100%
  averageRating: number | null // 1-5 or null if no ratings
  overallScore: number // Weighted combination (0-100)
}

/**
 * Calculate assessment scores for a session
 *
 * Overall Score Formula:
 * - 70% weight on match accuracy (did guru recommend the best move?)
 * - 30% weight on user satisfaction (rating)
 * - If no ratings provided, uses match accuracy only
 */
export function calculateSessionScore(results: AssessmentResultData[]): SessionScore {
  const totalProblems = results.length

  if (totalProblems === 0) {
    return {
      totalProblems: 0,
      correctMatches: 0,
      matchAccuracy: 0,
      averageRating: null,
      overallScore: 0,
    }
  }

  // Calculate match accuracy
  const correctMatches = results.filter((r) => r.guruMatchedBest === true).length
  const matchAccuracy = (correctMatches / totalProblems) * 100

  // Calculate average rating (only from rated results)
  const ratedResults = results.filter((r) => r.userRating !== null)
  const averageRating =
    ratedResults.length > 0
      ? ratedResults.reduce((sum, r) => sum + (r.userRating || 0), 0) / ratedResults.length
      : null

  // Calculate overall score
  let overallScore: number
  if (averageRating !== null) {
    // 70% match accuracy + 30% normalized rating (1-5 → 0-100)
    const normalizedRating = ((averageRating - 1) / 4) * 100
    overallScore = matchAccuracy * 0.7 + normalizedRating * 0.3
  } else {
    // No ratings, use match accuracy only
    overallScore = matchAccuracy
  }

  return {
    totalProblems,
    correctMatches,
    matchAccuracy: Math.round(matchAccuracy * 10) / 10,
    averageRating: averageRating ? Math.round(averageRating * 10) / 10 : null,
    overallScore: Math.round(overallScore * 10) / 10,
  }
}

/**
 * Format score for display with color coding
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

/**
 * Get letter grade from score
 */
export function getLetterGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}
