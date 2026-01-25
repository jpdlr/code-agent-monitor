import * as vscode from 'vscode';
import { ClaudeDataProvider } from './ClaudeDataProvider';
import type { ProjectInfo, ClaudeSession } from '../types';

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SessionTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private dataProvider: ClaudeDataProvider;

  constructor(dataProvider: ClaudeDataProvider) {
    this.dataProvider = dataProvider;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SessionTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SessionTreeItem): Promise<SessionTreeItem[]> {
    if (!element) {
      // Root level - show projects
      const projects = await this.dataProvider.getProjects();

      if (projects.length === 0) {
        return [
          new SessionTreeItem(
            'No Claude Code sessions found',
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

    if (element.type === 'project' && element.project) {
      // Show sessions under project
      return element.project.sessions.map((session) => {
        const modified = new Date(session.modified);
        const relativeTime = this.dataProvider.formatRelativeTime(modified);

        const item = new SessionTreeItem(
          `${session.messageCount} msgs`,
          vscode.TreeItemCollapsibleState.None,
          'session',
          undefined,
          session
        );

        item.description = relativeTime;
        item.tooltip = this.formatSessionTooltip(session);
        item.iconPath = new vscode.ThemeIcon('comment-discussion');

        item.command = {
          command: 'codeAgentMonitor.openSession',
          title: 'Open Session',
          arguments: [session],
        };

        return item;
      });
    }

    return [];
  }

  private formatSessionTooltip(session: ClaudeSession): string {
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
}

export class SessionTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'project' | 'session' | 'info',
    public readonly project?: ProjectInfo,
    public readonly session?: ClaudeSession
  ) {
    super(label, collapsibleState);
    this.contextValue = type;
  }
}
