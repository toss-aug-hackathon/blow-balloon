export type GameType = 'BALLOON_COUNT' | 'LUNG_CAPACITY';

export type RegisteredGameUser = {
  isRegistered: true;
  displayName: string;
  nickname: string;
  displayId: number;
};

export type GameUser = RegisteredGameUser | { isRegistered: false };

export type RankingItem = {
  rank: number;
  displayName: string;
  score: number;
  durationMs: number | null;
};

export type MyRecordsResponse = {
  displayName: string;
  records: Record<GameType, {
    bestScore: number | null;
    bestDurationMs: number | null;
    rank: number | null;
  }>;
};

export type SubmitScoreResponse = {
  success: true;
  gameType: GameType;
  submittedScore: number;
  bestScore: number;
  bestDurationMs: number | null;
  isNewBest: boolean;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export class GameApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'GameApiError';
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const gameApiUrl = supabaseUrl
  ? `${supabaseUrl}/functions/v1/game-api`
  : null;

const rankingCache = new Map<GameType, RankingItem[]>();
const rankingRequests = new Map<GameType, Promise<RankingItem[]>>();
const myRecordsCache = new Map<string, MyRecordsResponse>();
const myRecordsRequests = new Map<string, Promise<MyRecordsResponse>>();
const myRecordsRequestTokens = new Map<string, symbol>();
const MAX_VISIBLE_RANKING_ITEMS = 15;
const MY_RECORDS_STORAGE_PREFIX = 'blow-balloon:my-records:';

function isMyRecordsResponse(value: unknown): value is MyRecordsResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MyRecordsResponse>;
  return typeof candidate.displayName === 'string' &&
    Boolean(candidate.records) &&
    typeof candidate.records === 'object';
}

function normalizeMyRecords(records: MyRecordsResponse): MyRecordsResponse {
  return {
    displayName: records.displayName,
    records: {
      BALLOON_COUNT: {
        bestScore: records.records.BALLOON_COUNT?.bestScore ?? null,
        bestDurationMs: records.records.BALLOON_COUNT?.bestDurationMs ?? null,
        rank: records.records.BALLOON_COUNT?.rank ?? null,
      },
      LUNG_CAPACITY: {
        bestScore: records.records.LUNG_CAPACITY?.bestScore ?? null,
        bestDurationMs: records.records.LUNG_CAPACITY?.bestDurationMs ?? null,
        rank: records.records.LUNG_CAPACITY?.rank ?? null,
      },
    },
  };
}

function saveMyRecordsToStorage(userKey: string, records: MyRecordsResponse): void {
  try {
    window.localStorage.setItem(
      `${MY_RECORDS_STORAGE_PREFIX}${userKey}`,
      JSON.stringify(records),
    );
  } catch {
    // Local storage may be unavailable or full in a WebView.
  }
}

function readMyRecordsFromStorage(userKey: string): MyRecordsResponse | null {
  try {
    const stored = window.localStorage.getItem(`${MY_RECORDS_STORAGE_PREFIX}${userKey}`);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isMyRecordsResponse(parsed) ? normalizeMyRecords(parsed) : null;
  } catch {
    return null;
  }
}

function cacheMyRecords(userKey: string, records: MyRecordsResponse): void {
  const normalized = normalizeMyRecords(records);
  myRecordsCache.set(userKey, normalized);
  saveMyRecordsToStorage(userKey, normalized);
}

