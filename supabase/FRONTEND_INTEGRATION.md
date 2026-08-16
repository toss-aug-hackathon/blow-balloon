# 프론트엔드 연동 요구사항 — 랭킹 및 마이페이지

## 1. 기본 원칙

게임은 랭킹 등록 없이 먼저 플레이할 수 있어야 한다.

사용자가 랭킹에 등록하지 않은 상태에서는 다음 기능을 제공한다.

- 게임 플레이
- 게임 결과 확인
- 다시 플레이

이때 별명을 요구하거나 점수를 백엔드에 저장하지 않는다.

사용자가 게임 결과 화면에서 `랭킹에 등록하기`를 선택했을 때만 별명을 등록하고 점수를 저장한다. 한 번 별명을 등록한 사용자는 이후 다시 별명을 입력하지 않는다.

## 2. API 기본 주소

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/ranking-api
```

```ts
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

if (!SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL이 설정되지 않았습니다.')
}

const RANKING_API_URL = `${SUPABASE_URL}/functions/v1/ranking-api`
```

로컬 개발에서는 `.env.example`을 `.env.local`로 복사한 뒤 실제 값을 입력한다. `.env.example`은 예시 파일이므로 실제 프로젝트 값으로 수정하지 않는다.

```bash
cp .env.example .env.local
```

프론트엔드에는 다음 값을 절대 넣지 않는다.

```text
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_SECRET_KEYS
DB 접속 정보
```

현재 API는 일반 `fetch()`로 호출한다. 프론트엔드에서 Supabase DB를 직접 조회하거나 수정하지 않는다.

현재 구조는 Supabase Auth와 `supabase-js` 클라이언트를 사용하지 않으므로 `VITE_SUPABASE_PUBLISHABLE_KEY`는 설정하지 않는다. 사용자 식별에는 토스의 `getAnonymousKey()` 결과만 사용한다.

## 3. 사용자 식별

앱 실행 후 토스 API로 사용자 식별값을 가져온다. `getAnonymousKey()`은 문자열을 직접 반환하지 않고 성공 시 `{ type: 'HASH', hash: string }` 객체를 반환한다.

```ts
const anonymousKeyResult = await getAnonymousKey()

if (
  !anonymousKeyResult ||
  anonymousKeyResult === 'INVALID_CATEGORY' ||
  anonymousKeyResult === 'ERROR'
) {
  throw new Error('토스 사용자 식별값을 가져오지 못했습니다.')
}

const anonymousKey = anonymousKeyResult.hash
```

- `INVALID_CATEGORY`: 게임 카테고리 미니앱이 아닌 경우
- `ERROR`: 사용자 키 조회 실패
- `undefined`: 지원하지 않는 토스 앱 버전 등의 환경 문제

식별값을 얻지 못해도 게임 플레이와 로컬 결과 확인은 허용한다. 랭킹 등록과 마이페이지에는 재시도 안내를 표시한다.

백엔드 요청에는 다음 헤더로 전달한다.

```text
x-anonymous-user-key: <anonymousKey>
```

요청 본문이나 URL 파라미터에는 넣지 않는다.

`anonymousKey` 처리 규칙:

- 화면에 표시하지 않는다.
- 콘솔이나 분석 로그에 기록하지 않는다.
- 오류 메시지에 포함하지 않는다.
- 다른 사용자에게 전달하지 않는다.
- 가능하면 앱 실행 중 메모리에만 보관한다.

랭킹 조회에는 사용자 키가 필요하지 않다. 사용자 확인, 별명 등록, 점수 등록, 마이페이지 조회에는 필요하다.

## 4. 랭킹 모드

다음 문자열을 정확히 사용한다.

```ts
type RankingType = 'BALLOON_COUNT' | 'LUNG_CAPACITY'
```

| 화면의 게임 | API `rankingType` |
| --- | --- |
| 풍선 스피드런 | `BALLOON_COUNT` |
| 폐활량 테스트 | `LUNG_CAPACITY` |

대소문자를 변경하거나 화면용 한글 이름을 API에 보내면 안 된다.

## 5. 점수 규칙

### 풍선 스피드런

완성된 풍선 개수와 마지막으로 완성한 풍선까지의 시간을 함께 전송한다. 미완성 풍선은 포함하지 않는다.
개수가 많은 기록을 우선하며, 개수가 같으면 마지막 풍선 완성 시간이 짧은 기록을 우선한다.

```json
{
  "rankingType": "BALLOON_COUNT",
  "score": 26,
  "durationMs": 17360,
  "submissionId": "12345678-1234-4123-8123-123456789abc"
}
```

허용 범위는 `0~50`이다.

### 폐활량 테스트

프론트 게임 로직에서 계산한 정수 점수를 전송한다.

```json
{
  "rankingType": "LUNG_CAPACITY",
  "score": 184,
  "durationMs": 8420
}
```

풍선 크기 점수와 한 호흡 시간을 함께 저장한다. 리터, 밀리리터 등 의료 측정 단위로 표시하면 안 된다.
점수가 높은 기록을 우선하며, 점수가 같으면 호흡 시간이 긴 기록을 우선한다.

허용 범위는 `0~9999`이다.

소수, 문자열, `NaN`, 음수는 보내지 않는다.

```ts
const score = Math.round(calculatedScore)
```

점수 계산식은 앱 버전마다 임의로 바꾸지 않는다. 계산식이 달라지면 기존 랭킹과 공정하게 비교할 수 없다.

## 6. 앱 시작 시 사용자 확인

앱 실행 후 `anonymousKey`를 획득하면 등록된 사용자인지 조회한다.

```http
GET /ranking-user
x-anonymous-user-key: <anonymousKey>
```

```ts
const response = await fetch(`${RANKING_API_URL}/ranking-user`, {
  headers: {
    'x-anonymous-user-key': anonymousKey,
  },
})

