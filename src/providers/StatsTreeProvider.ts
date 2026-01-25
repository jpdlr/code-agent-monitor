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

    // Today's stats
    const today = await this.dataProvider.getTodayStats();

    items.push(this.createStatItem('Today', '', 'calendar'));

    items.push(
      this.createStatItem(
        'Messages',
        today.messages.toString(),
        'comment',
        `Messages sent today`
      )
    );

    items.push(
      this.createStatItem(
        'Sessions',
        today.sessions.toString(),
        'window',
        `Active sessions today`
      )
    );

    items.push(
      this.createStatItem(
        'Tool Calls',
        today.toolCalls.toString(),
        'tools',
        `Tool invocations today`
      )
    );

    // Token usage
    items.push(this.createStatItem('', '', 'blank'));
    items.push(this.createStatItem('Tokens', '', 'dashboard'));

    items.push(
      this.createStatItem(
        'Input',
        this.dataProvider.formatTokenCount(today.inputTokens),
        'arrow-right',
        `${today.inputTokens.toLocaleString()} input tokens today`
      )
    );

    items.push(
      this.createStatItem(
        'Output',
        this.dataProvider.formatTokenCount(today.outputTokens),
        'arrow-left',
        `${today.outputTokens.toLocaleString()} output tokens today`
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
