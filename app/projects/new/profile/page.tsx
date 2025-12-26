'use client'

/**
 * Profile Creation Page
 *
 * Wizard step for creating a guru profile through multiple modes:
 * - Chat Interview: Guided conversation with AI
 * - Voice Recording: Speech-to-text transcription (coming soon)
 * - Import Document: Parse PDF/DOCX/TXT files
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, Mic, FileText } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ProfileChatMode from '@/components/wizard/profile/ProfileChatMode'
import ProfilePreview from '@/components/wizard/profile/ProfilePreview'
import ProfileDocumentMode from '@/components/wizard/profile/ProfileDocumentMode'
import { DomainToolsPrompt } from '@/components/wizard/DomainToolsPrompt'
import type { SynthesisResult } from '@/lib/guruProfile/types'
import type { DomainDetectionResult } from '@/lib/domainDetection'

type Mode = 'chat' | 'voice' | 'document'
type Step = 'input' | 'preview' | 'domain-prompt'

export default function ProfileCreationPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('chat')
  const [step, setStep] = useState<Step>('input')
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null)
  const [projectName, setProjectName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)
  const [detectedDomain, setDetectedDomain] = useState<DomainDetectionResult | null>(null)

  /**
   * Handle synthesis completion from any mode
   */
  const handleSynthesisComplete = (result: SynthesisResult) => {
    setSynthesisResult(result)
    setStep('preview')
  }

  /**
   * Return to input step (allow re-synthesis)
   */
  const handleBack = () => {
    setStep('input')
  }

  /**
   * Save project and proceed to research phase
   */
  const handleSave = async () => {
    if (!synthesisResult || !projectName.trim()) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName.trim(),
          guruProfile: {
            rawBrainDump: synthesisResult.rawInput,
            synthesisMode: synthesisResult.synthesisMode,
            profileData: synthesisResult.profile,
            lightAreas: synthesisResult.lightAreas,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create project')
      }

      const { project } = await response.json()
      console.log('[Profile Page] Project created:', project.id)
      setCreatedProjectId(project.id)

      // Run domain detection to check for available GT engines
      try {
        console.log('[Profile Page] Calling domain detection...')
        const detectRes = await fetch(`/api/projects/${project.id}/detect-domain`, {
          method: 'POST',
          credentials: 'include',
        })

        console.log('[Profile Page] Domain detection response status:', detectRes.status)
        const domainResult: DomainDetectionResult = await detectRes.json()
        console.log('[Profile Page] Domain detection result:', domainResult)

        if (domainResult.detected && domainResult.suggestedEngine) {
          console.log('[Profile Page] Domain detected! Showing prompt.')
          // Show domain tools prompt
          setDetectedDomain(domainResult)
          setStep('domain-prompt')
          setSaving(false)
          return
        }
        console.log('[Profile Page] No domain detected or no engine suggested')
      } catch (error) {
        // Fail silently per spec - proceed without prompt
        console.error('[Profile Page] Domain detection error:', error)
      }

      // No domain detected or error - continue to dashboard
      console.log('[Profile Page] Redirecting to dashboard')
      router.push(`/projects/${project.id}`)
    } catch (error) {
      console.error('Failed to save project:', error)
      alert(error instanceof Error ? error.message : 'Failed to save project')
      setSaving(false)
    }
  }

  /**
   * Handle domain tools enable - GT already configured by DomainToolsPrompt
   */
  const handleDomainEnable = async () => {
    if (createdProjectId) {
      router.push(`/projects/${createdProjectId}`)
    }
  }

  /**
   * Handle domain tools skip
   */
  const handleDomainSkip = () => {
    if (createdProjectId) {
      router.push(`/projects/${createdProjectId}`)
    }
  }

  return (
    <div className="container max-w-5xl mx-auto py-6 sm:py-8 px-4">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Create Your Guru Profile</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Describe your teaching assistant in your own words. We&apos;ll synthesize it into a structured profile.
        </p>
      </div>

      {step === 'input' && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Choose Your Input Method</CardTitle>
            <CardDescription className="text-sm">
              Select how you&apos;d like to provide information about your guru
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 mb-6 h-auto sm:h-10">
                <TabsTrigger value="chat" className="flex items-center justify-center gap-2 min-h-[44px]">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Chat Interview</span>
                </TabsTrigger>
                <TabsTrigger value="voice" className="flex items-center justify-center gap-2 min-h-[44px]">
                  <Mic className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Voice Recording</span>
                </TabsTrigger>
                <TabsTrigger value="document" className="flex items-center justify-center gap-2 min-h-[44px]">
                  <FileText className="w-4 h-4" />
                  <span className="text-sm sm:text-base">Import Document</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat">
                <ProfileChatMode onComplete={handleSynthesisComplete} />
              </TabsContent>

              <TabsContent value="voice">
                <div className="text-center py-12 text-muted-foreground">
                  <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Voice Recording Coming Soon</p>
                  <p className="text-sm">
                    This feature will allow you to speak your thoughts and have them transcribed
                    automatically.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="document">
                <ProfileDocumentMode onComplete={handleSynthesisComplete} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <ProfilePreview
          result={synthesisResult!}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          onBack={handleBack}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {step === 'domain-prompt' && createdProjectId && detectedDomain && (
        <div className="py-12">
          <DomainToolsPrompt
            projectId={createdProjectId}
            detectedDomain={detectedDomain}
            onEnable={handleDomainEnable}
            onSkip={handleDomainSkip}
          />
        </div>
      )}
    </div>
  )
}