const result = await response.json()
```

등록된 사용자 응답:

```json
{
  "success": true,
  "isRegistered": true,
  "displayName": "연심 #82",
  "nickname": "연심",
  "displayId": 82
}
```

미등록 사용자 응답:

```json
{
  "success": true,
  "isRegistered": false
}
```

```ts
type RankingUser =
  | {
      isRegistered: true
      displayName: string
      nickname: string
      displayId: number
    }
  | {
      isRegistered: false
    }
```

처리 방법:

- 등록 사용자: 사용자 정보를 앱 상태에 저장하고 별명 입력을 생략한다.
- 미등록 사용자: 게임은 그대로 허용하고 결과 화면에서 랭킹 등록 선택지를 표시한다.
- 조회 실패: 게임 자체는 허용하되 랭킹과 마이페이지에 재시도 안내를 표시한다.

## 7. 첫 게임 종료 후 처리

미등록 사용자의 게임 결과 화면에는 다음 선택지를 제공한다.

```text
랭킹에 등록하기
등록하지 않기
```

### 등록하지 않기

- 별명을 요구하지 않는다.
- `/register-nickname`을 호출하지 않는다.
- `/submit-score`를 호출하지 않는다.
- 게임 결과만 표시한다.
- 다시 게임할 수 있도록 처리한다.

### 랭킹에 등록하기

다음 순서로 처리한다.

```text
별명 입력
→ 별명 등록 API
→ 점수 등록 API
→ 신기록 결과 표시
→ 필요한 경우 랭킹 재조회
```

별명 등록이 성공하기 전에는 점수 등록 API를 호출하지 않는다.

## 8. 별명 등록

```http
POST /register-nickname
Content-Type: application/json
x-anonymous-user-key: <anonymousKey>
```

요청:

```json
{
  "nickname": "연심"
}
```

```ts
const response = await fetch(`${RANKING_API_URL}/register-nickname`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-anonymous-user-key': anonymousKey,
  },
  body: JSON.stringify({ nickname }),
})

const result = await response.json()
```

성공 응답은 HTTP `201`이다.

```json
{
  "success": true,
  "displayName": "연심 #82",
  "nickname": "연심",
  "displayId": 82
}
```

별명 규칙:

- 완성형 한글·영문·숫자 2~6자
- 중복 허용
- 공백, 한글 자모, 이모지, 특수기호 사용 불가
- 실제 화면에는 서버가 반환한 `displayName` 사용

프론트에서도 같은 규칙을 먼저 검사하되 서버 응답을 최종 기준으로 사용한다.

## 9. 별명 변경

나의 기록 화면에서 별명을 변경할 때 호출한다. 표시 ID는 변경되지 않는다.

```http
POST /update-nickname
Content-Type: application/json
x-anonymous-user-key: <anonymousKey>
```

```json
{
  "nickname": "새별명"
}
```

이미 등록된 사용자가 다시 호출해도 최초 별명과 `displayId`가 유지된다. 별명 변경 API는 제공하지 않는다.

## 9. 점수 등록

```http
POST /submit-score
Content-Type: application/json
x-anonymous-user-key: <anonymousKey>
```

요청:

```json
{
  "rankingType": "BALLOON_COUNT",
  "score": 26,
  "durationMs": 17360
}
```

```ts
const response = await fetch(`${RANKING_API_URL}/submit-score`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-anonymous-user-key': anonymousKey,
  },
  body: JSON.stringify({ rankingType, score, durationMs, submissionId }),
})

