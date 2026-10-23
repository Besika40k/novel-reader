import { describe, expect, it } from 'vitest';
import { backupFileName, backupPrefs, parseBackup, restoredPref } from './backup';

describe('backupPrefs', () => {
  it('keeps settings and drops API keys', () => {
    const stored: Record<string, string> = {
      'novel-reader:prefs': '{"fontSize":20}',
      'novel-reader:ai': '{"groqKey":"gsk_x","geminiKey":"g","aiAuto":true}',
      'other:key': 'x',
    };
    expect(backupPrefs((key) => stored[key] ?? null)).toEqual({
      'novel-reader:prefs': '{"fontSize":20}',
      'novel-reader:ai': '{"aiAuto":true}',
    });
  });
});

describe('restoredPref', () => {
  it("keeps this phone's keys", () => {
    expect(
      restoredPref('novel-reader:ai', '{"aiAuto":true}', '{"groqKey":"mine","aiAuto":false}'),
    ).toBe('{"aiAuto":true,"groqKey":"mine"}');
  });

  it('replaces entries without secrets', () => {
    expect(restoredPref('novel-reader:prefs', '{"a":1}', '{"a":2}')).toBe('{"a":1}');
  });
});

describe('parseBackup', () => {
  const valid = {
    app: 'ln-jormungandr',
    format: 1,
    version: '0.7.0',
    createdAt: 1,
    tables: { novels: [] },
  };

  it('reads a backup', () => {
    expect(parseBackup(JSON.stringify(valid))).toEqual({ ...valid, prefs: {} });
  });

  it.each([
    ['not JSON', 'nope', 'not a backup'],
    ['another app', JSON.stringify({ ...valid, app: 'other' }), 'not a backup'],
    ['a newer format', JSON.stringify({ ...valid, format: 99 }), 'newer version'],
    ['a damaged table', JSON.stringify({ ...valid, tables: { novels: 3 } }), 'damaged'],
  ])('rejects %s', (_, text, message) => {
    expect(() => parseBackup(text)).toThrow(message);
  });
});

describe('backupFileName', () => {
  it('names the file by local date', () => {
    expect(backupFileName('backup', new Date(2026, 9, 3, 12).getTime())).toBe(
      'backup-2026-10-03.json',
    );
  });
});
