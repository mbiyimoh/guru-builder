'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition'
import type { GuruProfileData, SynthesisResult } from '@/lib/guruProfile/types'
import { Mic, MicOff, Loader2, Check, AlertCircle, MessageSquare, Keyboard, ChevronRight, ChevronLeft, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'input-mode' | 'brain-dump' | 'processing' | 'preview' | 'confirm'

interface GuruProfileOnboardingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: (result: SynthesisResult) => void
}

const MIN_CHARACTERS = 50

export function GuruProfileOnboardingModal({
  open,
  onOpenChange,
  onComplete
}: GuruProfileOnboardingModalProps) {
  const [step, setStep] = useState<Step>('input-mode')
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text')
  const [brainDump, setBrainDump] = useState('')
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null)
  const [editedProfile, setEditedProfile] = useState<GuruProfileData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const speech = useSpeechRecognition()

  // Sync voice transcript to brain dump
  useEffect(() => {
    if (inputMode === 'voice' && speech.transcript) {
      setBrainDump(speech.transcript)
    }
  }, [speech.transcript, inputMode])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        resetState()
      }, 300) // Wait for close animation
    }
  }, [open])

  const resetState = useCallback(() => {
    setStep('input-mode')
    setInputMode('text')
    setBrainDump('')
    setSynthesisResult(null)
    setEditedProfile(null)
    setError(null)
    setIsProcessing(false)
    speech.resetTranscript()
  }, [speech])

  const handleInputModeSelect = (mode: 'voice' | 'text') => {
    setInputMode(mode)
    setStep('brain-dump')
    setError(null)
  }

  const handleVoiceToggle = () => {
    if (speech.isListening) {
      speech.stopListening()
    } else {
      speech.startListening()
    }
  }

  const handleSynthesize = async () => {
    if (brainDump.length < MIN_CHARACTERS) {
      setError(`Please provide at least ${MIN_CHARACTERS} characters`)
      return
    }

    setStep('processing')
    setIsProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/projects/synthesize-guru-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: brainDump })
      })

      const data = await res.json()

      if (data.success) {
        setSynthesisResult(data.profile)
        setEditedProfile(data.profile.profile)
        setStep('preview')
      } else {
        setError(data.error?.message || 'Synthesis failed')
        setStep('brain-dump')
      }
    } catch (e) {
      setError('Network error. Please try again.')
      setStep('brain-dump')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleProfileEdit = (field: keyof GuruProfileData, value: unknown) => {
    if (editedProfile) {
      setEditedProfile({
        ...editedProfile,
        [field]: value
      })
    }
  }

  const handleComplete = () => {
    if (editedProfile && synthesisResult) {
      // Pass the full SynthesisResult with any user edits applied to the profile
      onComplete({
        ...synthesisResult,
        profile: editedProfile,
        rawInput: brainDump, // Use the current brainDump in case it was edited
      })
      onOpenChange(false)
    }
  }

  const handleBack = () => {
    if (step === 'brain-dump') {
      setStep('input-mode')
    } else if (step === 'preview') {
      setStep('brain-dump')
    } else if (step === 'confirm') {
      setStep('preview')
    }
  }

  const isLightArea = (field: keyof GuruProfileData): boolean => {
    return synthesisResult?.lightAreas.includes(field) || false
  }

  const charCount = brainDump.length
  const meetsMinimum = charCount >= MIN_CHARACTERS

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl max-h-[90vh] overflow-y-auto",
        step === 'preview' && "max-w-5xl"
      )}>
        <DialogHeader>
          <DialogTitle>
            {step === 'input-mode' && 'Create Your AI Teaching Assistant'}
            {step === 'brain-dump' && 'Tell Me About Your Teaching Style'}
            {step === 'processing' && 'Analyzing Your Input...'}
            {step === 'preview' && 'Review Your Guru Profile'}
            {step === 'confirm' && 'Confirm & Create Project'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input-mode' && 'Choose how you\'d like to provide information about your teaching approach'}
            {step === 'brain-dump' && 'Share your thoughts freely - the more detail, the better!'}
            {step === 'processing' && 'Our AI is synthesizing your profile...'}
            {step === 'preview' && 'Review and edit the synthesized profile. Yellow highlights indicate inferred fields.'}
            {step === 'confirm' && 'Everything looks good? Create your guru project!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Input Mode Selection */}
        {step === 'input-mode' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6">
            <button
              onClick={() => handleInputModeSelect('voice')}
              disabled={!speech.isSupported}
              className={cn(
                "p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-colors text-left",
                !speech.isSupported && "opacity-50 cursor-not-allowed"
              )}
            >
              <MessageSquare className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Voice Input</h3>
              <p className="text-sm text-muted-foreground">
                Speak naturally about your teaching style and let AI transcribe
              </p>
              {!speech.isSupported && (
                <Badge variant="warning" className="mt-3">
                  Not supported in this browser
                </Badge>
              )}
            </button>

            <button
              onClick={() => handleInputModeSelect('text')}
              className="p-6 border-2 rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
            >
              <Keyboard className="h-12 w-12 mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Text Input</h3>
              <p className="text-sm text-muted-foreground">
                Type your thoughts and ideas in a free-form brain dump
              </p>
            </button>
          </div>
        )}

        {/* Step 2: Brain Dump Collection */}
        {step === 'brain-dump' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brain-dump">
                {inputMode === 'voice' ? 'Voice Transcript' : 'Your Brain Dump'}
              </Label>
              <Textarea
                id="brain-dump"
                value={brainDump}
                onChange={(e) => setBrainDump(e.target.value)}
                placeholder={inputMode === 'voice'
                  ? 'Click the microphone button below to start recording...'
                  : 'Example: I teach advanced backgammon strategy to competitive players. I focus on position evaluation and probability. My style is analytical but encouraging...'
                }
                className="min-h-[300px] font-mono text-sm"
                disabled={inputMode === 'voice' && speech.isListening}
              />
              <div className="flex items-center justify-between text-sm">
                <span className={cn(
                  meetsMinimum ? 'text-green-600' : 'text-muted-foreground'
                )}>
                  {charCount} / {MIN_CHARACTERS} characters {meetsMinimum && '✓'}
                </span>
                {inputMode === 'voice' && (
                  <Button
                    type="button"
                    variant={speech.isListening ? 'destructive' : 'default'}
                    size="sm"
                    onClick={handleVoiceToggle}
                    disabled={!speech.isSupported}
                  >
                    {speech.isListening ? (
                      <>
                        <MicOff className="h-4 w-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                )}
              </div>
              {speech.error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {speech.error}
                </p>
              )}
              {error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <p className="text-lg font-medium">Analyzing your input...</p>
            <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
          </div>
        )}

        {/* Step 4: Profile Preview */}
        {step === 'preview' && editedProfile && synthesisResult && (
          <div className="space-y-6 py-4">
            {/* Confidence Score */}
            <div className="flex items-center justify-between p-4 bg-accent rounded-lg">
              <div>
                <p className="text-sm font-medium">Synthesis Confidence</p>
                <p className="text-xs text-muted-foreground">
                  Based on the detail provided in your input
                </p>
              </div>
              <div className="text-2xl font-bold">
                {Math.round(synthesisResult.confidence * 100)}%
              </div>
            </div>

            {/* Profile Fields */}
            <div className="space-y-6">
              {/* Domain & Expertise */}
              <ProfileSection title="Domain & Expertise">
                <ProfileField
                  label="Domain Expertise"
                  field="domainExpertise"
                  value={editedProfile.domainExpertise}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('domainExpertise')}
                />
                <ProfileArrayField
                  label="Specific Topics"
                  field="specificTopics"
                  value={editedProfile.specificTopics}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('specificTopics')}
                />
                <ProfileNumberField
                  label="Years of Experience (optional)"
                  field="yearsOfExperience"
                  value={editedProfile.yearsOfExperience}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('yearsOfExperience')}
                />
              </ProfileSection>

              {/* Audience */}
              <ProfileSection title="Target Audience">
                <ProfileSelectField
                  label="Audience Level"
                  field="audienceLevel"
                  value={editedProfile.audienceLevel}
                  onChange={handleProfileEdit}
                  options={['beginner', 'intermediate', 'advanced', 'mixed']}
                  isLight={isLightArea('audienceLevel')}
                />
                <ProfileField
                  label="Audience Description"
                  field="audienceDescription"
                  value={editedProfile.audienceDescription}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('audienceDescription')}
                  multiline
                />
              </ProfileSection>

              {/* Teaching Style */}
              <ProfileSection title="Teaching Style">
                <ProfileField
                  label="Pedagogical Approach"
                  field="pedagogicalApproach"
                  value={editedProfile.pedagogicalApproach}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('pedagogicalApproach')}
                  multiline
                />
                <ProfileSelectField
                  label="Tone"
                  field="tone"
                  value={editedProfile.tone}
                  onChange={handleProfileEdit}
                  options={['formal', 'conversational', 'encouraging', 'direct', 'socratic']}
                  isLight={isLightArea('tone')}
                />
                <ProfileField
                  label="Communication Style"
                  field="communicationStyle"
                  value={editedProfile.communicationStyle}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('communicationStyle')}
                  multiline
                />
              </ProfileSection>

              {/* Content Preferences */}
              <ProfileSection title="Content Preferences">
                <ProfileArrayField
                  label="Emphasized Concepts"
                  field="emphasizedConcepts"
                  value={editedProfile.emphasizedConcepts}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('emphasizedConcepts')}
                />
                <ProfileArrayField
                  label="Avoided Topics"
                  field="avoidedTopics"
                  value={editedProfile.avoidedTopics}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('avoidedTopics')}
                />
                <ProfileField
                  label="Example Preferences"
                  field="examplePreferences"
                  value={editedProfile.examplePreferences}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('examplePreferences')}
                  multiline
                />
              </ProfileSection>

              {/* Unique Characteristics */}
              <ProfileSection title="Unique Characteristics">
                <ProfileField
                  label="Unique Perspective"
                  field="uniquePerspective"
                  value={editedProfile.uniquePerspective}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('uniquePerspective')}
                  multiline
                />
                <ProfileArrayField
                  label="Common Misconceptions"
                  field="commonMisconceptions"
                  value={editedProfile.commonMisconceptions}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('commonMisconceptions')}
                />
                <ProfileField
                  label="Success Metrics"
                  field="successMetrics"
                  value={editedProfile.successMetrics}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('successMetrics')}
                  multiline
                />
              </ProfileSection>

              {/* Additional Context */}
              <ProfileSection title="Additional Context">
                <ProfileField
                  label="Additional Context (optional)"
                  field="additionalContext"
                  value={editedProfile.additionalContext || ''}
                  onChange={handleProfileEdit}
                  isLight={isLightArea('additionalContext')}
                  multiline
                />
              </ProfileSection>
            </div>

            {synthesisResult.lightAreas.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Fields highlighted in yellow were inferred with lower confidence.
                  You can edit them to provide more accurate information.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Confirmation */}
        {step === 'confirm' && editedProfile && (
          <div className="space-y-4 py-6">
            <div className="p-6 bg-accent rounded-lg space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="h-6 w-6" />
                <h3 className="text-lg font-semibold">Profile Ready!</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Your guru profile has been configured. Click "Create Project" to set up your
                AI teaching assistant with this profile.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <DialogFooter className="gap-2">
          {step !== 'input-mode' && step !== 'processing' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isProcessing}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}

          {step === 'brain-dump' && (
            <Button
              onClick={handleSynthesize}
              disabled={!meetsMinimum || isProcessing}
            >
              Synthesize Profile
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'preview' && (
            <Button onClick={() => setStep('confirm')}>
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}

          {step === 'confirm' && (
            <Button onClick={handleComplete}>
              <Check className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper Components

interface ProfileSectionProps {
  title: string
  children: React.ReactNode
}

function ProfileSection({ title, children }: ProfileSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">{title}</h3>
      <div className="space-y-4 pl-2">
        {children}
      </div>
    </div>
  )
}

interface ProfileFieldProps {
  label: string
  field: keyof GuruProfileData
  value: string | number | null
  onChange: (field: keyof GuruProfileData, value: unknown) => void
  isLight: boolean
  multiline?: boolean
}

function ProfileField({ label, field, value, onChange, isLight, multiline }: ProfileFieldProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className={cn(
      "space-y-2 p-3 rounded-md transition-colors",
      isLight && "bg-yellow-50 border border-yellow-200"
    )}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {isLight && <Badge variant="warning" className="text-xs">Inferred</Badge>}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea
              value={value?.toString() || ''}
              onChange={(e) => onChange(field, e.target.value)}
              className="min-h-[80px]"
              autoFocus
            />
          ) : (
            <Input
              value={value?.toString() || ''}
              onChange={(e) => onChange(field, e.target.value)}
              autoFocus
            />
          )}
          <Button size="sm" onClick={() => setIsEditing(false)}>
            Done
          </Button>
        </div>
      ) : (
        <div
          className="group cursor-pointer p-2 hover:bg-accent rounded-md flex items-start justify-between gap-2"
          onClick={() => setIsEditing(true)}
        >
          <p className="text-sm flex-1">{value || <span className="text-muted-foreground italic">Not set</span>}</p>
          <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      )}
    </div>
  )
}

