import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ranking score submission', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://ranking.example.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('shares one in-flight request for the same result', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>((resolve) => {
      void _input;
      void _init;
      resolveFetch = resolve;
    }));
    vi.stubGlobal('fetch', fetchMock);

    const { submitScore } = await import('./rankingApi');
    const submissionId = '12345678-1234-4123-8123-123456789abc';
    const first = submitScore('LUNG_CAPACITY', 1200, 8000, 'user-key', submissionId);
    const duplicate = submitScore('LUNG_CAPACITY', 1200, 8000, 'user-key', submissionId);

    expect(duplicate).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      rankingType: 'LUNG_CAPACITY',
      score: 1200,
      durationMs: 8000,
      submissionId,
    });

    resolveFetch(new Response(JSON.stringify({
      success: true,
      rankingType: 'LUNG_CAPACITY',
      submittedScore: 1200,
      bestScore: 1200,
      bestDurationMs: 8000,
      isNewBest: true,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(first).resolves.toMatchObject({ bestScore: 1200 });
  });

  it('normalizes WebView fetch failures into a retryable Korean error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { RankingApiError, submitScore } = await import('./rankingApi');

    await expect(submitScore(
      'BALLOON_COUNT',
      3,
      12000,
      'user-key',
      '12345678-1234-4123-8123-123456789abc',
    ))
      .rejects.toMatchObject({
        name: RankingApiError.name,
        code: 'NETWORK_ERROR',
        message: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
      });
  });
});
