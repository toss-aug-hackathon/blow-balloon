import { createClient } from 'npm:@supabase/supabase-js@2'

type GameType = 'BALLOON_COUNT' | 'LUNG_CAPACITY'

const GAME_TYPES = new Set<GameType>(['BALLOON_COUNT', 'LUNG_CAPACITY'])
const SCORE_LIMITS: Record<GameType, number> = {
  BALLOON_COUNT: 50,
  LUNG_CAPACITY: 9999,
}
const USER_KEY_HEADER = 'x-game-user-key'
const BLOCKED_NICKNAME_TERMS = [
  '시발', '시이발', '씨발', '씨이발', 'ㅅㅂ', '개새끼', '개새', '새끼', '병신', '븅신',
  '지랄', '존나', '좆', '씹', '섹스', '야동', '포르노', '자지', '보지',
  '성기', '강간', '창녀', '걸레', 'fuck', 'shit', 'bitch', 'asshole',
  'dick', 'pussy', 'porn', 'sex',
] as const

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS')
const adminApiKey = (() => {
  if (secretKeys) {
    try {
      const parsed: unknown = JSON.parse(secretKeys)
      if (parsed && typeof parsed === 'object' && 'default' in parsed) {
        const defaultKey = (parsed as { default?: unknown }).default
        if (typeof defaultKey === 'string') return defaultKey
      }
    } catch {
      console.error('SUPABASE_SECRET_KEYS가 올바른 JSON이 아닙니다.')
    }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
})()

if (!supabaseUrl || !adminApiKey) {
  throw new Error('Supabase 관리자 키와 SUPABASE_URL이 필요합니다.')
}

const supabase = createClient(supabaseUrl, adminApiKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `content-type, ${USER_KEY_HEADER}`,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Expose-Headers': 'Retry-After',
}

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  })
}

function error(
  code: string,
  message: string,
  status: number,
  headers?: Record<string, string>,
): Response {
  return json({ success: false, error: { code, message } }, status, headers)
}

function getUserKey(req: Request): string | null {
  const value = req.headers.get(USER_KEY_HEADER)
  if (!value || value !== value.trim() || value.length > 255) return null
  return value
}

function parseGameType(value: unknown): GameType | null {
  return typeof value === 'string' && GAME_TYPES.has(value as GameType)
    ? value as GameType
    : null
}

function parseScore(value: unknown, gameType: GameType): number | null {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return null
  return (value as number) <= SCORE_LIMITS[gameType] ? value as number : null
}

function parseDurationMs(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 86_400_000) {
    return undefined
  }
  return value as number
}

function parseNickname(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const nickname = value.trim()
  const length = Array.from(nickname).length
  if (length < 2 || length > 12 || /[#\p{Cc}]/u.test(nickname)) return null
  const normalized = nickname
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}\p{Cf}]+/gu, '')
    .replace(/(.)\1+/gu, '$1')
  if (BLOCKED_NICKNAME_TERMS.some((term) => normalized.includes(term))) return null
  return nickname
}

async function parseJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json()
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function databaseError(message?: string): Response {
  if (message?.includes('SCORE_SUBMISSION_TOO_FREQUENT')) {
    return error(
      'RATE_LIMITED',
      '점수 등록 요청이 너무 빨라요. 잠시 후 다시 시도해 주세요.',
      429,
      { 'Retry-After': '3' },
    )
  }
  if (message?.includes('USER_NOT_REGISTERED')) {
    return error('USER_NOT_REGISTERED', '랭킹에 등록된 사용자가 아니에요.', 404)
  }
  if (message?.includes('INVALID_')) {
    return error('INVALID_INPUT', '입력값을 확인해 주세요.', 400)
  }
  console.error('Database request failed:', message)
  return error('INTERNAL_ERROR', '요청을 처리하지 못했어요.', 500)
}

async function getGameUser(userKey: string): Promise<Response> {
  const { data, error: dbError } = await supabase.rpc('get_game_user', {
    p_user_key: userKey,
  })
  if (dbError) return databaseError(dbError.message)

  const user = data?.[0]
  return json(user
    ? {
        success: true,
        isRegistered: true,
        displayName: `${user.nickname} #${user.display_id}`,
        nickname: user.nickname,
        displayId: user.display_id,
      }
    : { success: true, isRegistered: false })
}

async function registerNickname(req: Request, userKey: string): Promise<Response> {
  const body = await parseJson(req)
  const nickname = parseNickname(body?.nickname)
  if (!nickname) {
    return error('INVALID_NICKNAME', '별명은 # 없이 2~12자로 입력해 주세요.', 400)
  }

  const { data, error: dbError } = await supabase.rpc('register_game_user', {
    p_user_key: userKey,
    p_nickname: nickname,
  })
  if (dbError) return databaseError(dbError.message)

  const user = data?.[0]
  return json({
    success: true,
    displayName: `${user.nickname} #${user.display_id}`,
    nickname: user.nickname,
    displayId: user.display_id,
  }, 201)
}