interface ProfileArrayFieldProps {
  label: string
  field: keyof GuruProfileData
  value: string[]
  onChange: (field: keyof GuruProfileData, value: unknown) => void
  isLight: boolean
}

function ProfileArrayField({ label, field, value, onChange, isLight }: ProfileArrayFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState(value.join(', '))

  const handleSave = () => {
    const newArray = inputValue
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0)
    onChange(field, newArray)
    setIsEditing(false)
  }

  return (
    <div className={cn(
      "space-y-2 p-3 rounded-md transition-colors",
      isLight && "bg-yellow-50 border border-yellow-200"
    )}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {isLight && <Badge variant="warning" className="text-xs">Inferred</Badge>}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter items separated by commas"
            className="min-h-[60px]"
            autoFocus
          />
          <Button size="sm" onClick={handleSave}>
            Done
          </Button>
        </div>
      ) : (
        <div
          className="group cursor-pointer p-2 hover:bg-accent rounded-md flex items-start justify-between gap-2"
          onClick={() => setIsEditing(true)}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {value.length > 0 ? (
              value.map((item, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {item}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground italic text-sm">No items</span>
            )}
          </div>
          <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      )}
    </div>
  )
}

interface ProfileSelectFieldProps {
  label: string
  field: keyof GuruProfileData
  value: string
  onChange: (field: keyof GuruProfileData, value: unknown) => void
  options: string[]
  isLight: boolean
}

