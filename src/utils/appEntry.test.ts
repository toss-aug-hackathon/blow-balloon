import { describe, expect, it } from 'vitest';
import { resolveAppEntry } from './appEntry';

describe('resolveAppEntry', () => {
  it.each([
    ['/lung-test', 'lung-test'],
    ['/balloon-rush/', 'balloon-rush'],
    ['/ranking', 'ranking'],
    ['/nested/ranking', 'ranking'],
  ])('resolves %s to %s', (pathname, expected) => {
    expect(resolveAppEntry(pathname)).toBe(expected);
  });

  it.each(['/', '', '/unknown', '/ranking/details'])(
    'falls back to home for %s',
    (pathname) => {
      expect(resolveAppEntry(pathname)).toBe('home');
    },
  );
});