async function updateNickname(req: Request, userKey: string): Promise<Response> {
  const body = await parseJson(req)
  const nickname = parseNickname(body?.nickname)
  if (!nickname) {
    return error('INVALID_NICKNAME', '별명은 # 없이 2~12자로 입력해 주세요.', 400)
  }

  const { data, error: dbError } = await supabase.rpc('update_game_nickname', {
    p_user_key: userKey,
    p_nickname: nickname,
  })
  if (dbError) return databaseError(dbError.message)

  const user = data?.[0]
  return json({
    success: true,
    displayName: `${user.nickname} #${user.display_id}`,
    nickname: user.nickname,
    displayId: user.display_id,
  })
}

async function submitScore(req: Request, userKey: string): Promise<Response> {
  const body = await parseJson(req)
  const gameType = parseGameType(body?.gameType)
  if (!gameType) {
    return error('INVALID_GAME_TYPE', '지원하지 않는 게임 종류예요.', 400)
  }

  const score = parseScore(body?.score, gameType)
  if (score === null) {
    return error(
      'INVALID_SCORE',
      `점수는 0부터 ${SCORE_LIMITS[gameType]} 사이의 정수여야 해요.`,
      400,
    )
  }
  const durationMs = parseDurationMs(body?.durationMs)
  if (durationMs === undefined) {
    return error('INVALID_DURATION', '기록 시간을 확인해 주세요.', 400)
  }

  const { data, error: dbError } = await supabase.rpc('submit_best_score', {
    p_user_key: userKey,
    p_game_type: gameType,
    p_score: score,
    p_duration_ms: durationMs,
  })
  if (dbError) return databaseError(dbError.message)

  return json({
    success: true,
    gameType,
    submittedScore: score,
    bestScore: data[0].best_score,
    bestDurationMs: data[0].best_duration_ms,
    isNewBest: data[0].is_new_best,
  })
}

async function getRanking(url: URL): Promise<Response> {
  const gameType = parseGameType(url.searchParams.get('gameType'))
  if (!gameType) {
    return error('INVALID_GAME_TYPE', '지원하지 않는 게임 종류예요.', 400)
  }

  const rawLimit = url.searchParams.get('limit') ?? '100'
  const limit = Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return error('INVALID_LIMIT', 'limit은 1부터 100 사이의 정수여야 해요.', 400)
  }

  const { data, error: dbError } = await supabase.rpc('get_game_ranking', {
    p_game_type: gameType,
    p_limit: limit,
  })
  if (dbError) return databaseError(dbError.message)

  return json(data.map((row) => ({
    rank: row.rank,
    displayName: `${row.nickname} #${row.display_id}`,
    score: row.score,
    durationMs: row.duration_ms ?? null,
  })))
}

async function getMyRecords(userKey: string): Promise<Response> {
  const { data, error: dbError } = await supabase.rpc('get_my_records', {
    p_user_key: userKey,
  })
  if (dbError) return databaseError(dbError.message)
  if (!data?.length) {
    return error('USER_NOT_REGISTERED', '랭킹에 등록된 사용자가 아니에요.', 404)
  }

  const records: Record<GameType, {
    bestScore: number | null;
    bestDurationMs: number | null;
    rank: number | null;
  }> = {
    BALLOON_COUNT: { bestScore: null, bestDurationMs: null, rank: null },
    LUNG_CAPACITY: { bestScore: null, bestDurationMs: null, rank: null },
  }
  for (const row of data) {
    records[row.game_type as GameType] = {
      bestScore: row.best_score,
      bestDurationMs: row.best_duration_ms ?? null,
      rank: row.rank,
    }
  }

  return json({
    displayName: `${data[0].nickname} #${data[0].display_id}`,
    records,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })

  const url = new URL(req.url)
  const route = url.pathname.replace(/^\/game-api\/?/, '/')

  if (route === '/ranking' && req.method === 'GET') return getRanking(url)

  const userKey = getUserKey(req)
  if (!userKey) {
    return error('INVALID_USER_KEY', `${USER_KEY_HEADER} 헤더가 필요해요.`, 400)
  }

  if (route === '/game-user' && req.method === 'GET') return getGameUser(userKey)
  if (route === '/register-nickname' && req.method === 'POST') {
    return registerNickname(req, userKey)
  }
  if (route === '/update-nickname' && req.method === 'POST') {
    return updateNickname(req, userKey)
  }
  if (route === '/submit-score' && req.method === 'POST') return submitScore(req, userKey)
  if (route === '/my-records' && req.method === 'GET') return getMyRecords(userKey)

  return error('NOT_FOUND', '요청한 API를 찾을 수 없어요.', 404)
})
