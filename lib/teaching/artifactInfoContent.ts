// lib/teaching/artifactInfoContent.ts
// Content definitions for artifact creation explanation modal

import {
  Brain,
  BookOpen,
  Target,
  FileText,
  Settings,
  MessageSquare,
  User,
  CheckCircle,
  Layout,
  type LucideIcon
} from 'lucide-react'

interface Step {
  title: string
  description: string
}

interface Influence {
  icon: LucideIcon
  name: string
  description: string
  whereToChange: string
}

interface ArtifactInfo {
  icon: LucideIcon
  title: string
  overview: string
  steps: Step[]
  influences: Influence[]
}

export const ARTIFACT_CREATION_INFO: Record<'MENTAL_MODEL' | 'CURRICULUM' | 'DRILL_SERIES', ArtifactInfo> = {
  MENTAL_MODEL: {
    icon: Brain,
    title: 'Mental Model',
    overview: 'The Mental Model is the foundation of your guru. It extracts the core principles and concepts from your knowledge corpus that learners need to master, structured as a teachable framework.',
    steps: [
      {
        title: 'Compose Corpus',
        description: 'All active context layers and knowledge files are combined into a unified knowledge base for analysis.'
      },
      {
        title: 'Analyze Structure',
        description: 'GPT-4o analyzes the corpus to identify major themes, domain categories, and conceptual relationships.'
      },
      {
        title: 'Extract Principles',
        description: 'Core principles are extracted with structured detail: essence, importance, common mistakes, and recognition patterns.'
      },
      {
        title: 'Build Framework',
        description: 'Principles are organized into a hierarchical, teachable framework showing how concepts connect and build on each other.'
      }
    ],
    influences: [
      {
        icon: FileText,
        name: 'Your Corpus',
        description: 'The content in your context layers and knowledge files directly determines what principles are extracted.',
        whereToChange: 'Add or edit content in the Corpus tab'
      },
      {
        icon: User,
        name: 'Guru Profile',
        description: 'Your guru\'s teaching style, target audience, and personality shape how principles are framed and explained.',
        whereToChange: 'Configure in Guru Profile section'
      },
      {
        icon: Settings,
        name: 'System Prompt',
        description: 'Controls the AI\'s pedagogical approach and how knowledge is structured.',
        whereToChange: 'Edit in Prompt Settings (View/Edit Prompts)'
      },
      {
        icon: MessageSquare,
        name: 'User Notes',
        description: 'Your guidance when generating (e.g., "focus on beginner concepts") influences emphasis and scope.',
        whereToChange: 'Add notes when clicking Generate'
      }
    ]
  },

  CURRICULUM: {
    icon: BookOpen,
    title: 'Curriculum',
    overview: 'The Curriculum creates a structured learning path based on your Mental Model. It organizes principles into phase-based modules with lessons that progress from universal concepts to phase-specific mastery.',
    steps: [
      {
        title: 'Load Prerequisites',
        description: 'The Mental Model\'s principles and framework are loaded as the foundation for curriculum design.'
      },
      {
        title: 'Design Learning Path',
        description: 'GPT-4o designs a progression organized by game phases (Opening, Early, Middle, Bearoff), ensuring prerequisites come first.'
      },
      {
        title: 'Structure Modules',
        description: 'Each phase module contains principle units with four lesson types: Concept (theory), Example (demonstration), Practice (application), and Summary (reinforcement).'
      },
      {
        title: 'Verify Content',
        description: 'If Ground Truth is enabled, factual claims in lesson content are extracted and verified against the backgammon engine.'
      }
    ],
    influences: [
      {
        icon: Brain,
        name: 'Mental Model',
        description: 'The principles and structure from your Mental Model directly shape what\'s taught and in what order.',
        whereToChange: 'Regenerate the Mental Model or adjust your corpus'
      },
      {
        icon: User,
        name: 'Guru Profile',
        description: 'Your guru\'s teaching style and target audience influence lesson tone and complexity.',
        whereToChange: 'Configure in Guru Profile section'
      },
      {
        icon: CheckCircle,
        name: 'Ground Truth Engine',
        description: 'When enabled, move recommendations and position evaluations are verified for accuracy.',
        whereToChange: 'Enable in Ground Truth settings'
      },
      {
        icon: Settings,
        name: 'Prompts',
        description: 'Control lesson structure, teaching approaches, and pedagogical style.',
        whereToChange: 'Edit in Prompt Settings'
      }
    ]
  },

  DRILL_SERIES: {
    icon: Target,
    title: 'Drill Series',
    overview: 'Drills are scenario-based practice exercises organized by game phase and principle. Each drill presents a real position from expert matches and tests the learner\'s ability to apply specific principles.',
    steps: [
      {
        title: 'Load Prerequisites',
        description: 'Mental Model (for principles) and Curriculum (for structure) are loaded to inform drill design.'
      },
      {
        title: 'Seed Positions',
        description: 'Real game positions are loaded from the Position Library - 460+ positions from expert matches across all four game phases.'
      },
      {
        title: 'Design Drills',
        description: 'GPT-4o creates drills organized by phase and principle, using varied methodologies (case analysis, error detection, principle application). Includes automatic retry if target count isn\'t met.'
      },
      {
        title: 'Verify Answers',
        description: 'If Ground Truth is enabled, correct answers are verified against the backgammon engine. Claims are extracted and batch-verified.'
      },
      {
        title: 'Generate Feedback',
        description: 'Each drill gets principle-linked feedback for correct and incorrect answers, plus hints and detailed explanations.'
      },
      {
        title: 'Sync to Library',
        description: 'Generated drills are synced to the Drill Library for individual management and future reuse.'
      }
    ],
    influences: [
      {
        icon: Layout,
        name: 'Position Library',
        description: 'Real game positions from expert match archives. Positions are organized by phase and include verified best moves.',
        whereToChange: 'Import matches via Match Import to add positions'
      },
      {
        icon: Target,
        name: 'Drill Configuration',
        description: 'Target drill count, which game phases to include, and position usage settings.',
        whereToChange: 'Adjust in the configuration panel before generating'
      },
      {
        icon: Brain,
        name: 'Principles',
        description: 'Drills are tagged with primary and universal principles from the backgammon taxonomy (11 principles total).',
        whereToChange: 'Regenerate Mental Model to influence principle coverage'
      },
      {
        icon: CheckCircle,
        name: 'Ground Truth Engine',
        description: 'When enabled, provides position seeding and verifies drill answers against GNUBG analysis.',
        whereToChange: 'Enable in Ground Truth settings'
      },
      {
        icon: Settings,
        name: 'Prompts',
        description: 'Controls drill format, methodology distribution, tier balance, and pedagogical approach.',
        whereToChange: 'Edit in Prompt Settings'
      }
    ]
  }
}
