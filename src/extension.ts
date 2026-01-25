import * as vscode from 'vscode';
import { ClaudeDataProvider } from './providers/ClaudeDataProvider';
import { SessionTreeProvider } from './providers/SessionTreeProvider';
import { StatsTreeProvider } from './providers/StatsTreeProvider';
import { DashboardPanel } from './views/DashboardPanel';
import type { ClaudeSession } from './types';

let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  const dataProvider = new ClaudeDataProvider();

  // Create tree providers
  const sessionTreeProvider = new SessionTreeProvider(dataProvider);
  const statsTreeProvider = new StatsTreeProvider(dataProvider);

  // Register tree views
  const sessionsView = vscode.window.createTreeView('codeAgentSessions', {
    treeDataProvider: sessionTreeProvider,
    showCollapseAll: true,
  });

  const statsView = vscode.window.createTreeView('codeAgentStats', {
    treeDataProvider: statsTreeProvider,
  });

  context.subscriptions.push(sessionsView, statsView);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeAgentMonitor.refresh', () => {
      sessionTreeProvider.refresh();
      statsTreeProvider.refresh();
      vscode.window.showInformationMessage('Code Agent Monitor refreshed');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeAgentMonitor.openSession', (session: ClaudeSession) => {
      if (session?.fullPath) {
        const uri = vscode.Uri.file(session.fullPath);
        vscode.window.showTextDocument(uri, { preview: true });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codeAgentMonitor.openDashboard', () => {
      DashboardPanel.createOrShow(context.extensionUri, dataProvider);
    })
  );

  // Set up file watcher for ~/.claude directory
  setupFileWatcher(dataProvider, sessionTreeProvider, statsTreeProvider);

  // Initial message
  console.log('Code Agent Monitor activated');
}

function setupFileWatcher(
  dataProvider: ClaudeDataProvider,
  sessionTreeProvider: SessionTreeProvider,
  statsTreeProvider: StatsTreeProvider
): void {
  const claudeDir = dataProvider.getClaudeDir();

  // Watch for changes in ~/.claude directory
  const pattern = new vscode.RelativePattern(claudeDir, '**/*.{json,jsonl}');
  fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

  let debounceTimer: NodeJS.Timeout | undefined;

  const debouncedRefresh = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      sessionTreeProvider.refresh();
      statsTreeProvider.refresh();
    }, 1000);
  };

  fileWatcher.onDidChange(debouncedRefresh);
  fileWatcher.onDidCreate(debouncedRefresh);
  fileWatcher.onDidDelete(debouncedRefresh);
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
}
