# Code Agent Monitor

A VS Code extension that displays Claude Code session activity, history, and usage statistics.

## Features

- **Sessions Panel** - View all Claude Code sessions grouped by project
- **Stats Panel** - Today's activity, token usage, and all-time statistics
- **Real-time Updates** - Automatically refreshes when Claude Code activity changes
- **Model Breakdown** - See token usage by model (Opus, Sonnet, Haiku)

## Installation

### From Source

```bash
# Clone and install
git clone https://github.com/jpdlr/code-agent-monitor.git
cd code-agent-monitor
npm install

# Build
npm run compile

# Package
npm run package
```

Then install the `.vsix` file in VS Code.

### Development

1. Open this folder in VS Code
2. Press F5 to launch Extension Development Host
3. The extension will appear in the Activity Bar

## Usage

1. Click the robot icon in the Activity Bar
2. **Sessions** - Browse projects and their Claude Code sessions
3. **Stats** - View usage statistics

### Commands

- `Code Agent Monitor: Refresh` - Manually refresh data
- `Code Agent Monitor: Open Dashboard` - Open detailed dashboard

## Data Sources

The extension reads from Claude Code's local storage:

| File | Data |
|------|------|
| `~/.claude/projects/*/sessions-index.json` | Session metadata |
| `~/.claude/stats-cache.json` | Usage statistics |
| `~/.claude/history.jsonl` | Activity history |

## Requirements

- VS Code 1.85.0 or higher
- Claude Code CLI installed and used

## License

MIT
