# 후우풍선 (`blow-balloon`)

마이크에 바람을 불어 풍선을 키우고 기록을 겨루는 Apps in Toss WebView 미니 게임입니다. React는 화면 흐름을, Canvas 2D는 실시간 풍선 렌더링과 물리를, Web Audio API는 마이크 신호 분석을 담당합니다.

> `풍선 크게 불기`는 마이크 입력으로 만드는 재미용 기록입니다. 실제 폐활량이나 의료 지표를 측정하지 않습니다.

## 핵심 기능과 상태

| 기능 | 상태 | 설명 |
| --- | --- | --- |
| 풍선 크게 불기 | 부분 구현 | 첫 유효 호흡 동안 풍선을 키우고 호흡 시간과 풍선 점수를 기록합니다. 감지기의 종료 유예가 엔진 종료 조건에는 연결되지 않았습니다. |
| 풍선 스피드런 | 구현 완료 | 30초 동안 완성한 풍선 수를 겨루며, 중간에 호흡을 멈춰도 현재 풍선 크기를 유지합니다. |
| 마이크 입력 분석 | 부분 구현 | 850ms 주변 소음 표본, RMS 보정, 평활화, 시작·종료 히스테리시스를 사용합니다. 현재 보정 완료를 시작 버튼이 강제하지는 않습니다. |
| 풍선 렌더링과 물리 | 구현 완료 | 모드별 15종 WebP 풍선, 표정 오버레이, 부력·충돌·압축·상단 패킹을 Canvas에서 처리합니다. |
| 랭킹과 나의 기록 | 구현 완료 | Supabase Edge Function을 통해 최고 기록, 순위, 별명과 4자리 표시 ID를 관리합니다. 백엔드가 없어도 게임은 플레이할 수 있습니다. |
| 결과 이미지 | 부분 구현 | 오프스크린 Canvas 생성기는 있으나 현재 결과 화면에서 호출되지 않습니다. |
| 모바일 수명주기 | 구현 완료 | Safe Area, 플레이 중 화면 켜짐, 백그라운드 일시정지/중단, 마이크·애니메이션 정리를 처리합니다. |

구현 상태의 상세 근거와 예외 흐름은 [기능 명세](docs/functional-specification.md)를 참고하세요.

## 기술 스택

- React 19.2, TypeScript 5.9, Vite 7
- Apps in Toss Web Framework/Web Bridge 2.10.8
- Canvas 2D, Web Audio API, MediaDevices API
- Supabase Postgres, Supabase Edge Functions
- Vitest 4, ESLint 9

## 빠른 시작

요구 환경은 Node.js `^20.19.0` 또는 `>=22.12.0`, pnpm `11.16.0`입니다. Node.js 범위는 현재 Vite 패키지의 엔진 조건을 따릅니다.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm dev`는 활성 Wi-Fi 또는 Ethernet의 IPv4 주소와 `5173` 포트에서 Apps in Toss 개발 서버를 시작합니다. 네트워크가 바뀌면 서버를 다시 시작하세요.

### 환경 변수

`.env.local`에 공개 가능한 프런트엔드 설정만 넣습니다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_BLOW_BALLOON_TEST_MODE=false
```

| 변수 | 필수 여부 | 용도 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 랭킹 기능에 필요 | `game-api` Edge Function 기본 주소를 구성합니다. |
| `VITE_BLOW_BALLOON_TEST_MODE` | 선택 | `true`이면 마이크 대신 화면의 `바람 불기` 버튼을 사용합니다. |

실제 관리자 키는 프런트엔드 환경 변수에 넣지 않습니다. Supabase 설정과 마이그레이션 순서는 [Supabase 안내](supabase/README.md)를 따르세요.

### 실제 마이크 테스트

`getUserMedia()`는 보안 컨텍스트가 필요합니다. Apps in Toss 샌드박스를 사용하거나 로컬 서버를 HTTPS 터널로 노출하세요.

```bash
# 터미널 1
pnpm dev

# 터미널 2
cloudflared tunnel --url http://localhost:5173
```

샌드박스에서 마이크를 사용할 수 없는 경우에만 `VITE_BLOW_BALLOON_TEST_MODE=true`로 설정합니다. 환경 변수를 바꾼 뒤 개발 서버를 다시 시작하세요.

## 명령어

```bash
pnpm dev        # Apps in Toss 개발 서버
pnpm typecheck  # TypeScript 프로젝트 검사
pnpm test       # Vitest 단위 테스트
pnpm lint       # ESLint 검사
pnpm build:web  # TypeScript 검사 후 Vite 웹 빌드
pnpm build      # Apps in Toss 산출물 빌드
pnpm deploy     # Apps in Toss 배포(외부 상태 변경)
```

`pnpm deploy`는 실제 배포 작업이므로 대상 환경과 권한을 확인한 뒤 실행하세요.

## 구조

```text
src/
├── audio/       마이크 입력, RMS 계산, 바람 상태 머신
├── api/         랭킹 Edge Function 클라이언트와 캐시
├── components/  홈 보조 UI, 결과, 랭킹, 바람 계기
├── game/        Canvas 엔진, 풍선 렌더링, 규칙과 물리
├── hooks/       마이크, Toss 사용자, Safe Area, 화면 켜짐
├── result/      결과 이미지 생성기
└── sdk/         Apps in Toss v2 호환 어댑터
supabase/
├── functions/   game-api Edge Function
├── migrations/  랭킹 데이터베이스 순차 마이그레이션
└── seeds/       검수용 랭킹 데이터 추가·제거 SQL
```

## 문서

- [기능 명세](docs/functional-specification.md): 사용자 기능, 정상·예외 흐름, 구현 상태
- [정보구조](docs/information-architecture.md): 화면 상태, 접근 조건, 사용자 여정
- [아키텍처](docs/architecture.md): 런타임 경계, 데이터 흐름, 배포 구조와 제약
- [API 명세](docs/api-specification.md): Edge Function HTTP 계약과 오류
- [ERD](docs/erd.md): Postgres 테이블, 관계, 제약과 접근 정책
- [Supabase 운영 안내](supabase/README.md): Dashboard 적용·배포·검증 절차
- [프런트엔드 연동 참고](supabase/FRONTEND_INTEGRATION.md): 랭킹 연동의 상세 계약

## 확인이 필요한 범위

- 실제 iPhone·Android의 마이크 감도, 권한, Safe Area와 WebView 동작은 기기 테스트가 필요합니다.
- Supabase 마이그레이션과 Edge Function이 특정 운영 프로젝트에 적용·배포되었는지는 저장소만으로 확인할 수 없습니다.
- 저장소 루트에 라이선스 파일이 없으므로 재사용·배포 권한은 별도로 확정해야 합니다.
