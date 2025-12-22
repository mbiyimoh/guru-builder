'use client'

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VerificationBadgeProps {
  status: 'VERIFIED' | 'NEEDS_REVIEW' | 'UNVERIFIED' | 'FAILED' | null | undefined
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  onClick?: () => void  // For opening details modal
}

const STATUS_CONFIG = {
  VERIFIED: {
    label: 'Verified',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
    tooltip: 'All content verified against ground truth engine'
  },
  NEEDS_REVIEW: {
    label: 'Needs Review',
    icon: AlertCircle,
    className: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
    tooltip: 'Some claims could not be verified - human review recommended'
  },
  UNVERIFIED: {
    label: 'Unverified',
    icon: HelpCircle,
    className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
    tooltip: 'Generated without ground truth validation'
  },
  FAILED: {
    label: 'Verification Failed',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
    tooltip: 'Verification process encountered an error'
  }
} as const

export function VerificationBadge({
  status,
  size = 'md',
  showTooltip = true,
  onClick
}: VerificationBadgeProps) {
  // Don't render if no status
  if (!status) return null

  const config = STATUS_CONFIG[status]
  if (!config) return null

  const Icon = config.icon

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        config.className,
        sizeClasses[size],
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
      title={showTooltip ? config.tooltip : undefined}
    >
      <Icon className={iconSizes[size]} />
      {config.label}
    </Badge>
  )
}

// Export status config for use elsewhere
export { STATUS_CONFIG as VERIFICATION_STATUS_CONFIG }
