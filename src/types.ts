export interface ClaudeSession {
  sessionId: string;
  fullPath: string;
  fileMtime: number;
  messageCount: number;
  created: string;
  modified: string;
  gitBranch?: string;
  projectPath: string;
}

export interface SessionsIndex {
  version: number;
  entries?: ClaudeSession[];
  sessions?: ClaudeSession[];  // Legacy fallback
  originalPath?: string;
}

export interface ClaudeStats {
  version: number;
  lastComputedDate: string;
  dailyActivity: DailyActivity[];
  dailyModelTokens: DailyModelTokens[];
  modelUsage: Record<string, TokenUsage>;
  totalSessions: number;
  totalMessages: number;
  longestSession?: {
    sessionId: string;
    messageCount: number;
  };
  hourCounts: Record<string, number>;
}

export interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

export interface DailyModelTokens {
  date: string;
  modelTokens: Record<string, TokenUsage>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

export interface HistoryEntry {
  display: string;
  pastedContents?: Record<string, string>;
  timestamp: number;
  project?: string;
  sessionId?: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  escapedPath: string;
  sessions: ClaudeSession[];
  totalMessages: number;
  lastModified: Date;
}
