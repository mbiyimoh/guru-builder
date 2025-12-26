'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ClickableCardProps {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * ClickableCard - A Link-like wrapper that shows loading feedback during navigation.
 *
 * Uses React's useTransition to detect navigation state and shows:
 * - Reduced opacity on the card
 * - Small spinner in the corner
 *
 * This eliminates the "dead click" problem where users see no feedback
 * for 1-3 seconds while the next page loads.
 */
export function ClickableCard({ href, children, className }: ClickableCardProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    startTransition(() => {
      router.push(href)
    })
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        'block relative cursor-pointer transition-opacity duration-150',
        isPending && 'opacity-60 pointer-events-none',
        className
      )}
    >
      {children}
      {isPending && (
        <div className="absolute top-3 right-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </a>
  )
}