function ProfileSelectField({ label, field, value, onChange, options, isLight }: ProfileSelectFieldProps) {
  return (
    <div className={cn(
      "space-y-2 p-3 rounded-md transition-colors",
      isLight && "bg-yellow-50 border border-yellow-200"
    )}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {isLight && <Badge variant="warning" className="text-xs">Inferred</Badge>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            type="button"
            variant={value === option ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(field, option)}
          >
            {option}
          </Button>
        ))}
      </div>
    </div>
  )
}

interface ProfileNumberFieldProps {
  label: string
  field: keyof GuruProfileData
  value: number | null
  onChange: (field: keyof GuruProfileData, value: unknown) => void
  isLight: boolean
}

function ProfileNumberField({ label, field, value, onChange, isLight }: ProfileNumberFieldProps) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className={cn(
      "space-y-2 p-3 rounded-md transition-colors",
      isLight && "bg-yellow-50 border border-yellow-200"
    )}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {isLight && <Badge variant="warning" className="text-xs">Inferred</Badge>}
      </div>
      {isEditing ? (
        <div className="space-y-2">
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(field, e.target.value ? parseInt(e.target.value, 10) : null)}
            autoFocus
          />
          <Button size="sm" onClick={() => setIsEditing(false)}>
            Done
          </Button>
        </div>
      ) : (
        <div
          className="group cursor-pointer p-2 hover:bg-accent rounded-md flex items-start justify-between gap-2"
          onClick={() => setIsEditing(true)}
        >
          <p className="text-sm flex-1">
            {value !== null ? value : <span className="text-muted-foreground italic">Not set</span>}
          </p>
          <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>
      )}
    </div>
  )
}
