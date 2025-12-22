/**
 * Shared formatting utilities for Position Library components.
 * Consolidated here to avoid duplication across PositionCard, PositionDetailModal, etc.
 */

import { cn } from '@/lib/utils'

// =============================================================================
// EQUITY FORMATTING
// =============================================================================

/**
 * Format equity value with sign prefix.
 * @param equity - The equity value (positive or negative)
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted string like "+0.234" or "-0.156"
 */
export function formatEquity(equity: number, decimals = 3): string {
  return equity >= 0
    ? `+${equity.toFixed(decimals)}`
    : equity.toFixed(decimals)
}

/**
 * Get the appropriate text color class for an equity value.
 * Positive = green, negative = red
 */
export function getEquityColorClass(equity: number): string {
  return equity >= 0 ? 'text-green-600' : 'text-red-600'
}

// =============================================================================
// PHASE BADGES
// =============================================================================

export type GamePhase = 'OPENING' | 'EARLY' | 'MIDDLE' | 'BEAROFF'

interface BadgeConfig {
  label: string
  className: string
}

export const PHASE_BADGE_CONFIG: Record<GamePhase, BadgeConfig> = {
  OPENING: { label: 'Opening', className: 'bg-emerald-100 text-emerald-700' },
  EARLY: { label: 'Early', className: 'bg-sky-100 text-sky-700' },
  MIDDLE: { label: 'Middle', className: 'bg-orange-100 text-orange-700' },
  BEAROFF: { label: 'Bearoff', className: 'bg-rose-100 text-rose-700' },
}

/**
 * Format a game phase enum to display label.
 */
export function formatPhase(phase: string): string {
  return PHASE_BADGE_CONFIG[phase as GamePhase]?.label || phase
}

/**
 * Get badge styling for a game phase.
 */
export function getPhaseBadgeClass(phase: string, baseClass = 'px-2 py-0.5 text-xs font-medium rounded'): string {
  const config = PHASE_BADGE_CONFIG[phase as GamePhase]
  return cn(baseClass, config?.className || 'bg-gray-100 text-gray-600')
}

// =============================================================================
// SOURCE BADGES
// =============================================================================

export type PositionSource = 'OPENING_CATALOG' | 'MATCH_IMPORT' | 'CURATED' | 'SELF_PLAY'

export const SOURCE_BADGE_CONFIG: Record<PositionSource, BadgeConfig> = {
  OPENING_CATALOG: { label: 'Catalog', className: 'bg-blue-100 text-blue-700' },
  MATCH_IMPORT: { label: 'Match', className: 'bg-amber-100 text-amber-700' },
  CURATED: { label: 'Curated', className: 'bg-purple-100 text-purple-700' },
  SELF_PLAY: { label: 'Self-Play', className: 'bg-gray-100 text-gray-700' },
}

/**
 * Format a source type enum to display label.
 */
export function formatSource(source: string): string {
  return SOURCE_BADGE_CONFIG[source as PositionSource]?.label || source
}

/**
 * Get badge styling for a source type.
 */
export function getSourceBadgeClass(source: string, baseClass = 'px-1.5 py-0.5 text-xs font-medium rounded'): string {
  const config = SOURCE_BADGE_CONFIG[source as PositionSource]
  return cn(baseClass, config?.className || 'bg-gray-100 text-gray-600')
}
