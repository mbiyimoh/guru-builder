// lib/drills/index.ts
// Barrel export for Drills module

export {
  populateDrillsFromArtifact,
  syncArtifactContent,
  reorderDrillsInPhase,
  softDeleteDrill,
  restoreDrill,
} from './sync'

export type { PopulateResult, SyncResult } from './sync'
