'use client'

/**
 * ProfilePreview Component
 *
 * Displays the synthesized guru profile with editable project name.
 * Uses modern scorecard UI with confidence ring and collapsible sections.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Save, Loader2, Brain } from 'lucide-react'
import { ScorecardConfidenceRing } from '@/components/profile/ScorecardConfidenceRing'
import { ScorecardSection } from '@/components/profile/ScorecardSection'
import type { SynthesisResult } from '@/lib/guruProfile/types'
import { buildProfileSections } from '@/lib/guruProfile/sectionConfig'

interface ProfilePreviewProps {
  result: SynthesisResult
  projectName: string
  onProjectNameChange: (name: string) => void
  onBack: () => void
  onSave: () => void
  saving: boolean
}

export default function ProfilePreview({
  result,
  projectName,
  onProjectNameChange,
  onBack,
  onSave,
  saving,
}: ProfilePreviewProps) {
  const { profile, lightAreas, confidence } = result

  const canSave = projectName.trim().length > 0

  // Build sections with their fields using shared config
  const sections = buildProfileSections(profile, lightAreas)

  // No-op for light area clicks in wizard mode (no refinement input)
  const handleLightAreaClick = () => {
    // In wizard mode, light areas are informational only
  }

  return (
    <div className="space-y-6">
      {/* Project Name Input */}
      <Card>
        <CardHeader>
          <CardTitle>Name Your Project</CardTitle>
          <CardDescription>Give your guru project a memorable name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name *</Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              placeholder="e.g., Advanced Backgammon Tutor"
              disabled={saving}
              className="text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Profile Overview with Confidence Ring */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Guru Profile</CardTitle>
              <CardDescription className="mt-1">
                {profile.domainExpertise}
              </CardDescription>
            </div>
            <ScorecardConfidenceRing confidence={confidence} size="lg" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
              {profile.audienceLevel}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
              {profile.tone}
            </span>
          </div>

          {lightAreas.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Some fields were inferred with lower confidence. You can refine them later
                  through the research workflow after creating your project.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Sections */}
      <div className="space-y-3">
        {sections.map((section, index) => (
          <ScorecardSection
            key={section.title}
            title={section.title}
            fields={section.fields}
            onLightAreaClick={handleLightAreaClick}
            defaultExpanded={index === 0}
          />
        ))}

        {/* Additional Context Section (if exists) */}
        {profile.additionalContext && profile.additionalContext.trim().length > 0 && (
          <ScorecardSection
            title="Additional Context"
            fields={[
              {
                label: 'Additional Context',
                value: profile.additionalContext,
                fieldKey: 'additionalContext',
                isLight: lightAreas.includes('additionalContext'),
              },
            ]}
            onLightAreaClick={handleLightAreaClick}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" onClick={onBack} disabled={saving}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Button onClick={onSave} disabled={!canSave || saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save & Continue
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
