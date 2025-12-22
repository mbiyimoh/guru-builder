import { z } from 'zod';

/**
 * Guru Profile Data Schema
 *
 * Defines the complete profile structure for an AI teaching assistant (guru).
 * Used for synthesis from user brain dumps and validation of profile data.
 */
export const guruProfileDataSchema = z.object({
  // Domain & Expertise
  domainExpertise: z.string().min(1, 'Domain expertise is required').describe('Primary teaching domain or field of expertise'),
  specificTopics: z.array(z.string()).min(1, 'At least one specific topic is required').describe('Key topics, subjects, or areas covered by this guru'),
  yearsOfExperience: z.number().int().positive().nullable().describe('Years of experience in the domain (optional)'),

  // Audience
  audienceLevel: z.enum(['beginner', 'intermediate', 'advanced', 'mixed']).describe('Primary skill level of the target audience'),
  audienceDescription: z.string().min(1, 'Audience description is required').describe('Detailed description of who this guru teaches'),

  // Teaching Style
  pedagogicalApproach: z.string().min(1, 'Pedagogical approach is required').describe('Core teaching methodology or educational philosophy'),
  tone: z.enum(['formal', 'conversational', 'encouraging', 'direct', 'socratic']).describe('Overall communication tone'),
  communicationStyle: z.string().min(1, 'Communication style is required').describe('How the guru communicates concepts and interacts with learners'),

  // Content Preferences
  emphasizedConcepts: z.array(z.string()).describe('Key concepts or principles to emphasize in teaching'),
  avoidedTopics: z.array(z.string()).describe('Topics to avoid, minimize, or handle with care'),
  examplePreferences: z.string().describe('Preferences for how examples should be used (concrete vs abstract, domain-specific, etc.)'),

  // Unique Characteristics
  uniquePerspective: z.string().min(1, 'Unique perspective is required').describe('What makes this guru\'s approach distinctive or valuable'),
  commonMisconceptions: z.array(z.string()).describe('Common misconceptions or pitfalls learners face that the guru should address'),
  successMetrics: z.string().min(1, 'Success metrics are required').describe('How the guru measures learning success or student progress'),

  // Meta
  additionalContext: z.string().nullable().describe('Any additional context, constraints, or information not captured elsewhere'),
});

/**
 * Inferred TypeScript type from the Zod schema
 */
export type GuruProfileData = z.infer<typeof guruProfileDataSchema>;

/**
 * Synthesis mode indicating how the profile was created
 */
export const synthesisModeSchema = z.enum(['VOICE', 'TEXT', 'MIXED']);
export type SynthesisMode = z.infer<typeof synthesisModeSchema>;

/**
 * Result of AI synthesis process
 *
 * Includes the synthesized profile, metadata about inference quality,
 * and traceability back to the original input.
 */
export const synthesisResultSchema = z.object({
  profile: guruProfileDataSchema.describe('The synthesized guru profile data'),
  lightAreas: z.array(z.string()).describe('Field names that were inferred with lower confidence or from limited information'),
  confidence: z.number().min(0).max(1).describe('Overall confidence score for the synthesis (0-1)'),
  rawInput: z.string().describe('Original brain dump text provided by the user'),
  synthesisMode: synthesisModeSchema.describe('Input mode used for synthesis'),
});

/**
 * Inferred TypeScript type for synthesis result
 */
export type SynthesisResult = z.infer<typeof synthesisResultSchema>;

/**
 * Error codes for synthesis failures
 */
export enum SynthesisErrorCode {
  TIMEOUT = 'SYNTHESIS_TIMEOUT',
  INVALID_JSON = 'INVALID_JSON_RESPONSE',
  SCHEMA_VALIDATION = 'SCHEMA_VALIDATION_FAILED',
  API_ERROR = 'OPENAI_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

/**
 * Error object for synthesis API failures
 */
export const synthesisErrorSchema = z.object({
  code: z.nativeEnum(SynthesisErrorCode).describe('Machine-readable error code'),
  message: z.string().describe('Human-readable error message'),
  retryable: z.boolean().describe('Whether the operation can be retried'),
});

/**
 * Inferred TypeScript type for synthesis errors
 */
export type SynthesisError = z.infer<typeof synthesisErrorSchema>;

/**
 * API response schema for guru profile synthesis
 *
 * Discriminated union based on success field.
 */
export const synthesizeGuruProfileResponseSchema = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    profile: synthesisResultSchema,
  }),
  z.object({
    success: z.literal(false),
    error: synthesisErrorSchema,
  }),
]);

/**
 * Inferred TypeScript type for API response
 */
export type SynthesizeGuruProfileResponse = z.infer<typeof synthesizeGuruProfileResponseSchema>;

/**
 * Helper type guards for working with the API response
 */
export function isSuccessResponse(
  response: SynthesizeGuruProfileResponse
): response is Extract<SynthesizeGuruProfileResponse, { success: true }> {
  return response.success === true;
}

export function isErrorResponse(
  response: SynthesizeGuruProfileResponse
): response is Extract<SynthesizeGuruProfileResponse, { success: false }> {
  return response.success === false;
}

/**
 * Validation helper to check if an error is retryable
 */
export function isRetryableError(error: SynthesisError): boolean {
  return error.retryable;
}

/**
 * Default values for optional fields
 */
export const GURU_PROFILE_DEFAULTS = {
  yearsOfExperience: null,
  emphasizedConcepts: [],
  avoidedTopics: [],
  commonMisconceptions: [],
  additionalContext: null,
} as const;

/**
 * Field name type for type-safe references to profile fields
 */
export type GuruProfileField = keyof GuruProfileData;

/**
 * Validation helper to get all required fields
 */
export function getRequiredFields(): GuruProfileField[] {
  return [
    'domainExpertise',
    'specificTopics',
    'audienceLevel',
    'audienceDescription',
    'pedagogicalApproach',
    'tone',
    'communicationStyle',
    'examplePreferences',
    'uniquePerspective',
    'successMetrics',
  ];
}

/**
 * Validation helper to check if a field is required
 */
export function isRequiredField(field: GuruProfileField): boolean {
  return getRequiredFields().includes(field);
}