async function gameApi<T>(
  path: string,
  options: RequestInit = {},
  userKey?: string,
): Promise<T> {
  if (!gameApiUrl) {
    throw new GameApiError(
      'CONFIGURATION_ERROR',
      '랭킹 연결 정보를 찾지 못했어요.',
      0,
      null,
    );
  }

  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (userKey) headers.set('x-game-user-key', userKey);

  const response = await fetch(`${gameApiUrl}${path}`, {
    ...options,
    cache: 'no-store',
    headers,
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const error = body as ApiErrorBody;
    const retryAfter = response.headers.get('Retry-After');
    throw new GameApiError(
      error.error?.code ?? 'UNKNOWN_ERROR',
      error.error?.message ?? '요청을 처리하지 못했어요.',
      response.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }

  return body as T;
}

export function getGameUser(userKey: string): Promise<GameUser> {
  return gameApi<GameUser>('/game-user', {}, userKey);
}

export function registerNickname(
  nickname: string,
  userKey: string,
): Promise<RegisteredGameUser> {
  return gameApi<RegisteredGameUser>(
    '/register-nickname',
    { method: 'POST', body: JSON.stringify({ nickname }) },
    userKey,
  );
}

export function updateNickname(
  nickname: string,
  userKey: string,
): Promise<RegisteredGameUser> {
  return gameApi<RegisteredGameUser>(
    '/update-nickname',
    { method: 'POST', body: JSON.stringify({ nickname }) },
    userKey,
  );
}

export function submitScore(
  gameType: GameType,
  score: number,
  durationMs: number | null,
  userKey: string,
): Promise<SubmitScoreResponse> {
  return gameApi<SubmitScoreResponse>(
    '/submit-score',
    { method: 'POST', body: JSON.stringify({ gameType, score, durationMs }) },
    userKey,
  );
}

export function getRanking(gameType: GameType): Promise<RankingItem[]> {
  const pendingRequest = rankingRequests.get(gameType);
  if (pendingRequest) return pendingRequest;

  const request = gameApi<RankingItem[]>(
    `/ranking?gameType=${gameType}&limit=${MAX_VISIBLE_RANKING_ITEMS}`,
  )
    .then((ranking) => {
      const normalizedRanking = ranking.map((item) => ({
        ...item,
        durationMs: item.durationMs ?? null,
      }));
      rankingCache.set(gameType, normalizedRanking);
      return normalizedRanking;
    })
    .finally(() => {
      rankingRequests.delete(gameType);
    });
  rankingRequests.set(gameType, request);
  return request;
}

export function getMyRecords(
  userKey: string,
  options: { forceRefresh?: boolean } = {},
): Promise<MyRecordsResponse> {
  const pendingRequest = myRecordsRequests.get(userKey);
  if (pendingRequest && !options.forceRefresh) return pendingRequest;

  const requestToken = Symbol(userKey);
  myRecordsRequestTokens.set(userKey, requestToken);
  const request = gameApi<MyRecordsResponse>('/my-records', {}, userKey)
    .then((records) => {
      if (myRecordsRequestTokens.get(userKey) === requestToken) {
        cacheMyRecords(userKey, records);
      }
      return records;
    })
    .finally(() => {
      if (myRecordsRequests.get(userKey) === request) {
        myRecordsRequests.delete(userKey);
      }
      if (myRecordsRequestTokens.get(userKey) === requestToken) {
        myRecordsRequestTokens.delete(userKey);
      }
    });
  myRecordsRequests.set(userKey, request);
  return request;
}

export function getCachedRanking(gameType: GameType): RankingItem[] | null {
  return rankingCache.get(gameType) ?? null;
}

export function getCachedMyRecords(userKey: string): MyRecordsResponse | null {
  const memoryCached = myRecordsCache.get(userKey);
  if (memoryCached) return memoryCached;

  const stored = readMyRecordsFromStorage(userKey);
  if (stored) myRecordsCache.set(userKey, stored);
  return stored;
}

export function updateCachedDisplayName(userKey: string, displayName: string): void {
  const records = getCachedMyRecords(userKey);
  if (records) cacheMyRecords(userKey, { ...records, displayName });

  for (const [gameType, ranking] of rankingCache) {
    rankingCache.set(
      gameType,
      ranking.map((item) =>
        item.displayName.includes(' #') && item.displayName.split(' #')[1] === displayName.split(' #')[1]
          ? { ...item, displayName }
          : item,
      ),
    );
  }
}

export function prefetchRankings(): void {
  void Promise.allSettled([
    getRanking('LUNG_CAPACITY'),
    getRanking('BALLOON_COUNT'),
  ]);
}

export function syncRankingAfterScore(params: {
  gameType: GameType;
  bestScore: number;
  bestDurationMs: number | null;
  displayName: string;
  userKey: string;
}): void {
  const { gameType, bestScore, bestDurationMs, displayName, userKey } = params;
  const cachedRanking = rankingCache.get(gameType);

  if (cachedRanking) {
    const cachedUserScore = cachedRanking.find(
      (item) => item.displayName === displayName,
    )?.score;
    const cachedUser = cachedRanking.find((item) => item.displayName === displayName);
    const preservedBestScore = Math.max(cachedUserScore ?? 0, bestScore);
    const preservedDurationMs =
      cachedUser && cachedUser.score > bestScore
        ? cachedUser.durationMs
        : cachedUser && cachedUser.score === bestScore &&
            cachedUser.durationMs !== null && bestDurationMs !== null
          ? Math.min(cachedUser.durationMs, bestDurationMs)
          : bestDurationMs;
    const nextRanking = cachedRanking
      .filter((item) => item.displayName !== displayName)
      .concat({
        rank: 0,
        displayName,
        score: preservedBestScore,
        durationMs: preservedDurationMs,
      })
      .sort((a, b) =>
        b.score - a.score || (a.durationMs ?? Number.MAX_SAFE_INTEGER) -
          (b.durationMs ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, 100)
      .map((item, index, items) => ({
        ...item,
        rank:
          index > 0 && item.score === items[index - 1].score
            ? items[index - 1].rank
            : index + 1,
      }));
    rankingCache.set(gameType, nextRanking);
  }

  const cachedRecords = getCachedMyRecords(userKey);
  if (cachedRecords) {
    const currentBestScore = cachedRecords.records[gameType].bestScore ?? 0;
    const preservedBestScore = Math.max(currentBestScore, bestScore);
    const currentBestDuration = cachedRecords.records[gameType].bestDurationMs;
    const preservedBestDuration =
      currentBestScore > bestScore
        ? currentBestDuration
        : currentBestScore === bestScore &&
            currentBestDuration !== null && bestDurationMs !== null
          ? Math.min(currentBestDuration, bestDurationMs)
          : bestDurationMs;
    const optimisticRank = rankingCache
      .get(gameType)
      ?.find((item) => item.displayName === displayName)?.rank;
    cacheMyRecords(userKey, {
      ...cachedRecords,
      records: {
        ...cachedRecords.records,
        [gameType]: {
          bestScore: preservedBestScore,
          bestDurationMs: preservedBestDuration,
          rank: optimisticRank ?? cachedRecords.records[gameType].rank,
        },
      },
    });
  }

  void Promise.allSettled([getRanking(gameType), getMyRecords(userKey)]);
}
