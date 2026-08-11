# blow-balloon 랭킹 백엔드

Supabase Dashboard만 사용해 설치하는 PostgreSQL + Edge Function 백엔드입니다. 프론트 코드는 포함하지 않습니다.

## 제공 API

단일 `game-api` Edge Function 아래에서 다섯 경로를 제공합니다.

| 메서드 | 경로 | 용도 | 사용자 키 |
| --- | --- | --- | --- |
| `GET` | `/game-api/game-user` | 등록 사용자 확인 | 필요 |
| `POST` | `/game-api/register-nickname` | 최초 별명 등록 | 필요 |
| `POST` | `/game-api/submit-score` | 최고 기록 등록 | 필요 |
| `GET` | `/game-api/ranking?gameType=...&limit=100` | 게임별 랭킹 | 불필요 |
| `GET` | `/game-api/my-records` | 내 두 게임 기록과 순위 | 필요 |

사용자 키는 요청 본문이나 URL이 아니라 `x-game-user-key` 헤더로 전달합니다. API 응답에는 반환하지 않습니다.

## Dashboard 설치 순서

1. Supabase 프로젝트의 **SQL Editor**를 엽니다.
2. [`migrations/001_ranking_backend.sql`](./migrations/001_ranking_backend.sql) 전체를 붙여 넣고 한 번 실행합니다.
3. **Edge Functions**에서 `game-api` Function을 새로 만듭니다.
4. [`functions/game-api/index.ts`](./functions/game-api/index.ts) 전체로 교체합니다.
5. Edge Function 설정에서 **Verify JWT with legacy secret**을 끕니다. 이 앱은 legacy anon JWT나 Supabase Auth JWT를 보내지 않습니다.
6. Dashboard에서 Function을 배포합니다.

`SUPABASE_URL`과 `SUPABASE_SECRET_KEYS`는 Supabase-hosted Edge Function에 기본 제공됩니다. 별도의 Edge Function Secret 등록은 필요하지 않습니다. 코드는 현재 Secret Key의 `default` 값을 우선 사용하고, 기존 프로젝트에서는 `SUPABASE_SERVICE_ROLE_KEY`로 자동 대체합니다. 실제 Secret/Service Role 키를 파일이나 프론트 환경 변수에 복사하지 마세요.

여기까지가 Supabase Dashboard에서 직접 해야 하는 작업의 전부입니다. 배포 후 프론트엔드 담당자에게 프로젝트 URL만 전달합니다.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
```

아래의 입력 정책, 호출 예시, 보안 설명, 검증 체크리스트는 구현 계약과 확인용 참고사항입니다. Dashboard에 추가로 입력하거나 설정하는 항목이 아닙니다.

## 입력 정책

- `gameType`: `BALLOON_COUNT` 또는 `LUNG_CAPACITY`
- `score`: 0 이상의 정수
- `BALLOON_COUNT` 최대값: `10,000`
- `LUNG_CAPACITY` 최대값: `86,400,000`
- 별명: 앞뒤 공백을 제거한 2~12자, `#`와 제어 문자 금지, 중복 허용
- 랭킹 `limit`: 1~100

`LUNG_CAPACITY`의 단위가 아직 확정되지 않았으므로 DB는 정수형 범용 점수로 저장합니다. 프론트 규칙 확정 시 `SCORE_LIMITS`만 실제 단위의 현실적인 상한으로 낮추세요. 의료 단위로 해석하거나 노출하지 않습니다.

## 호출 예시

아래 값을 실제 프로젝트 값으로 바꿉니다.

```bash
export GAME_API_URL='https://PROJECT_REF.supabase.co/functions/v1/game-api'
export GAME_USER_KEY='getUserKeyForGame 결과의 hash 값'
```

사용자 확인:

```bash
curl --fail-with-body \
  -H "x-game-user-key: ${GAME_USER_KEY}" \
  "${GAME_API_URL}/game-user"
```

