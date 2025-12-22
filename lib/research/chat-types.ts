export interface ResearchPlan {
  title: string;
  objective: string;
  queries: string[];
  focusAreas: string[];
  expectedOutcomes: string[];
  depth: 'QUICK' | 'MODERATE' | 'DEEP';
}

export interface ResearchChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  planUpdate?: Partial<ResearchPlan>;  // If assistant suggests plan changes
}

export interface ResearchChatState {
  messages: ResearchChatMessage[];
  currentPlan: ResearchPlan | null;
  isRefining: boolean;
}
