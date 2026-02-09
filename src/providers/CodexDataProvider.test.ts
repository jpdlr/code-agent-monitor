import { describe, expect, it } from 'vitest';
import { CodexDataProvider } from './CodexDataProvider';

describe('CodexDataProvider', () => {
  it('returns a .codex directory path', () => {
    const provider = new CodexDataProvider();
    expect(provider.getCodexDir()).toContain('.codex');
  });

  it('formats short relative times in minutes/hours/days', () => {
    const provider = new CodexDataProvider();
    const now = Date.now();

    expect(provider.formatRelativeTime(new Date(now - 2 * 60 * 1000))).toContain('m ago');
    expect(provider.formatRelativeTime(new Date(now - 2 * 60 * 60 * 1000))).toContain('h ago');
    expect(provider.formatRelativeTime(new Date(now - 2 * 24 * 60 * 60 * 1000))).toContain('d ago');
  });
});