const result = await response.json()
```

신기록 응답:

```json
{
  "success": true,
  "rankingType": "BALLOON_COUNT",
  "submittedScore": 26,
  "bestScore": 26,
  "bestDurationMs": 17360,
  "isNewBest": true
}
```

신기록이 아닌 경우:

```json
{
  "success": true,
  "rankingType": "BALLOON_COUNT",
  "submittedScore": 24,
  "bestScore": 26,
  "bestDurationMs": 17360,
  "isNewBest": false
}
```

화면 처리:

- `submittedScore`: 이번 플레이 점수
- `bestScore`: 서버에 저장된 최종 최고 점수
- `isNewBest: true`: 신기록 연출 표시
- `isNewBest: false`: 기존 최고 기록 유지 안내

프론트에서 이전 최고 점수와 직접 비교해 신기록을 판단하지 않는다. 서버가 반환한 `isNewBest`를 사용한다.

사용자가 이미 별명을 등록한 상태라면 게임 종료 후 먼저 로컬 Outbox에 보관하고 `/submit-score`를 백그라운드에서 호출한다. 같은 Outbox 항목을 재전송할 때는 같은 `submissionId`를 유지한다.

## 10. 전체 랭킹 조회

랭킹은 모드별로 따로 조회한다.

```http
GET /ranking?rankingType=BALLOON_COUNT&limit=15
```

```http
GET /ranking?rankingType=LUNG_CAPACITY&limit=15
```

이 요청에는 `x-anonymous-user-key`가 필요하지 않다.

```ts
const response = await fetch(
  `${RANKING_API_URL}/ranking?rankingType=${rankingType}&limit=100`,
)

const ranking = await response.json()
```

응답:

```json
[
  {
    "rank": 1,
    "displayName": "연심 #82",
    "score": 39
  },
  {
    "rank": 2,
    "displayName": "고양이 #31",
    "score": 37
  }
]
```

```ts
type RankingItem = {
  rank: number
  displayName: string
  score: number
  durationMs: number | null
}
```

랭킹 화면 처리:

- 화면 진입 시 선택된 게임 랭킹을 조회한다.
- 랭킹 모드 탭을 변경할 때 다시 조회한다.
- 화면을 계속 열어두면 5~10초 간격 polling을 사용할 수 있다.
- 화면을 벗어나면 polling을 중지한다.
- `limit`은 1~100만 사용한다.
- 빈 배열이면 `아직 등록된 기록이 없어요`를 표시한다.

점수와 모드별 시간 기록까지 모두 같은 사용자는 같은 순위를 받는다.

```text
1위
1위
3위
```

응답은 점수 내림차순이다. 점수가 같으면 크게 불기는 호흡 시간 내림차순,
스피드런은 마지막 완성 시간 오름차순이며, 두 값까지 같으면 `displayId` 오름차순으로 표시한다.

## 11. 마이페이지 조회

등록된 사용자의 두 모드 최고 기록과 현재 순위를 조회한다.

```http
GET /my-records
x-anonymous-user-key: <anonymousKey>
```

```ts
const response = await fetch(`${RANKING_API_URL}/my-records`, {
  headers: {
    'x-anonymous-user-key': anonymousKey,
  },
})

const result = await response.json()
```

응답:

```json
{
  "displayName": "연심 #82",
  "records": {
    "BALLOON_COUNT": {
      "bestScore": 39,
      "rank": 12
    },
    "LUNG_CAPACITY": {
      "bestScore": 21320,
      "rank": 7
    }
  }
}
```

아직 기록이 없는 게임:

```json
{
  "displayName": "연심 #82",
  "records": {
    "BALLOON_COUNT": {
      "bestScore": 39,
      "rank": 12
    },
    "LUNG_CAPACITY": {
      "bestScore": null,
      "rank": null
    }
  }
}
```

```ts
type MyRecordsResponse = {
  displayName: string
  records: Record<
    RankingType,
    {
      bestScore: number | null
      rank: number | null
    }
  >
}
```

마이페이지 처리:

- 마이페이지 진입 시마다 재조회한다.
- 점수 등록 성공 후 기존 마이페이지 데이터를 무효화하거나 재조회한다.
- `bestScore: null`이면 `기록 없음`을 표시한다.
- `rank: null`이면 순위를 숫자로 표시하지 않는다.
- 지속적인 polling은 사용하지 않는다.
- 미등록 사용자에게는 랭킹 등록 안내를 표시한다.

## 12. 전체 화면 흐름

```text
앱 실행
→ getAnonymousKey()
→ GET /ranking-user
→ 등록 여부를 앱 상태에 저장
→ 게임 선택 및 플레이
→ 게임 종료
```

미등록 사용자:

```text
게임 종료
→ 결과 표시
→ 랭킹 등록 여부 선택
├─ 등록하지 않기
│  └─ API 호출 없이 종료
└─ 랭킹에 등록하기
   → 별명 입력
   → POST /register-nickname
   → 로컬 Outbox 보관
   → POST /submit-score 자동 동기화
   → 신기록 여부 표시
   → 랭킹 화면 이동 가능
