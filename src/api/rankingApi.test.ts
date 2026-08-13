import { beforeEach, describe, expect, it } from 'vitest';
import { getCachedRanking } from './rankingApi';

describe('rankingApi localStorage caching', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
    (globalThis as unknown as { window: { localStorage: typeof mockStorage } }).window = {
      localStorage: mockStorage,
    };
  });

  it('reads cached top ranking from localStorage if in-memory cache is empty', () => {
    const mockRanking = [
      { rank: 1, displayName: '토스 #1234', score: 100, durationMs: 5000 },
      { rank: 2, displayName: '풍선왕 #5678', score: 90, durationMs: 4000 },
      { rank: 3, displayName: '후후 #9999', score: 80, durationMs: 3000 },
    ];

    store.set(
      'hoo-balloon:nongame:top-ranking:LUNG_CAPACITY',
      JSON.stringify(mockRanking),
    );

    const cached = getCachedRanking('LUNG_CAPACITY');
    expect(cached).toEqual(mockRanking);
  });

  it('returns null if localStorage is empty and in-memory cache is empty', () => {
    const cached = getCachedRanking('BALLOON_COUNT');
    expect(cached).toBeNull();
  });
});
