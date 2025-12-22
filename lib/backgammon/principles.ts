/**
 * Backgammon Principles Module
 *
 * Hard-coded taxonomy of backgammon principles for drill generation.
 * Provides 3 universal principles + 2 phase-specific principles per game phase.
 */

import type { GamePhase } from '@prisma/client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PrincipleDefinition {
  id: string;
  name: string;
  description: string;
  promptGuidance: string; // How to reinforce in drills
}

// ============================================================================
// UNIVERSAL PRINCIPLES (Apply to ALL game phases)
// ============================================================================

export const UNIVERSAL_PRINCIPLES: PrincipleDefinition[] = [
  {
    id: 'pip-count',
    name: 'Pip Count Awareness',
    description: 'Understanding race situations and pip count differentials to make informed decisions about when to run, hold, or attack.',
    promptGuidance: 'Include exercises that require calculating or estimating pip counts. Ask students to identify race situations and explain how pip count influences their decision. Present scenarios where being ahead or behind in the race changes the correct strategy.'
  },
  {
    id: 'risk-reward',
    name: 'Risk vs Reward Assessment',
    description: 'Evaluating the trade-off between exposing blots (risk) and gaining tactical or strategic advantages (reward).',
    promptGuidance: 'Present positions where students must weigh leaving blots against potential gains (making points, escaping, advancing). Include questions about when risk-taking is justified and when it\'s too dangerous. Use scenarios with varying levels of contact and race standing.'
  },
  {
    id: 'cube-timing',
    name: 'Cube Decision Fundamentals',
    description: 'Understanding doubling cube basics: market losers, take points, and when to double or accept/reject doubles.',
    promptGuidance: 'Incorporate cube decision scenarios across all game phases. Ask students to identify market losers (positions that might become too good to double), calculate take points based on winning chances, and explain doubling strategy. Include both initial doubles and recubes.'
  }
];

// ============================================================================
// PHASE-SPECIFIC PRINCIPLES
// ============================================================================

