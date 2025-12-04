import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { calculateSessionScore, getScoreColor, getLetterGrade } from '@/lib/assessment/scoreCalculation'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AssessmentHistoryPage({ params }: PageProps) {
  const { id: projectId } = await params

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assessmentConfig: {
        include: {
          sessions: {
            orderBy: { startedAt: 'desc' },
            include: {
              results: {
                orderBy: { createdAt: 'asc' },
                select: {
                  id: true,
                  diceRoll: true,
                  guruMatchedBest: true,
                  userRating: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  const sessions = project.assessmentConfig?.sessions || []

  // Calculate overall stats
  const allResults = sessions.flatMap((s) => s.results)
  const overallScore = calculateSessionScore(allResults)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-semibold">Assessment History</h1>
              <p className="text-sm text-gray-600">{project.name}</p>
            </div>
            <div className="flex gap-4">
              <Link
                href={`/projects/${projectId}/assessment`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                New Assessment
              </Link>
              <Link
                href={`/projects/${projectId}`}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Back to Project
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Overall Stats */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Overall Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold">{sessions.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Total Problems</p>
              <p className="text-2xl font-bold">{overallScore.totalProblems}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Match Accuracy</p>
              <p className={`text-2xl font-bold ${getScoreColor(overallScore.matchAccuracy)}`}>
                {overallScore.matchAccuracy}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Avg Rating</p>
              <p className="text-2xl font-bold text-yellow-500">
                {overallScore.averageRating ? `${overallScore.averageRating}/5` : 'N/A'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">Overall Score</p>
              <p className={`text-2xl font-bold ${getScoreColor(overallScore.overallScore)}`}>
                {overallScore.overallScore}% ({getLetterGrade(overallScore.overallScore)})
              </p>
            </div>
          </div>
        </div>

        {/* Session List */}
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Session History</h2>
          </div>

          {sessions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No assessment sessions yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start your first assessment to see results here.
              </p>
              <div className="mt-4">
                <Link
                  href={`/projects/${projectId}/assessment`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Start Assessment
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => {
                const score = calculateSessionScore(session.results)
                return (
                  <div key={session.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(session.startedAt).toLocaleDateString()} at{' '}
                            {new Date(session.startedAt).toLocaleTimeString()}
                          </p>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {score.totalProblems} problems
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            Match: {score.correctMatches}/{score.totalProblems} (
                            {score.matchAccuracy}%)
                          </span>
                          <span>•</span>
                          <span>
                            Rating: {score.averageRating ? `${score.averageRating}/5` : 'N/A'}
                          </span>
                          <span>•</span>
                          <span className={getScoreColor(score.overallScore)}>
                            Score: {score.overallScore}% ({getLetterGrade(score.overallScore)})
                          </span>
                        </div>

                        {/* Individual Results */}
                        {session.results.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {session.results.map((result) => (
                              <div
                                key={result.id}
                                className={`text-xs px-2 py-1 rounded border ${
                                  result.guruMatchedBest === true
                                    ? 'bg-green-50 border-green-200 text-green-700'
                                    : result.guruMatchedBest === false
                                      ? 'bg-red-50 border-red-200 text-red-700'
                                      : 'bg-gray-50 border-gray-200 text-gray-700'
                                }`}
                              >
                                {result.diceRoll}
                                {result.userRating && (
                                  <span className="ml-1 text-yellow-600">★{result.userRating}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {session.endedAt && (
                        <div className="text-xs text-gray-400">
                          Duration:{' '}
                          {Math.round(
                            (new Date(session.endedAt).getTime() -
                              new Date(session.startedAt).getTime()) /
                              60000
                          )}{' '}
                          min
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