```

등록 사용자:

```text
게임 종료
→ 로컬 Outbox 보관 완료 표시
→ POST /submit-score 자동 동기화
→ 서버 반영과 신기록 여부 표시
→ 필요한 경우 랭킹 재조회
```

랭킹:

```text
랭킹 화면 진입
→ 선택된 rankingType으로 GET /ranking
→ 게임 탭 변경 시 다시 조회
```

마이페이지:

```text
마이페이지 진입
→ GET /my-records
→ 두 모드 기록과 현재 순위 표시
```

## 13. 오류 처리

공통 오류 응답:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_SCORE",
    "message": "점수는 허용 범위의 정수여야 해요."
  }
}
```

주요 HTTP 상태:

| 상태 | 의미 | 프론트 처리 |
| --- | --- | --- |
| `400` | 입력값 오류 | 입력 내용 확인 안내 |
| `404` | 미등록 사용자 또는 없는 API | 등록 화면 또는 오류 화면 |
| `429` | 서로 다른 점수 등록 요청 간격이 너무 짧음 | Outbox에서 자동 백오프 |
| `500` | 서버 내부 오류 | 재시도 안내 |

주요 오류 코드:

```text
INVALID_ANONYMOUS_KEY
INVALID_NICKNAME
INVALID_RANKING_TYPE
INVALID_SCORE
INVALID_DURATION
INVALID_SUBMISSION_ID
INVALID_LIMIT
USER_NOT_REGISTERED
RATE_LIMITED
NOT_FOUND
INTERNAL_ERROR
```

네트워크 또는 서버 장애가 발생해도 점수를 잃지 않도록 네이티브 Storage와 `localStorage` Outbox에 먼저 보관한다. 동일 `submissionId`는 서버가 멱등 처리하고, 429·네트워크·5xx는 지수 백오프로 자동 재전송한다. 로컬 보관과 서버 저장이 모두 실패하거나 영구 4xx가 발생한 경우에만 재시도 버튼을 제공한다.

## 14. 공통 요청 함수 예시

```ts
type ApiErrorBody = {
  success: false
  error: {
    code: string
    message: string
  }
}

class RankingApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | null,
  ) {
    super(message)
    this.name = 'RankingApiError'
  }
}

async function rankingApi<T>(
  path: string,
  options: RequestInit = {},
  anonymousKey?: string,
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (anonymousKey) {
    headers.set('x-anonymous-user-key', anonymousKey)
  }

  const response = await fetch(`${RANKING_API_URL}${path}`, {
    ...options,
    headers,
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    const errorBody = body as ApiErrorBody
    const retryAfter = response.headers.get('Retry-After')
    throw new RankingApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? '요청을 처리하지 못했어요.',
      response.status,
      retryAfter ? Number(retryAfter) : null,
    )
  }

  return body as T
}
```

사용 예:

```ts
const ranking = await rankingApi<RankingItem[]>(
  `/ranking?rankingType=${rankingType}&limit=100`,
)

const records = await rankingApi<MyRecordsResponse>(
  '/my-records',
  {},
  anonymousKey,
)
```

## 15. 프론트엔드 완료 조건

- 앱 실행 시 사용자 등록 여부를 확인한다.
- 미등록 사용자도 게임을 플레이할 수 있다.
- 미등록 사용자의 결과 화면에서만 랭킹 등록 선택지를 제공한다.
- 등록하지 않으면 별명과 점수를 전송하지 않는다.
- 별명 등록 성공 후 해당 게임 점수를 저장한다.
- 기존 사용자는 별명 입력을 생략한다.
- 두 랭킹 모드를 정확히 분리한다.
- 신기록 여부는 서버 응답으로 표시한다.
- 랭킹 화면 진입과 게임 탭 변경 시 최신 데이터를 조회한다.
- 마이페이지 진입 시 최신 기록을 조회한다.
- 기록 없는 게임은 `기록 없음`으로 표시한다.
- `anonymousKey`와 서버 Secret을 화면이나 로그에 노출하지 않는다.
- 네트워크 실패 시 방금 플레이한 결과를 유지하고 재시도할 수 있다.
- 랭킹 polling은 화면을 벗어날 때 반드시 정리한다.