export const PHASE_PRINCIPLES: Record<GamePhase, PrincipleDefinition[]> = {
  OPENING: [
    {
      id: 'point-making',
      name: 'Point-Making Priority',
      description: 'Understanding which points to prioritize making in the opening (especially key points like 5-point, 7-point, and bar-point) and the trade-offs involved.',
      promptGuidance: 'Focus drills on the relative value of different points in the opening. Ask students to explain why certain point-making moves are superior to alternatives (e.g., making the 5-point vs. slotting). Include scenarios where multiple point-making options exist and students must prioritize correctly.'
    },
    {
      id: 'tempo-development',
      name: 'Tempo and Development',
      description: 'Balancing aggressive development (builders, advanced anchors) with safe play. Understanding when to prioritize speed over structure.',
      promptGuidance: 'Create exercises that highlight tempo decisions in the opening: when to bring builders down quickly vs. playing safe, when to run with back checkers vs. making points. Present positions where development speed matters and ask students to identify the key tempo considerations.'
    }
  ],

  EARLY: [
    {
      id: 'priming',
      name: 'Prime Construction',
      description: 'Building and maintaining consecutive points (primes) to trap opponent checkers. Understanding prime extension and prime-vs-prime battles.',
      promptGuidance: 'Design drills around building 4, 5, and 6-point primes. Ask students to identify the best ways to extend primes, when to sacrifice other priorities for prime-building, and how to handle trapped checkers. Include scenarios where both players are building primes.'
    },
    {
      id: 'anchoring',
      name: 'Anchor Strategy',
      description: 'Understanding when and where to establish defensive anchors (especially the 20-point and 18-point). Using anchors to launch attacks or as insurance in racing scenarios.',
      promptGuidance: 'Present positions where anchor decisions matter: whether to establish an anchor vs. escaping, which anchor point is best for the position, and when to abandon an anchor. Include scenarios where anchor depth affects strategy (deep anchor vs. advanced anchor).'
    }
  ],

  MIDDLE: [
    {
      id: 'attack-timing',
      name: 'Attack Timing',
      description: 'Knowing when to launch an attack (hitting and making points) vs. consolidating or running. Understanding blitz timing and holding game transitions.',
      promptGuidance: 'Create scenarios requiring attack/defend decisions. Ask students to identify positions that warrant aggressive attacks vs. safe consolidation. Include positions where timing is critical—attacking too early or too late costs equity. Present transitions from holding games to attacks.'
    },
    {
      id: 'back-game',
      name: 'Back Game Recognition',
      description: 'Identifying when to pursue a back game (holding two points in opponent\'s board), how to maintain timing, and when back games become viable or desperate.',
      promptGuidance: 'Design drills that help students recognize back game positions and understand timing requirements. Ask when back games are correct strategy vs. desperation. Include exercises on maintaining back game timing (not crashing too early) and identifying strong vs. weak back game formations.'
    }
  ],

  BEAROFF: [
    {
      id: 'race-efficiency',
      name: 'Efficient Bearing Off',
      description: 'Optimal checker distribution and bearing-off technique in pure race situations. Understanding when to prioritize speed vs. safety.',
      promptGuidance: 'Focus on bearing-off mechanics: optimal pip usage, when to break points, proper distribution of checkers. Ask students to identify the most efficient bearing-off sequences and explain the reasoning. Include positions with awkward distributions requiring careful calculation.'
    },
    {
      id: 'contact-bearoff',
      name: 'Contact Bear-Off',
      description: 'Bearing off while maintaining contact threats or defensive structure. Balancing speed with safety when opponent still has chances.',
      promptGuidance: 'Create scenarios where students must bear off while maintaining hitting threats or defensive coverage. Include positions where leaving shots might be necessary for tempo, or where safe play is paramount. Ask students to identify when contact considerations override pure racing efficiency.'
    }
  ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all principle IDs for the given game phases (universal + phase-specific)
 * If no phases specified, returns ALL principles (universal + all phase-specific)
 */
export function getAllPrincipleIds(phases?: GamePhase[]): string[] {
  const universalIds = UNIVERSAL_PRINCIPLES.map(p => p.id);

  // If no phases specified, get ALL phase-specific principles
  const phasesToUse = phases ?? (['OPENING', 'EARLY', 'MIDDLE', 'BEAROFF'] as GamePhase[]);

  const phaseSpecificIds = phasesToUse.flatMap(phase =>
    PHASE_PRINCIPLES[phase].map(p => p.id)
  );

  // Return unique IDs (in case of duplicates, though there shouldn't be any)
  return Array.from(new Set([...universalIds, ...phaseSpecificIds]));
}

/**
 * Find a principle definition by ID across all collections
 */
export function getPrincipleById(id: string): PrincipleDefinition | undefined {
  // Check universal principles first
  const universal = UNIVERSAL_PRINCIPLES.find(p => p.id === id);
  if (universal) return universal;

  // Check all phase-specific principles
  for (const phase of Object.keys(PHASE_PRINCIPLES) as GamePhase[]) {
    const principle = PHASE_PRINCIPLES[phase].find(p => p.id === id);
    if (principle) return principle;
  }

  return undefined;
}

/**
 * Get the 3 universal principles that apply to all game phases
 */
export function getUniversalPrinciples(): PrincipleDefinition[] {
  return UNIVERSAL_PRINCIPLES;
}

/**
 * Get the 2 phase-specific principles for a given game phase
 */
export function getPhasePrinciples(phase: GamePhase): PrincipleDefinition[] {
  return PHASE_PRINCIPLES[phase];
}

/**
 * Get all principles for a specific phase (universal + phase-specific)
 */
export function getAllPrinciplesForPhase(phase: GamePhase): PrincipleDefinition[] {
  return [...UNIVERSAL_PRINCIPLES, ...PHASE_PRINCIPLES[phase]];
}

/**
 * Get comprehensive principle data for prompt injection
 */
export function getPrincipleDataForPrompt(phases: GamePhase[]): {
  universal: PrincipleDefinition[];
  phaseSpecific: Record<GamePhase, PrincipleDefinition[]>;
  allIds: string[];
} {
  const phaseSpecific: Record<GamePhase, PrincipleDefinition[]> = {} as Record<GamePhase, PrincipleDefinition[]>;

  phases.forEach(phase => {
    phaseSpecific[phase] = PHASE_PRINCIPLES[phase];
  });

  return {
    universal: UNIVERSAL_PRINCIPLES,
    phaseSpecific,
    allIds: getAllPrincipleIds(phases)
  };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getAllPrinciplesForPhase instead
 */
export function getPrinciplesForPhase(phase: GamePhase) {
  return { universal: UNIVERSAL_PRINCIPLES, phaseSpecific: PHASE_PRINCIPLES[phase] };
}
