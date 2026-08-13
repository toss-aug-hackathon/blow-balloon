# API 명세

[README로 돌아가기](../README.md) · [ERD](erd.md) · [아키텍처](architecture.md)

## 개요

Supabase Edge Function `ranking-api`가 랭킹·프로필 HTTP API를 제공합니다.

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/ranking-api
```

프런트엔드는 `VITE_SUPABASE_URL`에서 이 주소를 구성합니다. 실제 프로젝트 URL과 배포 상태는 저장소만으로 확인할 수 없습니다.

## 공통 계약

### Headers

| Header | 적용 | 설명 |
| --- | --- | --- |
| `Content-Type: application/json` | POST | JSON 요청 본문 |
| `x-anonymous-user-key` | `/ranking` 이외 모든 API | Toss `getAnonymousKey()` 결과의 `hash`, trim된 1~255자 |

JWT 또는 Supabase Auth 세션은 사용하지 않습니다. `x-anonymous-user-key`는 사용자 식별값이지만 서버 서명 검증이 없어 강한 인증 토큰으로 볼 수 없습니다.

### 성공 응답

대부분 객체 응답은 `success: true`를 포함하지만 `/ranking`은 배열을, `/my-records`는 `success` 없는 객체를 반환합니다. `Cache-Control: no-store`와 `Content-Type: application/json; charset=utf-8`가 설정됩니다.

### 오류 응답

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "입력값을 확인해 주세요."
  }
}
```

| HTTP | 대표 코드 | 발생 조건 |
| --- | --- | --- |
| 400 | `INVALID_ANONYMOUS_KEY`, `INVALID_NICKNAME`, `INVALID_RANKING_TYPE`, `INVALID_SCORE`, `INVALID_DURATION`, `INVALID_LIMIT`, `INVALID_INPUT` | 헤더·본문·쿼리 검증 실패 |
| 404 | `USER_NOT_REGISTERED`, `NOT_FOUND` | 미등록 사용자 또는 없는 경로 |
| 429 | `RATE_LIMITED` | 같은 사용자·모드의 점수 제출이 3초 이내 반복됨 |
| 500 | `INTERNAL_ERROR` | 매핑되지 않은 데이터베이스 오류 |

429 응답에는 `Retry-After: 3`이 포함됩니다.

### CORS와 OPTIONS

- 허용 Origin: `*`
- 허용 Method: `GET, POST, OPTIONS`
- 허용 Header: `content-type, x-anonymous-user-key`
- `OPTIONS` 응답: 204

CORS 허용은 인증이나 인가를 대체하지 않습니다.

## 엔드포인트 요약

| Method | Endpoint | 사용자 키 | 목적 |
| --- | --- | --- | --- |
| GET | `/ranking` | 불필요 | 모드별 공개 랭킹 조회 |
| GET | `/ranking-user` | 필요 | 등록 사용자 확인 |
| POST | `/register-nickname` | 필요 | 최초 프로필 등록 |
| POST | `/update-nickname` | 필요 | 등록 사용자의 별명 변경 |
| POST | `/submit-score` | 필요 | 모드별 최고 기록 제출 |
| GET | `/my-records` | 필요 | 본인의 두 모드 기록·순위 조회 |

## `GET /ranking`

공개 모드별 랭킹을 조회합니다.

### Query

| 이름 | 필수 | 값 |
| --- | --- | --- |
| `rankingType` | 예 | `BALLOON_COUNT` 또는 `LUNG_CAPACITY` |
| `limit` | 아니요 | 1~100 정수, 기본 100 |

### 200 응답

```json
[
  {
    "rank": 1,
    "displayName": "바람왕 #4821",
    "score": 184,
    "durationMs": 8420
  }
]
```

`durationMs`는 null일 수 있습니다. 같은 점수와 모드별 시간까지 같으면 같은 `rank`를 받고 다음 순위는 건너뜁니다. 최종 표시 순서는 4자리 ID 오름차순으로 고정됩니다.

### Validation·제한

- Edge Function은 최대 100행으로 제한합니다.
- 프런트엔드는 `limit=15`로 요청하고 현재 랭킹 UI는 1~8위를 표시합니다.
- 별도 사용자별 rate limit은 구현되어 있지 않습니다.

## `GET /ranking-user`

`x-anonymous-user-key`에 대응하는 등록 상태를 조회합니다.

### 200 응답: 등록 사용자

