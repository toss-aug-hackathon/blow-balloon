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
};

export type MyRecordsResponse = {
  displayName: string;
  records: Record<GameType, { bestScore: number | null; rank: number | null }>;
};

export type SubmitScoreResponse = {
  success: true;
  gameType: GameType;
  submittedScore: number;
  bestScore: number;
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

export function submitScore(
  gameType: GameType,
  score: number,
  userKey: string,
): Promise<SubmitScoreResponse> {
  return gameApi<SubmitScoreResponse>(
    '/submit-score',
    { method: 'POST', body: JSON.stringify({ gameType, score }) },
    userKey,
  );
}

export function getRanking(gameType: GameType): Promise<RankingItem[]> {
  return gameApi<RankingItem[]>(`/ranking?gameType=${gameType}&limit=100`);
}

export function getMyRecords(userKey: string): Promise<MyRecordsResponse> {
  return gameApi<MyRecordsResponse>('/my-records', {}, userKey);
}
