/**
 * Shared types for the teaching/artifact system.
 * Consolidates prompt-related interfaces to avoid duplication.
 */

/**
 * A single prompt configuration item (system or user prompt).
 */
export interface PromptConfigItem {
  current: string;
  default: string;
  isCustom: boolean;
}

/**
 * Full prompt configuration containing both system and user prompts.
 */
export interface PromptConfig {
  systemPrompt: PromptConfigItem;
  userPrompt: PromptConfigItem;
}

/**
 * Prompt metadata for displaying in artifact viewers.
 * Indicates whether custom prompts were used and if there's drift.
 */
export interface PromptInfo {
  /** Whether the artifact was generated with custom (non-default) prompts */
  isCustom: boolean;
  /** Whether current project prompts differ from what was used to generate this artifact */
  hasPromptDrift: boolean;
  /** The current prompt configuration for viewing/editing */
  currentConfig: PromptConfig;
}
