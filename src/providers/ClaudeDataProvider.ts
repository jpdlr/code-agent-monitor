import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  ClaudeSession,
  SessionsIndex,
  ClaudeStats,
  HistoryEntry,
  ProjectInfo,
} from '../types';

export class ClaudeDataProvider {
  private claudeDir: string;

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
  }

  getClaudeDir(): string {
    return this.claudeDir;
  }

  async getProjects(): Promise<ProjectInfo[]> {
    const projectsDir = path.join(this.claudeDir, 'projects');

    if (!fs.existsSync(projectsDir)) {
      return [];
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    const projects: ProjectInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const indexPath = path.join(projectsDir, entry.name, 'sessions-index.json');

      if (!fs.existsSync(indexPath)) {
        continue;
      }

      try {
        const indexContent = fs.readFileSync(indexPath, 'utf-8');
        const index: SessionsIndex = JSON.parse(indexContent);

        const projectPath = index.originalPath || this.unescapePath(entry.name);
        const projectName = path.basename(projectPath);

        // sessions-index.json uses "entries" not "sessions"
        const sessions = index.entries || index.sessions || [];
        const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);

        let lastModified = new Date(0);
        for (const session of sessions) {
          const modified = new Date(session.modified);
          if (modified > lastModified) {
            lastModified = modified;
          }
        }

        projects.push({
          name: projectName,
          path: projectPath,
          escapedPath: entry.name,
          sessions: sessions.sort(
            (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
          ),
          totalMessages,
          lastModified,
        });
      } catch {
        // Skip invalid projects
      }
    }

    // Sort by last modified
    return projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  }

  async getStats(): Promise<ClaudeStats | null> {
    const statsPath = path.join(this.claudeDir, 'stats-cache.json');

    if (!fs.existsSync(statsPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(statsPath, 'utf-8');
      return JSON.parse(content) as ClaudeStats;
    } catch {
      return null;
    }
  }

  async getRecentHistory(limit: number = 20): Promise<HistoryEntry[]> {
    const historyPath = path.join(this.claudeDir, 'history.jsonl');

    if (!fs.existsSync(historyPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(historyPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const entries: HistoryEntry[] = [];

      for (const line of lines.slice(-limit)) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip invalid lines
        }
      }

      return entries.reverse();
    } catch {
      return [];
    }
  }

  async getTodayStats(): Promise<{
    messages: number;
    sessions: number;
    toolCalls: number;
    totalTokens: number;
    date: string;
  }> {
    const stats = await this.getStats();
    const today = new Date().toISOString().split('T')[0];

    if (!stats || !stats.dailyActivity || stats.dailyActivity.length === 0) {
      return { messages: 0, sessions: 0, toolCalls: 0, totalTokens: 0, date: today };
    }

    // Try to find today's data, otherwise use the most recent day
    let activity = stats.dailyActivity.find((d) => d.date === today);
    let tokenData = stats.dailyModelTokens?.find((d) => d.date === today);
    let dateLabel = today;

    if (!activity) {
      // Fall back to most recent day
      activity = stats.dailyActivity[stats.dailyActivity.length - 1];
      tokenData = stats.dailyModelTokens?.[stats.dailyModelTokens.length - 1];
      dateLabel = activity?.date || today;
    }

    // Daily tokens only have total per model, not input/output breakdown
    // Sum all model totals for the day
    let totalTokens = 0;

    if (tokenData?.tokensByModel) {
      for (const count of Object.values(tokenData.tokensByModel)) {
        totalTokens += (count as number) || 0;
      }
    }

    return {
      messages: activity?.messageCount || 0,
      sessions: activity?.sessionCount || 0,
      toolCalls: activity?.toolCallCount || 0,
      totalTokens,
      date: dateLabel,
    };
  }

  async getModelUsage(): Promise<Record<string, { input: number; output: number }>> {
    const stats = await this.getStats();

    if (!stats?.modelUsage) {
      return {};
    }

    const result: Record<string, { input: number; output: number }> = {};

    for (const [model, usage] of Object.entries(stats.modelUsage)) {
      const shortName = this.getShortModelName(model);
      result[shortName] = {
        input: usage.inputTokens || 0,
        output: usage.outputTokens || 0,
      };
    }

    return result;
  }

  private getShortModelName(fullName: string): string {
    if (fullName.includes('opus')) {
      return 'Opus';
    }
    if (fullName.includes('sonnet')) {
      return 'Sonnet';
    }
    if (fullName.includes('haiku')) {
      return 'Haiku';
    }
    return fullName.split('-')[0];
  }

  private unescapePath(escapedPath: string): string {
    return escapedPath.replace(/-/g, '/');
  }

  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    }
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString();
  }

  formatTokenCount(count: number): string {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  }
}
