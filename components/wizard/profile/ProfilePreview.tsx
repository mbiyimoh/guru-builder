'use client'

/**
 * ProfilePreview Component
 *
 * Displays the synthesized guru profile with editable project name.
 * Highlights "light areas" where confidence is lower.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import type { SynthesisResult } from '@/lib/guruProfile/types'

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

  /**
   * Check if a field is a "light area" (low confidence)
   */
  const isLightArea = (fieldName: string) => lightAreas.includes(fieldName)

  /**
   * Format field name for display
   */
  const formatFieldName = (fieldName: string) => {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  /**
   * Render field value with appropriate formatting
   */
  const renderValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return 'Not specified'
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None specified'
    }
    if (typeof value === 'number') {
      return value.toString()
    }
    return String(value)
  }

  const canSave = projectName.trim().length > 0

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

      {/* Synthesis Quality */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Synthesis Confidence</p>
              <p className="text-xs text-muted-foreground">
                Overall quality of the generated profile
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-2xl font-bold">{Math.round(confidence * 100)}%</p>
              </div>
              <div
                className="h-12 w-12 rounded-full border-4"
                style={{
                  borderColor:
                    confidence >= 0.8
                      ? 'rgb(34, 197, 94)'
                      : confidence >= 0.6
                        ? 'rgb(234, 179, 8)'
                        : 'rgb(239, 68, 68)',
                }}
              />
            </div>
          </div>

          {lightAreas.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Some fields have lower confidence
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 mt-1">
                    These fields are marked with a yellow badge below. You can refine them later
                    through the research workflow.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Data */}
      <Card>
        <CardHeader>
          <CardTitle>Guru Profile</CardTitle>
          <CardDescription>Review the synthesized teaching assistant profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Domain & Expertise */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Domain & Expertise</h3>
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <ProfileField
                  label="Domain Expertise"
                  value={profile.domainExpertise}
                  isLight={isLightArea('domainExpertise')}
                />
                <ProfileField
                  label="Specific Topics"
                  value={profile.specificTopics}
                  isLight={isLightArea('specificTopics')}
                />
                <ProfileField
                  label="Years of Experience"
                  value={profile.yearsOfExperience}
                  isLight={isLightArea('yearsOfExperience')}
                />
              </div>
            </div>

            {/* Audience */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Target Audience</h3>
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <ProfileField
                  label="Audience Level"
                  value={profile.audienceLevel}
                  isLight={isLightArea('audienceLevel')}
                />
                <ProfileField
                  label="Audience Description"
                  value={profile.audienceDescription}
                  isLight={isLightArea('audienceDescription')}
                />
              </div>
            </div>

            {/* Teaching Style */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Teaching Style</h3>
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <ProfileField
                  label="Pedagogical Approach"
                  value={profile.pedagogicalApproach}
                  isLight={isLightArea('pedagogicalApproach')}
                />
                <ProfileField
                  label="Tone"
                  value={profile.tone}
                  isLight={isLightArea('tone')}
                />
                <ProfileField
                  label="Communication Style"
                  value={profile.communicationStyle}
                  isLight={isLightArea('communicationStyle')}
                />
              </div>
            </div>

            {/* Content Preferences */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Content Preferences</h3>
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <ProfileField
                  label="Emphasized Concepts"
                  value={profile.emphasizedConcepts}
                  isLight={isLightArea('emphasizedConcepts')}
                />
                <ProfileField
                  label="Avoided Topics"
                  value={profile.avoidedTopics}
                  isLight={isLightArea('avoidedTopics')}
                />
                <ProfileField
                  label="Example Preferences"
                  value={profile.examplePreferences}
                  isLight={isLightArea('examplePreferences')}
                />
              </div>
            </div>

            {/* Unique Characteristics */}
            <div>
              <h3 className="text-lg font-semibold mb-3 text-primary">Unique Characteristics</h3>
              <div className="space-y-4 pl-4 border-l-2 border-muted">
                <ProfileField
                  label="Unique Perspective"
                  value={profile.uniquePerspective}
                  isLight={isLightArea('uniquePerspective')}
                />
                <ProfileField
                  label="Common Misconceptions"
                  value={profile.commonMisconceptions}
                  isLight={isLightArea('commonMisconceptions')}
                />
                <ProfileField
                  label="Success Metrics"
                  value={profile.successMetrics}
                  isLight={isLightArea('successMetrics')}
                />
              </div>
            </div>

            {/* Additional Context */}
            {profile.additionalContext && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-primary">Additional Context</h3>
                <div className="pl-4 border-l-2 border-muted">
                  <ProfileField
                    label="Additional Context"
                    value={profile.additionalContext}
                    isLight={isLightArea('additionalContext')}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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

/**
 * Individual profile field display component
 */
function ProfileField({
  label,
  value,
  isLight,
}: {
  label: string
  value: unknown
  isLight: boolean
}) {
  const displayValue = renderValue(value)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Label className="text-sm font-medium">{label}</Label>
        {isLight && (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 text-xs">
            Lower Confidence
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{displayValue}</p>
    </div>
  )
}

/**
 * Render field value with appropriate formatting
 */
function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'Not specified'
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None specified'
  }
  if (typeof value === 'number') {
    return value.toString()
  }
  return String(value)
}
