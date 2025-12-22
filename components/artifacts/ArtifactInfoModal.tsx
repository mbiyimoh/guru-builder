'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ARTIFACT_CREATION_INFO } from '@/lib/teaching/artifactInfoContent'

interface ArtifactInfoModalProps {
  artifactType: 'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES'
  isOpen: boolean
  onClose: () => void
}

export function ArtifactInfoModal({ artifactType, isOpen, onClose }: ArtifactInfoModalProps) {
  const info = ARTIFACT_CREATION_INFO[artifactType]
  const Icon = info.icon

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            How {info.title} is Created
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Overview */}
          <section>
            <h3 className="font-semibold text-lg mb-2">What is this?</h3>
            <p className="text-muted-foreground">{info.overview}</p>
          </section>

          {/* Step-by-step process */}
          <section>
            <h3 className="font-semibold text-lg mb-3">Creation Process</h3>
            <ol className="space-y-4">
              {info.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* What influences the output */}
          <section>
            <h3 className="font-semibold text-lg mb-3">What Affects the Output?</h3>
            <div className="grid gap-3">
              {info.influences.map((influence, i) => {
                const InfluenceIcon = influence.icon
                return (
                  <div key={i} className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                    <InfluenceIcon className="w-5 h-5 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <p className="font-medium">{influence.name}</p>
                      <p className="text-sm text-muted-foreground">{influence.description}</p>
                      <p className="text-sm text-primary mt-1">{influence.whereToChange}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