```json
{
  "success": true,
  "isRegistered": true,
  "displayName": "바람왕 #4821",
  "nickname": "바람왕",
  "displayId": 4821
}
```

### 200 응답: 미등록 사용자

```json
{
  "success": true,
  "isRegistered": false
}
```

## `POST /register-nickname`

사용자를 최초 등록합니다. 같은 사용자 키로 다시 요청하면 기존 별명과 표시 ID를 반환하며 변경하지 않습니다.

### 요청

```json
{
  "nickname": "바람왕"
}
```

별명은 trim 후 2~12자이며 `#`, 제어문자와 서버 금칙어를 허용하지 않습니다. 중복 별명은 허용되고 고유한 4자리 표시 ID가 붙습니다.

### 201 응답

```json
{
  "success": true,
  "displayName": "바람왕 #4821",
  "nickname": "바람왕",
  "displayId": 4821
}
```

## `POST /update-nickname`

등록 사용자의 별명만 변경하고 4자리 표시 ID는 유지합니다.

### 요청

```json
{
  "nickname": "새바람"
}
```

### 200 응답

```json
{
  "success": true,
  "displayName": "새바람 #4821",
  "nickname": "새바람",
  "displayId": 4821
}
```

미등록 사용자이면 404 `USER_NOT_REGISTERED`를 반환합니다.

## `POST /submit-score`

사용자의 모드별 최고 기록을 저장합니다.

### 요청

```json
{
  "rankingType": "BALLOON_COUNT",
  "score": 18,
  "durationMs": 17360
}
```

| 필드 | 타입·범위 | 의미 |
| --- | --- | --- |
| `rankingType` | enum | `BALLOON_COUNT` 또는 `LUNG_CAPACITY` |
| `score` | safe integer | 풍선 수 0~50 또는 크게 불기 점수 0~9999 |
| `durationMs` | null 또는 0~86,400,000 정수 | 스피드런 마지막 완성 시간 또는 크게 불기 호흡 시간 |

### 200 응답

```json
{
  "success": true,
  "rankingType": "BALLOON_COUNT",
  "submittedScore": 18,
  "bestScore": 18,
  "bestDurationMs": 17360,
  "isNewBest": true
}
```

### 최고 기록 규칙

- 공통: 점수가 더 높으면 새 기록입니다.
- `LUNG_CAPACITY`: 점수가 같으면 `durationMs`가 더 길 때 새 기록입니다.
- `BALLOON_COUNT`: 점수가 같으면 `durationMs`가 더 짧을 때 새 기록입니다.
- 동일 사용자·모드 제출은 DB 트랜잭션에서 직렬화되고 3초에 한 번만 허용됩니다.
- 사용자가 먼저 등록되어 있지 않으면 404를 반환합니다.

서버는 결과가 실제 플레이에서 만들어졌는지 증명하지 않고 값의 범위·형식과 빈도만 검증합니다.

## `GET /my-records`

등록 사용자의 프로필과 두 모드 최고 기록을 조회합니다.

### 200 응답

```json
{
  "displayName": "바람왕 #4821",
  "records": {
    "BALLOON_COUNT": {
      "bestScore": 18,
      "bestDurationMs": 17360,
      "rank": 4
    },
    "LUNG_CAPACITY": {
      "bestScore": 184,
      "bestDurationMs": 8420,
      "rank": 7
    }
  }
}
```

아직 점수가 없는 모드의 값은 null입니다. 미등록 사용자이면 404를 반환합니다.

## 서버 환경 변수

| 변수 | 공개 여부 | 용도 |
| --- | --- | --- |
| `SUPABASE_URL` | 서버 전용 설정 | 프로젝트 API 주소 |
| `SUPABASE_SECRET_KEYS` | 비밀 | JSON의 `default` 관리자 키를 우선 사용 |
| `SUPABASE_SERVICE_ROLE_KEY` | 비밀·fallback | Secret Keys가 없을 때 관리자 키로 사용 |

비밀 값은 저장소나 `VITE_` 환경 변수에 넣지 않습니다.

## 구현 근거와 상태

- 라우팅·검증·응답: `supabase/functions/ranking-api/index.ts`
- 프런트엔드 호출 계약: `src/api/rankingApi.ts`
- 데이터 로직·권한: `supabase/migrations/*.sql`
- 연동 상세: `supabase/FRONTEND_INTEGRATION.md`
- 구현 상태: 코드 경로는 연결되어 있습니다. 실제 Supabase 배포와 운영 호출 성공 여부는 **확인 필요**입니다.
