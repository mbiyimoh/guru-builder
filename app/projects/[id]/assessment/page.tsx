// app/projects/[id]/assessment/page.tsx

import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AssessmentClient } from '@/components/assessment/AssessmentClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AssessmentPage({ params }: PageProps) {
  const { id: projectId } = await params

  // Check authentication
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectAssessments: {
        where: { isEnabled: true },
        include: {
          assessmentDefinition: true,
        },
      },
      contextLayers: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Check ownership
  if (project.userId !== user.id) {
    redirect('/projects')
  }

  // Check if any assessment is enabled
  const enabledAssessment = project.projectAssessments[0]
  if (!enabledAssessment) {
    redirect(`/projects/${projectId}?error=assessment-not-configured`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Self-Assessment: {project.name}</h1>
            <p className="text-sm text-gray-600">
              {project.contextLayers.length} context layers loaded
            </p>
          </div>
          <div className="flex gap-4">
            <Link
              href={`/projects/${projectId}/assessment/history`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View History
            </Link>
            <Link
              href={`/projects/${projectId}`}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Back to Project
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <AssessmentClient projectId={projectId} />
      </main>
    </div>
  )
}
