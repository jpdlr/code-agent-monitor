import * as vscode from 'vscode';
import { ClaudeDataProvider } from '../providers/ClaudeDataProvider';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly dataProvider: ClaudeDataProvider;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, dataProvider: ClaudeDataProvider) {
    this.panel = panel;
    this.dataProvider = dataProvider;

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

  public static createOrShow(extensionUri: vscode.Uri, dataProvider: ClaudeDataProvider) {
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

    DashboardPanel.currentPanel = new DashboardPanel(panel, dataProvider);
  }

  private async update() {
    const stats = await this.dataProvider.getStats();
    const projects = await this.dataProvider.getProjects();
    const todayStats = await this.dataProvider.getTodayStats();
    const modelUsage = await this.dataProvider.getModelUsage();

    this.panel.webview.html = this.getHtmlContent(stats, projects, todayStats, modelUsage);
  }

  private getHtmlContent(
    stats: any,
    projects: any[],
    recentStats: any,
    modelUsage: Record<string, { input: number; output: number }>
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
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

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

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
    }

    .refresh-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }

    .refresh-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      font-size: 12px;
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
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section h2 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--muted);
    }

    .chart-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      height: 200px;
    }

    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      height: 150px;
      gap: 4px;
      padding-top: 20px;
    }

    .bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      max-width: 40px;
    }

    .bar {
      width: 100%;
      background: var(--accent);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }

    .bar-label {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      max-height: 50px;
      overflow: hidden;
    }

    .model-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
      margin-bottom: 8px;
    }

    .model-card .tokens {
      font-size: 20px;
      font-weight: 600;
    }

    .model-card .breakdown {
      font-size: 11px;
      color: var(--muted);
      margin-top: 4px;
    }

    .sessions-list {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .session-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }

    .session-item:last-child {
      border-bottom: none;
    }

    .session-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .session-info {
      flex: 1;
    }

    .session-project {
      font-weight: 500;
    }

    .session-meta {
      font-size: 12px;
      color: var(--muted);
    }

    .session-time {
      font-size: 12px;
      color: var(--muted);
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
    <h1>Code Agent Dashboard</h1>
    <button class="refresh-btn" onclick="refresh()">Refresh</button>
  </div>

  <div class="grid">
    <div class="stat-card">
      <div class="label">${dateLabel}'s Messages</div>
      <div class="value">${recentStats.messages}</div>
      <div class="subtext">${recentStats.sessions} sessions</div>
    </div>
    <div class="stat-card">
      <div class="label">Tool Calls (${dateLabel})</div>
      <div class="value">${recentStats.toolCalls}</div>
    </div>
    <div class="stat-card">
      <div class="label">Tokens (${dateLabel})</div>
      <div class="value">${this.formatTokens(recentStats.inputTokens + recentStats.outputTokens)}</div>
      <div class="subtext">In: ${this.formatTokens(recentStats.inputTokens)} / Out: ${this.formatTokens(recentStats.outputTokens)}</div>
    </div>
    <div class="stat-card">
      <div class="label">All Time</div>
      <div class="value">${stats?.totalMessages?.toLocaleString() || 0}</div>
      <div class="subtext">${stats?.totalSessions || 0} sessions</div>
    </div>
  </div>

  <div class="section">
    <h2>Activity (Last 14 Days)</h2>
    <div class="chart-container">
      ${this.renderBarChart(dailyData)}
    </div>
  </div>

  <div class="section">
    <h2>Token Usage by Model</h2>
    <div class="model-grid">
      ${this.renderModelCards(modelUsage, totalTokens)}
    </div>
  </div>

  <div class="section">
    <h2>Recent Projects</h2>
    <div class="sessions-list">
      ${this.renderProjectsList(projects)}
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
    totalTokens: number
  ): string {
    const entries = Object.entries(modelUsage);

    if (entries.length === 0) {
      return '<div class="empty-state">No model usage data yet</div>';
    }

    return entries
      .map(([model, usage]) => {
        const total = usage.input + usage.output;
        const percentage = totalTokens > 0 ? ((total / totalTokens) * 100).toFixed(1) : 0;

        return `
          <div class="model-card">
            <div class="name">${model}</div>
            <div class="tokens">${this.formatTokens(total)}</div>
            <div class="breakdown">
              ${percentage}% of total<br>
              In: ${this.formatTokens(usage.input)} / Out: ${this.formatTokens(usage.output)}
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderProjectsList(projects: any[]): string {
    if (projects.length === 0) {
      return '<div class="empty-state">No projects found</div>';
    }

    return projects
      .slice(0, 10)
      .map((project) => {
        const latestSession = project.sessions[0];
        const relativeTime = this.dataProvider.formatRelativeTime(project.lastModified);

        return `
          <div class="session-item" onclick="openSession('${latestSession?.fullPath || ''}')">
            <div class="session-info">
              <div class="session-project">${project.name}</div>
              <div class="session-meta">${project.sessions.length} sessions, ${project.totalMessages} messages</div>
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
