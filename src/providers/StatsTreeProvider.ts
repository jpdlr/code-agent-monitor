import * as vscode from 'vscode';
import { ClaudeDataProvider } from './ClaudeDataProvider';

export class StatsTreeProvider implements vscode.TreeDataProvider<StatsTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<StatsTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private dataProvider: ClaudeDataProvider;

  constructor(dataProvider: ClaudeDataProvider) {
    this.dataProvider = dataProvider;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: StatsTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: StatsTreeItem): Promise<StatsTreeItem[]> {
    if (element) {
      return [];
    }

    const items: StatsTreeItem[] = [];

    // Recent stats (today or most recent day)
    const recentStats = await this.dataProvider.getTodayStats();
    const todayDate = new Date().toISOString().split('T')[0];
    const isToday = recentStats.date === todayDate;
    const dateLabel = isToday ? 'Today' : this.formatDateLabel(recentStats.date);

    items.push(this.createStatItem(dateLabel, '', 'calendar'));

    items.push(
      this.createStatItem(
        'Messages',
        recentStats.messages.toString(),
        'comment',
        `Messages on ${recentStats.date}`
      )
    );

    items.push(
      this.createStatItem(
        'Sessions',
        recentStats.sessions.toString(),
        'window',
        `Sessions on ${recentStats.date}`
      )
    );

    items.push(
      this.createStatItem(
        'Tool Calls',
        recentStats.toolCalls.toString(),
        'tools',
        `Tool calls on ${recentStats.date}`
      )
    );

    // Token usage
    items.push(this.createStatItem('', '', 'blank'));
    items.push(this.createStatItem(`Tokens (${dateLabel})`, '', 'dashboard'));

    items.push(
      this.createStatItem(
        'Input',
        this.dataProvider.formatTokenCount(recentStats.inputTokens),
        'arrow-right',
        `${recentStats.inputTokens.toLocaleString()} input tokens on ${recentStats.date}`
      )
    );

    items.push(
      this.createStatItem(
        'Output',
        this.dataProvider.formatTokenCount(recentStats.outputTokens),
        'arrow-left',
        `${recentStats.outputTokens.toLocaleString()} output tokens on ${recentStats.date}`
      )
    );

    // Model breakdown
    const modelUsage = await this.dataProvider.getModelUsage();
    const modelEntries = Object.entries(modelUsage);

    if (modelEntries.length > 0) {
      items.push(this.createStatItem('', '', 'blank'));
      items.push(this.createStatItem('Models (All Time)', '', 'server'));

      for (const [model, usage] of modelEntries) {
        const total = usage.input + usage.output;
        items.push(
          this.createStatItem(
            model,
            this.dataProvider.formatTokenCount(total),
            'symbol-method',
            `Input: ${usage.input.toLocaleString()}\nOutput: ${usage.output.toLocaleString()}`
          )
        );
      }
    }

    // All-time stats
    const stats = await this.dataProvider.getStats();
    if (stats) {
      items.push(this.createStatItem('', '', 'blank'));
      items.push(this.createStatItem('All Time', '', 'history'));

      items.push(
        this.createStatItem(
          'Total Sessions',
          stats.totalSessions.toString(),
          'folder-library',
          `All sessions across all projects`
        )
      );

      items.push(
        this.createStatItem(
          'Total Messages',
          stats.totalMessages.toLocaleString(),
          'mail',
          `All messages sent`
        )
      );
    }

    return items;
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

  private createStatItem(
    label: string,
    value: string,
    icon: string,
    tooltip?: string
  ): StatsTreeItem {
    const item = new StatsTreeItem(label, value);

    if (icon === 'blank') {
      item.iconPath = undefined;
    } else {
      item.iconPath = new vscode.ThemeIcon(icon);
    }

    if (tooltip) {
      item.tooltip = tooltip;
    }

    return item;
  }
}

export class StatsTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly value: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = value;
  }
}