별명 등록:

```bash
curl --fail-with-body \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "x-game-user-key: ${GAME_USER_KEY}" \
  -d '{"nickname":"연심"}' \
  "${GAME_API_URL}/register-nickname"
```

점수 등록:

```bash
curl --fail-with-body \
  -X POST \
  -H 'Content-Type: application/json' \
  -H "x-game-user-key: ${GAME_USER_KEY}" \
  -d '{"gameType":"BALLOON_COUNT","score":39}' \
  "${GAME_API_URL}/submit-score"
```

랭킹 및 내 기록:

```bash
curl --fail-with-body \
  "${GAME_API_URL}/ranking?gameType=BALLOON_COUNT&limit=100"

curl --fail-with-body \
  -H "x-game-user-key: ${GAME_USER_KEY}" \
  "${GAME_API_URL}/my-records"
```

## 동작과 보안

- `game_users`와 `game_scores`는 RLS를 활성화하고 `anon`, `authenticated`의 직접 권한을 회수했습니다.
- Edge Function만 Service Role로 제한된 DB 함수(RPC)를 실행합니다.
- 최고 기록은 `INSERT ... ON CONFLICT` 한 문장으로 갱신해 동시 요청에도 점수가 감소하지 않습니다.
- `(user_id, game_type)` 유일 제약으로 게임별 최고 기록을 한 행으로 유지합니다.
- 같은 사용자와 게임의 점수 제출은 DB 트랜잭션에서 직렬화하며 3초에 한 번만 허용합니다.
- 동점자는 같은 `rank`를 받으며 다음 순위는 건너뜁니다(`1, 1, 3`). 표시 순서는 `display_id` 오름차순으로 고정합니다.
- 랭킹 응답은 상위 100명으로 제한해 무제한 조회를 막습니다.
- 서비스 키와 `user_key`는 응답에 포함하지 않습니다.
- Apps in Toss WebView와 로컬 개발 환경에서 별도 Origin 설정 없이 호출할 수 있도록 CORS는 모든 Origin에 응답합니다. 이는 API 인증을 의미하지 않습니다.

### 남아 있는 신뢰 경계

`getUserKeyForGame()` 결과를 클라이언트가 그대로 전달하는 요구사항만으로는, 제3자가 다른 사용자의 키를 알아냈을 때 요청을 위조하는 것을 서버가 독립적으로 판별할 수 없습니다. CORS는 브라우저 출처 제한일 뿐 인증 수단이 아닙니다. Toss가 제공하는 서버 검증 토큰 또는 서명 API를 적용할 수 있게 되면 Edge Function에서 이를 검증한 뒤 `user_key`를 신뢰하도록 강화해야 합니다.

또한 게임 결과가 클라이언트에서 계산되므로 현재 구조는 비현실적인 값만 범위로 차단하며 실제 플레이 여부를 증명하지 못합니다. 운영 전 게임별 최대 이론 점수와 요청 빈도 제한을 확정해야 합니다.

## Dashboard 검증 체크리스트

- SQL Editor 실행이 오류 없이 완료되는지 확인
- Table Editor에서 두 테이블의 RLS가 `Enabled`인지 확인
- 등록 전 `/game-user`가 `isRegistered: false`인지 확인
- 별명 등록을 두 번 호출해 최초 별명과 `displayId`가 유지되는지 확인
- 39점 제출 후 32점을 제출해 `bestScore: 39`, `isNewBest: false`인지 확인
- 같은 사용자와 게임으로 3초 안에 다시 제출하면 HTTP `429`와 `RATE_LIMITED`가 반환되는지 확인
- 두 게임 타입의 점수가 서로 영향을 주지 않는지 확인
- 동일 점수 두 사용자에게 같은 순위가 반환되는지 확인
- `/ranking` 응답에 `user_key`가 없는지 확인
- 허용하지 않은 게임 타입, 음수·소수·상한 초과 점수가 거부되는지 확인
