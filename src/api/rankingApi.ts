import {
  chooseBetterDuration,
  compareRankingItems,
  hasSameRankingRecord,
} from './rankingRules';

export type RankingType = 'BALLOON_COUNT' | 'LUNG_CAPACITY';

export type RegisteredRankingUser = {
  isRegistered: true;
  displayName: string;
  nickname: string;
  displayId: number;
};

export type RankingUser = RegisteredRankingUser | { isRegistered: false };

export type RankingItem = {
  rank: number;
  displayName: string;
  score: number;
  durationMs: number | null;
};

export type MyRecordsResponse = {
  displayName: string;
  records: Record<RankingType, {
    bestScore: number | null;
    bestDurationMs: number | null;
    rank: number | null;
  }>;
};

export type SubmitScoreResponse = {
  success: true;
  rankingType: RankingType;
  submittedScore: number;
  bestScore: number;
  bestDurationMs: number | null;
  isNewBest: boolean;
};

type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export class RankingApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message);
    this.name = 'RankingApiError';
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const rankingApiUrl = supabaseUrl
  ? `${supabaseUrl}/functions/v1/ranking-api`
  : null;

const rankingCache = new Map<RankingType, RankingItem[]>();
const rankingRequests = new Map<RankingType, Promise<RankingItem[]>>();
const myRecordsCache = new Map<string, MyRecordsResponse>();
const myRecordsRequests = new Map<string, Promise<MyRecordsResponse>>();
const myRecordsRequestTokens = new Map<string, symbol>();
const MAX_VISIBLE_RANKING_ITEMS = 15;
const MY_RECORDS_STORAGE_PREFIX = 'hoo-balloon:nongame:my-records:';
const REGISTERED_USER_STORAGE_PREFIX = 'hoo-balloon:nongame:registered-user:';
const TOP_RANKING_STORAGE_PREFIX = 'hoo-balloon:nongame:top-ranking:';

