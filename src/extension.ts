import * as vscode from 'vscode';
import { ClaudeDataProvider } from './providers/ClaudeDataProvider';
import { CodexDataProvider } from './providers/CodexDataProvider';
import { SessionTreeProvider } from './providers/SessionTreeProvider';
import { StatsTreeProvider } from './providers/StatsTreeProvider';
import { DashboardPanel } from './views/DashboardPanel';
import type { ClaudeSession } from './types';

let claudeFileWatcher: vscode.FileSystemWatcher | undefined;
let codexFileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  const claudeDataProvider = new ClaudeDataProvider();
  const codexDataProvider = new CodexDataProvider();

  // Create tree providers
  const sessionTreeProvider = new SessionTreeProvider(claudeDataProvider, codexDataProvider);
  const statsTreeProvider = new StatsTreeProvider(claudeDataProvider, codexDataProvider);

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
      DashboardPanel.createOrShow(context.extensionUri, claudeDataProvider, codexDataProvider);
    })
  );

  // Set up file watchers
  setupFileWatchers(claudeDataProvider, codexDataProvider, sessionTreeProvider, statsTreeProvider);

  // Initial message
  console.log('Code Agent Monitor activated');
}

function setupFileWatchers(
  claudeDataProvider: ClaudeDataProvider,
  codexDataProvider: CodexDataProvider,
  sessionTreeProvider: SessionTreeProvider,
  statsTreeProvider: StatsTreeProvider
): void {
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

  // Watch for changes in ~/.claude directory
  const claudeDir = claudeDataProvider.getClaudeDir();
  const claudePattern = new vscode.RelativePattern(claudeDir, '**/*.{json,jsonl}');
  claudeFileWatcher = vscode.workspace.createFileSystemWatcher(claudePattern);

  claudeFileWatcher.onDidChange(debouncedRefresh);
  claudeFileWatcher.onDidCreate(debouncedRefresh);
  claudeFileWatcher.onDidDelete(debouncedRefresh);

  // Watch for changes in ~/.codex directory (if available)
  if (codexDataProvider.isAvailable()) {
    const codexDir = codexDataProvider.getCodexDir();
    const codexPattern = new vscode.RelativePattern(codexDir, '**/*.jsonl');
    codexFileWatcher = vscode.workspace.createFileSystemWatcher(codexPattern);

    codexFileWatcher.onDidChange(debouncedRefresh);
    codexFileWatcher.onDidCreate(debouncedRefresh);
    codexFileWatcher.onDidDelete(debouncedRefresh);
  }
}

export function deactivate() {
  if (claudeFileWatcher) {
    claudeFileWatcher.dispose();
  }
  if (codexFileWatcher) {
    codexFileWatcher.dispose();
  }
}
