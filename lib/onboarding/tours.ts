import type { DriveStep } from 'driver.js';

export type TourId = 'dashboard' | 'research' | 'readiness' | 'artifacts';

export const TOURS: Record<TourId, DriveStep[]> = {
  dashboard: [
    {
      element: '[data-tour="getting-started"]',
      popover: {
        title: 'Your Progress Tracker',
        description: 'This checklist shows your setup progress. Complete each step to build your AI guru.',
      },
    },
    {
      element: '[data-tour="activity-tiles"]',
      popover: {
        title: 'Quick Stats',
        description: 'These tiles show your research runs, recommendations, artifacts, and profile status. Click any tile to dive deeper.',
      },
    },
    {
      element: '[data-tour="guru-profile"]',
      popover: {
        title: "Your Guru's Identity",
        description: "This is your guru's teaching persona. It defines the domain, audience, and teaching style.",
      },
    },
    {
      element: '[data-tour="recent-activity"]',
      popover: {
        title: 'Activity Feed',
        description: 'See your latest research runs and generated artifacts here. Click to view details.',
      },
    },
    {
      element: '[data-tour="readiness-summary"]',
      popover: {
        title: 'Ready to Create?',
        description: 'This shows if your knowledge base is ready for content generation. Address any gaps before generating artifacts.',
      },
    },
  ],

  research: [
    {
      element: '[data-tour="readiness-indicator"]',
      popover: {
        title: 'Knowledge Readiness',
        description: "This bar shows how complete your guru's knowledge is. Higher is better!",
      },
    },
    {
      element: '[data-tour="suggested-topics"]',
      popover: {
        title: 'What to Research',
        description: 'These are AI-detected gaps in your knowledge base. Red means critical, amber means suggested. Click any topic to start researching it.',
      },
    },
    {
      element: '[data-tour="research-assistant"]',
      popover: {
        title: 'AI Research Partner',
        description: 'Describe what you want to research, and the AI will search the web, analyze sources, and generate recommendations for your corpus.',
      },
    },
    {
      element: '[data-tour="research-history"]',
      popover: {
        title: 'Past Research',
        description: 'All your previous research runs appear here. Click to view findings and recommendations.',
      },
    },
  ],

  readiness: [
    {
      element: '[data-tour="overall-score"]',
      popover: {
        title: 'Your Readiness Score',
        description: "This percentage shows how prepared your guru is to create teaching content. 60%+ with no critical gaps means you're ready!",
      },
    },
    {
      element: '[data-tour="score-breakdown"]',
      popover: {
        title: 'Two Components',
        description: "Profile completeness measures your guru's identity setup. Knowledge coverage measures how well your corpus covers essential teaching dimensions.",
      },
    },
    {
      element: '[data-tour="critical-gaps"]',
      popover: {
        title: 'Must-Fix Gaps',
        description: 'These dimensions are essential for teaching but have low coverage. Research these topics before generating content.',
      },
    },
    {
      element: '[data-tour="dimension-coverage"]',
      popover: {
        title: 'Knowledge Breakdown',
        description: 'Each dimension represents an aspect of good teaching (foundations, progression, mistakes, etc.). Higher coverage = better teaching ability.',
      },
    },
    {
      element: '[data-tour="reassess-button"]',
      popover: {
        title: 'Refresh Score',
        description: 'After adding research, click this to re-analyze your corpus and update the readiness score.',
      },
    },
  ],

  artifacts: [
    {
      element: '[data-tour="artifact-tabs"]',
      popover: {
        title: 'Three Artifact Types',
        description: 'Mental Model = core concepts. Curriculum = structured lessons. Drills = practice exercises. Generate them in order for best results.',
      },
    },
    {
      element: '[data-tour="mode-toggle"]',
      popover: {
        title: 'Two Modes',
        description: 'Simple mode: one-click generation. Advanced mode: version history, prompts, and customization options.',
      },
    },
    {
      element: '[data-tour="generate-button"]',
      popover: {
        title: 'Create Your Content',
        description: 'Click Generate to create this artifact type. The AI uses your corpus and profile to build teaching content.',
      },
    },
    {
      element: '[data-tour="user-notes"]',
      popover: {
        title: 'Custom Instructions',
        description: 'Add notes here to guide generation. Example: "Focus on beginner mistakes" or "Include more examples".',
      },
    },
    {
      element: '[data-tour="artifact-content"]',
      popover: {
        title: 'Your Generated Content',
        description: 'After generation, your artifact appears here. Review it, then proceed to the next artifact type.',
      },
    },
  ],
};