function saveRankingToStorage(rankingType: RankingType, ranking: RankingItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${TOP_RANKING_STORAGE_PREFIX}${rankingType}`,
      JSON.stringify(ranking.slice(0, MAX_VISIBLE_RANKING_ITEMS)),
    );
  } catch {
    // Local storage may be unavailable or full in a WebView.
  }
}

function readRankingFromStorage(rankingType: RankingType): RankingItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(
      `${TOP_RANKING_STORAGE_PREFIX}${rankingType}`,
    );
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        rank: Number(item.rank) || 0,
        displayName: String(item.displayName ?? ''),
        score: Number(item.score) || 0,
        durationMs: item.durationMs != null ? Number(item.durationMs) : null,
      }));
  } catch {
    return null;
  }
}

function saveRegisteredRankingUser(anonymousKey: string, user: RegisteredRankingUser): void {
  try {
    window.localStorage.setItem(
      `${REGISTERED_USER_STORAGE_PREFIX}${anonymousKey}`,
      JSON.stringify(user),
    );
  } catch {
    // Local storage may be unavailable in a WebView.
  }
}

export function getCachedRegisteredRankingUser(
  anonymousKey: string,
): RegisteredRankingUser | null {
  try {
    const stored = window.localStorage.getItem(
      `${REGISTERED_USER_STORAGE_PREFIX}${anonymousKey}`,
    );
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as Partial<RegisteredRankingUser>).isRegistered !== true ||
      typeof (parsed as Partial<RegisteredRankingUser>).displayName !== 'string'
    ) {
      return null;
    }
    return parsed as RegisteredRankingUser;
  } catch {
    return null;
  }
}

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

function saveMyRecordsToStorage(anonymousKey: string, records: MyRecordsResponse): void {
  try {
    window.localStorage.setItem(
      `${MY_RECORDS_STORAGE_PREFIX}${anonymousKey}`,
      JSON.stringify(records),
    );
  } catch {
    // Local storage may be unavailable or full in a WebView.
  }
}

function readMyRecordsFromStorage(anonymousKey: string): MyRecordsResponse | null {
  try {
    const stored = window.localStorage.getItem(`${MY_RECORDS_STORAGE_PREFIX}${anonymousKey}`);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isMyRecordsResponse(parsed) ? normalizeMyRecords(parsed) : null;
  } catch {
    return null;
  }
}

function cacheMyRecords(anonymousKey: string, records: MyRecordsResponse): void {
  const normalized = normalizeMyRecords(records);
  myRecordsCache.set(anonymousKey, normalized);
  saveMyRecordsToStorage(anonymousKey, normalized);
}

async function rankingApi<T>(
  path: string,
  options: RequestInit = {},
  anonymousKey?: string,
): Promise<T> {
  if (!rankingApiUrl) {
    throw new RankingApiError(
      'CONFIGURATION_ERROR',
      '랭킹 연결 정보를 찾지 못했어요.',
      0,
      null,
    );
  }

  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (anonymousKey) headers.set('x-anonymous-user-key', anonymousKey);

  const response = await fetch(`${rankingApiUrl}${path}`, {
    ...options,
    cache: 'no-store',
    headers,
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const error = body as ApiErrorBody;
    const retryAfter = response.headers.get('Retry-After');
    throw new RankingApiError(
      error.error?.code ?? 'UNKNOWN_ERROR',
      error.error?.message ?? '요청을 처리하지 못했어요.',
      response.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }

  return body as T;
}

export function getRankingUser(anonymousKey: string): Promise<RankingUser> {
  return rankingApi<RankingUser>('/ranking-user', {}, anonymousKey).then((user) => {
    if (user.isRegistered) saveRegisteredRankingUser(anonymousKey, user);
    return user;
  });
}

export function registerNickname(
  nickname: string,
  anonymousKey: string,
): Promise<RegisteredRankingUser> {
  return rankingApi<RegisteredRankingUser>(
    '/register-nickname',
    { method: 'POST', body: JSON.stringify({ nickname }) },
    anonymousKey,
  ).then((user) => {
    saveRegisteredRankingUser(anonymousKey, user);
    return user;
  });
}

export function updateNickname(
  nickname: string,
  anonymousKey: string,
): Promise<RegisteredRankingUser> {
  return rankingApi<RegisteredRankingUser>(
    '/update-nickname',
    { method: 'POST', body: JSON.stringify({ nickname }) },
    anonymousKey,
  ).then((user) => {
    saveRegisteredRankingUser(anonymousKey, user);
    return user;
  });
}

export function submitScore(
  rankingType: RankingType,
  score: number,
  durationMs: number | null,
  anonymousKey: string,
): Promise<SubmitScoreResponse> {
  return rankingApi<SubmitScoreResponse>(
    '/submit-score',
    { method: 'POST', body: JSON.stringify({ rankingType, score, durationMs }) },
    anonymousKey,
  );
}

export function getRanking(rankingType: RankingType): Promise<RankingItem[]> {
  const pendingRequest = rankingRequests.get(rankingType);
  if (pendingRequest) return pendingRequest;

  const request = rankingApi<RankingItem[]>(
    `/ranking?rankingType=${rankingType}&limit=${MAX_VISIBLE_RANKING_ITEMS}`,
  )
    .then((ranking) => {
      const normalizedRanking = ranking.map((item) => ({
        ...item,
        durationMs: item.durationMs ?? null,
      }));
      rankingCache.set(rankingType, normalizedRanking);
      saveRankingToStorage(rankingType, normalizedRanking);
      return normalizedRanking;
    })
    .finally(() => {
      rankingRequests.delete(rankingType);
    });
  rankingRequests.set(rankingType, request);
  return request;
}

export function getMyRecords(
  anonymousKey: string,
  options: { forceRefresh?: boolean } = {},
): Promise<MyRecordsResponse> {
  const pendingRequest = myRecordsRequests.get(anonymousKey);
  if (pendingRequest && !options.forceRefresh) return pendingRequest;

  const requestToken = Symbol(anonymousKey);
  myRecordsRequestTokens.set(anonymousKey, requestToken);
  const request = rankingApi<MyRecordsResponse>('/my-records', {}, anonymousKey)
    .then((records) => {
      if (myRecordsRequestTokens.get(anonymousKey) === requestToken) {
        cacheMyRecords(anonymousKey, records);
      }
      return records;
    })
    .finally(() => {
      if (myRecordsRequests.get(anonymousKey) === request) {
        myRecordsRequests.delete(anonymousKey);
      }
      if (myRecordsRequestTokens.get(anonymousKey) === requestToken) {
        myRecordsRequestTokens.delete(anonymousKey);
      }
    });
  myRecordsRequests.set(anonymousKey, request);
  return request;
}

export function getCachedRanking(rankingType: RankingType): RankingItem[] | null {
  const memoryCached = rankingCache.get(rankingType);
  if (memoryCached) return memoryCached;

  const stored = readRankingFromStorage(rankingType);
  if (stored) {
    rankingCache.set(rankingType, stored);
    return stored;
  }

  return null;
}

export function getCachedMyRecords(anonymousKey: string): MyRecordsResponse | null {
  const memoryCached = myRecordsCache.get(anonymousKey);
  if (memoryCached) return memoryCached;

  const stored = readMyRecordsFromStorage(anonymousKey);
  if (stored) myRecordsCache.set(anonymousKey, stored);
  return stored;
}

export function updateCachedDisplayName(anonymousKey: string, displayName: string): void {
  const records = getCachedMyRecords(anonymousKey);
  if (records) cacheMyRecords(anonymousKey, { ...records, displayName });

  for (const [rankingType, ranking] of rankingCache) {
    const nextRanking = ranking.map((item) =>
      item.displayName.includes(' #') && item.displayName.split(' #')[1] === displayName.split(' #')[1]
        ? { ...item, displayName }
        : item,
    );
    rankingCache.set(rankingType, nextRanking);
    saveRankingToStorage(rankingType, nextRanking);
  }
}

export function prefetchRankings(): void {
  void Promise.allSettled([
    getRanking('LUNG_CAPACITY'),
    getRanking('BALLOON_COUNT'),
  ]);
}

export function syncRankingAfterScore(params: {
  rankingType: RankingType;
  bestScore: number;
  bestDurationMs: number | null;
  displayName: string;
  anonymousKey: string;
}): void {
  const { rankingType, bestScore, bestDurationMs, displayName, anonymousKey } = params;
  const cachedRanking = getCachedRanking(rankingType);

  if (cachedRanking) {
    const cachedUserScore = cachedRanking.find(
      (item) => item.displayName === displayName,
    )?.score;
    const cachedUser = cachedRanking.find((item) => item.displayName === displayName);
    const preservedBestScore = Math.max(cachedUserScore ?? 0, bestScore);
    const preservedDurationMs =
      cachedUser && cachedUser.score > bestScore
        ? cachedUser.durationMs
        : cachedUser && cachedUser.score === bestScore
          ? chooseBetterDuration(rankingType, cachedUser.durationMs, bestDurationMs)
          : bestDurationMs;
    const nextRanking = cachedRanking
      .filter((item) => item.displayName !== displayName)
      .concat({
        rank: 0,
        displayName,
        score: preservedBestScore,
        durationMs: preservedDurationMs,
      })
      .sort((a, b) => compareRankingItems(rankingType, a, b))
      .slice(0, 100)
      .map((item, index, items) => ({
        ...item,
        rank:
          index > 0 && hasSameRankingRecord(item, items[index - 1])
            ? items[index - 1].rank
            : index + 1,
      }));
    rankingCache.set(rankingType, nextRanking);
    saveRankingToStorage(rankingType, nextRanking);
  }

  const cachedRecords = getCachedMyRecords(anonymousKey);
  if (cachedRecords) {
    const currentBestScore = cachedRecords.records[rankingType].bestScore ?? 0;
    const preservedBestScore = Math.max(currentBestScore, bestScore);
    const currentBestDuration = cachedRecords.records[rankingType].bestDurationMs;
    const preservedBestDuration =
      currentBestScore > bestScore
        ? currentBestDuration
        : currentBestScore === bestScore
          ? chooseBetterDuration(rankingType, currentBestDuration, bestDurationMs)
          : bestDurationMs;
    const optimisticRank = rankingCache
      .get(rankingType)
      ?.find((item) => item.displayName === displayName)?.rank;
    cacheMyRecords(anonymousKey, {
      ...cachedRecords,
      records: {
        ...cachedRecords.records,
        [rankingType]: {
          bestScore: preservedBestScore,
          bestDurationMs: preservedBestDuration,
          rank: optimisticRank ?? cachedRecords.records[rankingType].rank,
        },
      },
    });
  }

  void Promise.allSettled([getRanking(rankingType), getMyRecords(anonymousKey)]);
}
