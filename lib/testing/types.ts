export interface GuruTestMessage {
  id: string;
  role: 'user' | 'guru';
  content: string;
  timestamp: Date;
}

export interface GuruTestSession {
  projectId: string;
  messages: GuruTestMessage[];
  messageCount: number;
  maxMessages: number;  // 20
  startedAt: Date;
}

export const MAX_TEST_MESSAGES = 20;
