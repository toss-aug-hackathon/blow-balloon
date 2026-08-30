import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nativeStore = vi.hoisted(() => new Map<string, string>());
const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn((key: string) => Promise.resolve(nativeStore.get(key) ?? null)),
  setItem: vi.fn((key: string, value: string) => {
    nativeStore.set(key, value);
    return Promise.resolve();
  }),
}));

vi.mock('@apps-in-toss/web-framework', () => ({
  Storage: storageMocks,
}));

describe('ranking outbox', () => {
  const localStore = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://ranking.example.com');
    nativeStore.clear();
    localStore.clear();
    storageMocks.getItem.mockClear();
    storageMocks.setItem.mockClear();
    const localStorage = {
      getItem: (key: string) => localStore.get(key) ?? null,
      setItem: (key: string, value: string) => localStore.set(key, value),
      removeItem: (key: string) => localStore.delete(key),
      clear: () => localStore.clear(),
    };
    vi.stubGlobal('window', {
      localStorage,
      setTimeout,
      clearTimeout,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps only the best pending result for each user and ranking type', async () => {
    const { enqueueScoreSubmission } = await import('./rankingOutbox');
    const first = await enqueueScoreSubmission({
      anonymousKey: 'user-key',
      rankingType: 'LUNG_CAPACITY',
      score: 100,
      durationMs: 5000,
    });
    const lower = await enqueueScoreSubmission({
      anonymousKey: 'user-key',
      rankingType: 'LUNG_CAPACITY',
      score: 90,
      durationMs: 9000,
    });
    const higher = await enqueueScoreSubmission({
      anonymousKey: 'user-key',
      rankingType: 'LUNG_CAPACITY',
      score: 120,
      durationMs: 6000,
    });

    expect(lower.id).toBe(first.id);
    expect(higher.id).not.toBe(first.id);
    const saved = JSON.parse(Array.from(nativeStore.values())[0]) as {
      items: Array<{ id: string; score: number }>;
    };
    expect(saved.items).toEqual([expect.objectContaining({ id: higher.id, score: 120 })]);
  });

  it('falls back to localStorage when native storage cannot write', async () => {
    storageMocks.setItem.mockRejectedValueOnce(new Error('native unavailable'));
    const { enqueueScoreSubmission } = await import('./rankingOutbox');

    const pending = await enqueueScoreSubmission({
      anonymousKey: 'user-key',
      rankingType: 'BALLOON_COUNT',
      score: 2,
      durationMs: 9000,
    });

    const saved = JSON.parse(Array.from(localStore.values())[0]) as {
      items: Array<{ id: string }>;
    };
    expect(saved.items[0]?.id).toBe(pending.id);
  });

  it('preserves pending records split between native and migrated local storage', async () => {
    const createdAt = Date.now();
    nativeStore.set('hoo-balloon:ranking-outbox:v1', JSON.stringify({
      version: 1,
      updatedAt: 20,
      items: [{
        version: 1,
        id: '11111111-1111-4111-8111-111111111111',
        ownerHash: 'native-owner',
        rankingType: 'BALLOON_COUNT',
        score: 2,
        durationMs: 5000,
        createdAt,
        attempts: 0,
        nextAttemptAt: 0,
      }],
    }));
    localStore.set('hoo-balloon:ranking-outbox:v1', JSON.stringify({
      version: 1,
      updatedAt: 10,
      items: [{
        version: 1,
        id: '22222222-2222-4222-8222-222222222222',
        ownerHash: 'local-owner',
        rankingType: 'LUNG_CAPACITY',
        score: 100,
        durationMs: 7000,
        createdAt,
        attempts: 0,
        nextAttemptAt: 0,
      }],
    }));

    const { enqueueScoreSubmission } = await import('./rankingOutbox');
    await enqueueScoreSubmission({
      anonymousKey: 'new-user',
      rankingType: 'BALLOON_COUNT',
      score: 3,
      durationMs: 4000,
    });

    const saved = JSON.parse(Array.from(nativeStore.values())[0]) as {
      items: Array<{ id: string }>;
    };
    expect(saved.items.map(({ id }) => id)).toEqual(expect.arrayContaining([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]));
  });

  it('queues a score silently and syncs it after the network recovers', async () => {
    let now = 1000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const { saveRankingScoreReliably, syncRankingOutbox } = await import('./rankingOutbox');

    const saved = await saveRankingScoreReliably({
      anonymousKey: 'user-key',
      rankingType: 'BALLOON_COUNT',
      score: 4,
      durationMs: 14000,
    });
    expect(saved.status).toBe('queued');
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const envelope = JSON.parse(Array.from(nativeStore.values())[0]) as {
        items: Array<{ attempts: number }>;
      };
      expect(envelope.items[0]?.attempts).toBe(1);
    });

    now = 10_000;
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      rankingType: 'BALLOON_COUNT',
      submittedScore: 4,
      bestScore: 4,
      bestDurationMs: 14000,
      isNewBest: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const synced = await syncRankingOutbox('user-key');
    expect(synced.synced).toHaveLength(1);
    expect(synced.nextRetryAt).toBeNull();
  });

  it('uses bounded exponential backoff with jitter', async () => {
    const { calculateRetryDelayMs } = await import('./rankingOutbox');
    expect(calculateRetryDelayMs(1, null, 0.5)).toBe(1000);
    expect(calculateRetryDelayMs(3, null, 0.5)).toBe(5000);
    expect(calculateRetryDelayMs(20, null, 0.5)).toBe(300_000);
    expect(calculateRetryDelayMs(1, 10, 0.5)).toBe(10_000);
  });
});
