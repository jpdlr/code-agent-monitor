import * as vscode from 'vscode';
import { ClaudeDataProvider } from '../providers/ClaudeDataProvider';
import { CodexDataProvider } from '../providers/CodexDataProvider';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly claudeProvider: ClaudeDataProvider;
  private readonly codexProvider: CodexDataProvider;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, claudeProvider: ClaudeDataProvider, codexProvider: CodexDataProvider) {
    this.panel = panel;
    this.claudeProvider = claudeProvider;
    this.codexProvider = codexProvider;

    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            this.update();
            break;
          case 'openSession':
            if (message.path) {
              const uri = vscode.Uri.file(message.path);
              vscode.window.showTextDocument(uri, { preview: true });
            }
            break;
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri, claudeProvider: ClaudeDataProvider, codexProvider?: CodexDataProvider) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      DashboardPanel.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'codeAgentDashboard',
      'Code Agent Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, claudeProvider, codexProvider || new CodexDataProvider());
  }

  private async update() {
    const stats = await this.claudeProvider.getStats();
    const projects = await this.claudeProvider.getProjects();
    const todayStats = await this.claudeProvider.getTodayStats();
    const modelUsage = await this.claudeProvider.getModelUsage();
    const codexStats = this.codexProvider.isAvailable() ? await this.codexProvider.getRecentStats() : null;
    const codexProjects = this.codexProvider.isAvailable() ? await this.codexProvider.getProjects() : [];

    this.panel.webview.html = this.getHtmlContent(stats, projects, todayStats, modelUsage, codexStats, codexProjects);
  }

  private getHtmlContent(
    stats: any,
    projects: any[],
    recentStats: any,
    modelUsage: Record<string, { input: number; output: number }>,
    codexStats: { totalSessions: number; recentSessions: number; providers: string[] } | null,
    codexProjects: any[]
  ): string {
    const dailyData = stats?.dailyActivity?.slice(-14) || [];
    const totalTokens = Object.values(modelUsage).reduce(
      (sum, m) => sum + m.input + m.output,
      0
    );

    // Format date label
    const todayDate = new Date().toISOString().split('T')[0];
    const isToday = recentStats.date === todayDate;
    const dateLabel = isToday ? 'Today' : this.formatDateLabel(recentStats.date);

    // Calculate combined totals
    const totalSessions = (stats?.totalSessions || 0) + (codexStats?.totalSessions || 0);
    const claudeSessions = stats?.totalSessions || 0;
    const codexSessions = codexStats?.totalSessions || 0;

    // Merge and sort projects by last modified
    const mergedProjects = this.mergeProjects(projects, codexProjects);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Agent Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --card-bg: var(--vscode-editorWidget-background);
      --accent: var(--vscode-textLink-foreground);
      --muted: var(--vscode-descriptionForeground);
      --claude-color: #d97706;
      --codex-color: #059669;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      padding: 24px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    h1 { font-size: 1.5rem; font-weight: 600; }

    .provider-pills {
      display: flex;
      gap: 8px;
    }

    .provider-pill {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .provider-pill.claude {
      background: rgba(217, 119, 6, 0.15);
      color: var(--claude-color);
    }

    .provider-pill.codex {
      background: rgba(5, 150, 105, 0.15);
      color: var(--codex-color);
    }

    .provider-pill .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .provider-pill.claude .dot { background: var(--claude-color); }
    .provider-pill.codex .dot { background: var(--codex-color); }

    .refresh-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }

    .stat-card .label {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .stat-card .value {
      font-size: 28px;
      font-weight: 600;
    }

    .stat-card .subtext {
      font-size: 11px;
      color: var(--muted);
      margin-top: 4px;
    }

    .stat-card .breakdown {
      display: flex;
      gap: 12px;
      margin-top: 6px;
      font-size: 11px;
    }

    .stat-card .breakdown span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-card .breakdown .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    @media (max-width: 800px) {
      .two-col { grid-template-columns: 1fr; }
    }

    .section { margin-bottom: 24px; }

    .section h2 {
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chart-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      height: 180px;
    }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 130px;
      gap: 4px;
      padding-top: 16px;
    }

    .bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      max-width: 36px;
    }

    .bar {
      width: 100%;
      background: var(--accent);
      border-radius: 3px 3px 0 0;
      min-height: 3px;
      transition: height 0.3s ease;
    }

    .bar-label {
      font-size: 9px;
      color: var(--muted);
      margin-top: 4px;
    }

    .model-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
    }

    .model-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
    }

    .model-card .name {
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .model-card .name .badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }

    .model-card .name .badge.claude {
      background: rgba(217, 119, 6, 0.15);
      color: var(--claude-color);
    }

    .model-card .tokens {
      font-size: 20px;
      font-weight: 600;
    }

    .model-card .breakdown {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
    }

    .sessions-list {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      max-height: 400px;
      overflow-y: auto;
    }

    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      gap: 12px;
    }

    .session-item:last-child { border-bottom: none; }
    .session-item:hover { background: var(--vscode-list-hoverBackground); }

    .session-info { flex: 1; min-width: 0; }

    .session-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .session-project {
      font-weight: 500;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .session-badge {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .session-badge.claude {
      background: rgba(217, 119, 6, 0.15);
      color: var(--claude-color);
    }

    .session-badge.codex {
      background: rgba(5, 150, 105, 0.15);
      color: var(--codex-color);
    }

    .session-meta {
      font-size: 11px;
      color: var(--muted);
      margin-top: 2px;
    }

    .session-time {
      font-size: 11px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">
      <h1>Code Agent Dashboard</h1>
      <div class="provider-pills">
        <div class="provider-pill claude"><span class="dot"></span>Claude</div>
        ${codexStats ? '<div class="provider-pill codex"><span class="dot"></span>Codex</div>' : ''}
      </div>
    </div>
    <button class="refresh-btn" onclick="refresh()">Refresh</button>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="label">${dateLabel}'s Messages</div>
      <div class="value">${recentStats.messages.toLocaleString()}</div>
      <div class="subtext">${recentStats.sessions} Claude sessions</div>
    </div>
    <div class="stat-card">
      <div class="label">Tool Calls (${dateLabel})</div>
      <div class="value">${recentStats.toolCalls.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="label">Tokens (${dateLabel})</div>
      <div class="value">${this.formatTokens(recentStats.totalTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="label">Total Sessions</div>
      <div class="value">${totalSessions.toLocaleString()}</div>
      <div class="breakdown">
        <span><span class="dot" style="background: var(--claude-color)"></span>${claudeSessions} Claude</span>
        ${codexStats ? `<span><span class="dot" style="background: var(--codex-color)"></span>${codexSessions} Codex</span>` : ''}
      </div>
    </div>
  </div>

  <div class="two-col">
    <div class="section" style="margin-bottom: 0;">
      <h2>Activity (14 Days)</h2>
      <div class="chart-container">
        ${this.renderBarChart(dailyData)}
      </div>
    </div>

    <div class="section" style="margin-bottom: 0;">
      <h2>Token Usage by Model</h2>
      <div class="model-grid">
        ${this.renderModelCards(modelUsage, totalTokens, codexStats)}
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Recent Projects</h2>
    <div class="sessions-list">
      ${this.renderMergedProjectsList(mergedProjects)}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function openSession(path) {
      vscode.postMessage({ command: 'openSession', path: path });
    }
  </script>
</body>
</html>`;
  }

  private formatDateLabel(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  private formatTokens(count: number): string {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`;
    }
    if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}K`;
    }
    return count.toString();
  }

  private renderBarChart(data: any[]): string {
    if (data.length === 0) {
      return '<div class="empty-state">No activity data yet</div>';
    }

    const maxMessages = Math.max(...data.map((d) => d.messageCount || 0), 1);

    const bars = data.map((day) => {
      const height = Math.max(((day.messageCount || 0) / maxMessages) * 130, 4);
      const date = new Date(day.date);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;

      return `
        <div class="bar-wrapper">
          <div class="bar" style="height: ${height}px" title="${day.messageCount} messages on ${day.date}"></div>
          <div class="bar-label">${label}</div>
        </div>
      `;
    });

    return `<div class="bar-chart">${bars.join('')}</div>`;
  }

  private renderModelCards(
    modelUsage: Record<string, { input: number; output: number }>,
    totalTokens: number,
    codexStats: { totalSessions: number; recentSessions: number; providers: string[] } | null
  ): string {
    const entries = Object.entries(modelUsage);

    if (entries.length === 0 && !codexStats) {
      return '<div class="empty-state">No model usage data yet</div>';
    }

    let html = entries
      .map(([model, usage]) => {
        const total = usage.input + usage.output;
        const percentage = totalTokens > 0 ? ((total / totalTokens) * 100).toFixed(1) : 0;

        return `
          <div class="model-card">
            <div class="name">${model} <span class="badge claude">Claude</span></div>
            <div class="tokens">${this.formatTokens(total)}</div>
            <div class="breakdown">
              ${percentage}% · In: ${this.formatTokens(usage.input)} / Out: ${this.formatTokens(usage.output)}
            </div>
          </div>
        `;
      })
      .join('');

    // Add Codex providers as model cards
    if (codexStats && codexStats.providers.length > 0) {
      for (const provider of codexStats.providers) {
        html += `
          <div class="model-card">
            <div class="name">${provider} <span class="badge" style="background: rgba(5, 150, 105, 0.15); color: var(--codex-color);">Codex</span></div>
            <div class="tokens">${codexStats.totalSessions}</div>
            <div class="breakdown">sessions total</div>
          </div>
        `;
      }
    }

    return html || '<div class="empty-state">No model usage data yet</div>';
  }

  private mergeProjects(claudeProjects: any[], codexProjects: any[]): any[] {
    const merged: any[] = [];

    // Add Claude projects with source marker
    for (const project of claudeProjects) {
      merged.push({
        ...project,
        source: 'claude',
        sortDate: project.lastModified,
      });
    }

    // Add Codex projects with source marker
    for (const project of codexProjects) {
      merged.push({
        ...project,
        source: 'codex',
        sortDate: project.lastModified,
      });
    }

    // Sort by last modified date descending
    return merged.sort((a, b) => {
      const dateA = a.sortDate instanceof Date ? a.sortDate : new Date(a.sortDate);
      const dateB = b.sortDate instanceof Date ? b.sortDate : new Date(b.sortDate);
      return dateB.getTime() - dateA.getTime();
    });
  }

  private renderMergedProjectsList(projects: any[]): string {
    if (projects.length === 0) {
      return '<div class="empty-state">No projects found</div>';
    }

    return projects
      .slice(0, 15)
      .map((project) => {
        const isClaude = project.source === 'claude';
        const latestSession = project.sessions[0];
        const sessionPath = isClaude ? latestSession?.fullPath : latestSession?.filePath;
        const relativeTime = isClaude
          ? this.claudeProvider.formatRelativeTime(project.lastModified)
          : this.codexProvider.formatRelativeTime(project.lastModified);

        const badgeClass = isClaude ? 'claude' : 'codex';
        const badgeText = isClaude ? 'Claude' : 'Codex';
        const meta = isClaude
          ? `${project.sessions.length} sessions · ${project.totalMessages} messages`
          : `${project.sessions.length} sessions`;

        return `
          <div class="session-item" onclick="openSession('${sessionPath || ''}')">
            <div class="session-info">
              <div class="session-header">
                <span class="session-project">${project.name}</span>
                <span class="session-badge ${badgeClass}">${badgeText}</span>
              </div>
              <div class="session-meta">${meta}</div>
            </div>
            <div class="session-time">${relativeTime}</div>
          </div>
        `;
      })
      .join('');
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
