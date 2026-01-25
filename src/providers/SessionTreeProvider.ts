import * as vscode from 'vscode';
import { ClaudeDataProvider } from './ClaudeDataProvider';
import { CodexDataProvider, CodexProjectInfo, CodexSession } from './CodexDataProvider';
import type { ProjectInfo, ClaudeSession } from '../types';

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private claudeProvider: ClaudeDataProvider;
  private codexProvider: CodexDataProvider;

  constructor(claudeProvider: ClaudeDataProvider, codexProvider: CodexDataProvider) {
    this.claudeProvider = claudeProvider;
    this.codexProvider = codexProvider;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (!element) {
      // Root level - show provider sections
      const items: SessionTreeItem[] = [];

      // Claude Code section
      const claudeItem = new SessionTreeItem(
        'Claude Code',
        vscode.TreeItemCollapsibleState.Expanded,
        'provider'
      );
      claudeItem.iconPath = new vscode.ThemeIcon('hubot');
      claudeItem.contextValue = 'claude-provider';
      items.push(claudeItem);

      // Codex section (only if available)
      if (this.codexProvider.isAvailable()) {
        const codexItem = new SessionTreeItem(
          'Codex',
          vscode.TreeItemCollapsibleState.Expanded,
          'provider'
        );
        codexItem.iconPath = new vscode.ThemeIcon('terminal');
        codexItem.contextValue = 'codex-provider';
        items.push(codexItem);
      }

      return items;
    }

    // Claude Code provider children
    if (element.type === 'provider' && element.contextValue === 'claude-provider') {
      const projects = await this.claudeProvider.getProjects();

      if (projects.length === 0) {
        return [
          new SessionTreeItem(
            'No sessions found',
            vscode.TreeItemCollapsibleState.None,
            'info'
          ),
        ];
      }

      return projects.map((project) => {
        const item = new SessionTreeItem(
          project.name,
          vscode.TreeItemCollapsibleState.Collapsed,
          'project',
          project
        );
        item.description = `${project.sessions.length} sessions`;
        item.tooltip = `${project.path}\n${project.totalMessages} total messages`;
        item.iconPath = new vscode.ThemeIcon('folder');
        return item;
      });
    }

    // Codex provider children
    if (element.type === 'provider' && element.contextValue === 'codex-provider') {
      const projects = await this.codexProvider.getProjects();

      if (projects.length === 0) {
        return [
          new SessionTreeItem(
            'No sessions found',
            vscode.TreeItemCollapsibleState.None,
            'info'
          ),
        ];
      }

      return projects.map((project) => {
        const item = new SessionTreeItem(
          project.name,
          vscode.TreeItemCollapsibleState.Collapsed,
          'codex-project',
          undefined,
          undefined,
          project
        );
        item.description = `${project.sessions.length} sessions`;
        item.tooltip = project.path;
        item.iconPath = new vscode.ThemeIcon('folder');
        return item;
      });
    }

    // Claude project children
    if (element.type === 'project' && element.project) {
      return element.project.sessions.map((session) => {
        const modified = new Date(session.modified);
        const relativeTime = this.claudeProvider.formatRelativeTime(modified);

        const item = new SessionTreeItem(
          `${session.messageCount} msgs`,
          vscode.TreeItemCollapsibleState.None,
          'session',
          undefined,
          session
        );

        item.description = relativeTime;
        item.tooltip = this.formatClaudeSessionTooltip(session);
        item.iconPath = new vscode.ThemeIcon('comment-discussion');

        item.command = {
          command: 'codeAgentMonitor.openSession',
          title: 'Open Session',
          arguments: [session],
        };

        return item;
      });
    }

    // Codex project children
    if (element.type === 'codex-project' && element.codexProject) {
      return element.codexProject.sessions.map((session: CodexSession) => {
        const timestamp = new Date(session.timestamp);
        const relativeTime = this.codexProvider.formatRelativeTime(timestamp);

        const item = new SessionTreeItem(
          session.model_provider,
          vscode.TreeItemCollapsibleState.None,
          'codex-session',
          undefined,
          undefined,
          undefined,
          session
        );

        item.description = relativeTime;
        item.tooltip = this.formatCodexSessionTooltip(session);
        item.iconPath = new vscode.ThemeIcon('comment-discussion');

        item.command = {
          command: 'codeAgentMonitor.openSession',
          title: 'Open Session',
          arguments: [{ fullPath: session.filePath }],
        };

        return item;
      });
    }

    return [];
  }

  private formatClaudeSessionTooltip(session: ClaudeSession): string {
    const lines = [
      `Messages: ${session.messageCount}`,
      `Created: ${new Date(session.created).toLocaleString()}`,
      `Modified: ${new Date(session.modified).toLocaleString()}`,
    ];

    if (session.gitBranch) {
      lines.push(`Branch: ${session.gitBranch}`);
    }

    return lines.join('\n');
  }

  private formatCodexSessionTooltip(session: CodexSession): string {
    const lines = [
      `Provider: ${session.model_provider}`,
      `Time: ${new Date(session.timestamp).toLocaleString()}`,
      `CLI Version: ${session.cli_version}`,
      `Source: ${session.source}`,
    ];

    return lines.join('\n');
  }
}

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'provider' | 'project' | 'session' | 'info' | 'codex-project' | 'codex-session',
    public readonly project?: ProjectInfo,
    public readonly session?: ClaudeSession,
    public readonly codexProject?: CodexProjectInfo,
    public readonly codexSession?: CodexSession
  ) {
    super(label, collapsibleState);
    this.contextValue = type;
  }
}
