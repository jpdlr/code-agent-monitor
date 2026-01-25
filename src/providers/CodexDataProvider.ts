import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CodexSession {
  id: string;
  timestamp: string;
  cwd: string;
  model_provider: string;
  cli_version: string;
  source: string;
  filePath: string;
  fileSize: number;
}

export interface CodexProjectInfo {
  name: string;
  path: string;
  sessions: CodexSession[];
  totalSessions: number;
  lastModified: Date;
}

export class CodexDataProvider {
  private codexDir: string;

  constructor() {
    this.codexDir = path.join(os.homedir(), '.codex');
  }

  getCodexDir(): string {
    return this.codexDir;
  }

  isAvailable(): boolean {
    return fs.existsSync(this.codexDir);
  }

  async getSessions(): Promise<CodexSession[]> {
    const sessionsDir = path.join(this.codexDir, 'sessions');

    if (!fs.existsSync(sessionsDir)) {
      return [];
    }

    const sessions: CodexSession[] = [];

    try {
      // Walk year/month/day structure
      const years = fs.readdirSync(sessionsDir, { withFileTypes: true });

      for (const year of years) {
        if (!year.isDirectory()) continue;
        const yearPath = path.join(sessionsDir, year.name);
        const months = fs.readdirSync(yearPath, { withFileTypes: true });

        for (const month of months) {
          if (!month.isDirectory()) continue;
          const monthPath = path.join(yearPath, month.name);
          const days = fs.readdirSync(monthPath, { withFileTypes: true });

          for (const day of days) {
            if (!day.isDirectory()) continue;
            const dayPath = path.join(monthPath, day.name);
            const files = fs.readdirSync(dayPath);

            for (const file of files) {
              if (!file.endsWith('.jsonl')) continue;

              const filePath = path.join(dayPath, file);
              const session = await this.parseSessionFile(filePath);
              if (session) {
                sessions.push(session);
              }
            }
          }
        }
      }
    } catch {
      // Ignore errors
    }

    // Sort by timestamp descending
    return sessions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  private async parseSessionFile(filePath: string): Promise<CodexSession | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      const firstEvent = JSON.parse(firstLine);

      if (firstEvent.type === 'session_meta' && firstEvent.payload) {
        const meta = firstEvent.payload;
        const stats = fs.statSync(filePath);

        return {
          id: meta.id,
          timestamp: meta.timestamp,
          cwd: meta.cwd,
          model_provider: meta.model_provider || 'openai',
          cli_version: meta.cli_version,
          source: meta.source || 'cli',
          filePath,
          fileSize: stats.size,
        };
      }
    } catch {
      // Skip invalid files
    }
    return null;
  }

  async getProjects(): Promise<CodexProjectInfo[]> {
    const sessions = await this.getSessions();
    const projectMap = new Map<string, CodexProjectInfo>();

    for (const session of sessions) {
      const projectPath = session.cwd;
      const projectName = path.basename(projectPath);

      if (!projectMap.has(projectPath)) {
        projectMap.set(projectPath, {
          name: projectName,
          path: projectPath,
          sessions: [],
          totalSessions: 0,
          lastModified: new Date(0),
        });
      }

      const project = projectMap.get(projectPath)!;
      project.sessions.push(session);
      project.totalSessions++;

      const sessionDate = new Date(session.timestamp);
      if (sessionDate > project.lastModified) {
        project.lastModified = sessionDate;
      }
    }

    return Array.from(projectMap.values()).sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    );
  }

  async getRecentStats(): Promise<{
    totalSessions: number;
    recentSessions: number;
    providers: string[];
  }> {
    const sessions = await this.getSessions();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recentSessions = sessions.filter(
      (s) => new Date(s.timestamp) > weekAgo
    ).length;

    const providers = [...new Set(sessions.map((s) => s.model_provider))];

    return {
      totalSessions: sessions.length,
      recentSessions,
      providers,
    };
  }

  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}
