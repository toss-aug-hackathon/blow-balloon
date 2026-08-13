# 정보구조

[README로 돌아가기](../README.md) · [기능 명세](functional-specification.md)

이 앱은 URL 라우터 없이 `AppScreen` 상태로 화면을 전환하는 단일 페이지 WebView입니다.

## 사용자 유형과 접근

| 사용자 유형 | 플레이 | 공개 랭킹 | 기록 제출 | 나의 기록 | 별명 변경 |
| --- | --- | --- | --- | --- | --- |
| 사용자 키 없음 | 가능 | 가능 | 불가 | 불가 | 불가 |
| Toss 키가 있는 미등록 사용자 | 가능 | 가능 | 별명 등록 후 가능 | 등록 전 불가 | 등록 후 가능 |
| 등록 사용자 | 가능 | 가능 | 결과 진입 시 자동 | 가능 | 가능 |

화면 노출 조건은 클라이언트 UI 조건이며, 서버 접근 통제는 `x-anonymous-user-key`, Edge Function 검증과 Service Role 전용 RPC가 담당합니다.

## 화면 구조

| 화면 식별자 | 목적 | 진입 조건 | 주요 행동 | 다음 화면 | 상태 |
| --- | --- | --- | --- | --- | --- |
| `home` | 모드 선택과 기록 미리보기 | 앱 시작 또는 홈 이동 | 두 모드 선택, 기록장 열기 | `mic-permission`, `ranking` | 구현 완료 |
| `mic-permission` | 마이크 사용 설명과 바람 미리보기 | 모드 선택 또는 직접 진입 | 명시적 권한 요청, 카운트다운 시작, 홈 | `calibrating`, `countdown`, `home` | 구현 완료 |
| `calibrating` | 주변 소음 보정 안내 | 권한 요청 버튼 | 완료 시 자동 이동, 재시도, 홈 | `mic-permission`, `home` | 구현 완료 |
| `countdown` | 3·2·1 시작 안내 | 권한 화면의 시작 버튼 | 자동 카운트다운 | `game` | 구현 완료 |
| `game` | Canvas 게임과 HUD | 카운트다운 종료 | 불기, 나가기 | `result`, `interrupted`, `home` | 구현 완료 |
| `interrupted` | 크게 불기 백그라운드 중단 안내 | 시작된 호흡 중 문서 숨김 | 다시 도전, 홈 | `mic-permission`, `home` | 구현 완료 |
| `result` | 기록·랭킹 저장 결과 | 게임 완료 | 등록/저장, 기록장, 재도전, 홈 | `ranking`, `mic-permission`, `home` | 구현 완료 |
| `ranking` | 공개 랭킹과 나의 기록 | 홈·결과·딥링크에서 열기 | 모드 탭, 나의 기록, 별명 변경 | `home` | 구현 완료 |

`/lung-test`, `/balloon-rush`, `/ranking` 딥링크의 마지막 경로 조각을 읽어 해당 화면으로 진입하며, 잘못된 경로는 홈으로 폴백합니다.

## 화면 전이

```mermaid
flowchart TD
  Home["home<br/>모드 선택"]
  Permission["mic-permission<br/>권한·입력 미리보기"]
  Calibration["calibrating<br/>주변 소음 보정"]
  Countdown["countdown<br/>3·2·1"]
  Game["game<br/>Canvas 플레이"]
  Interrupted["interrupted<br/>한 호흡 중단"]
  Result["result<br/>기록·랭킹 저장"]
  Ranking["ranking<br/>공개/나의 기록"]

  Home -->|모드 선택| Permission
  Home -->|기록장| Ranking
  Permission -->|마이크 허용| Calibration
  Calibration -->|보정 완료| Permission
  Permission -->|플레이 시작| Countdown
  Permission -->|뒤로| Home
  Countdown -->|자동| Game
  Game -->|완료| Result
  Game -->|크게 불기 중 백그라운드| Interrupted
  Game -->|나가기| Home
  Interrupted -->|다시 도전| Permission
  Interrupted -->|홈| Home
  Result -->|다시 도전| Permission
  Result -->|기록장| Ranking
  Result -->|홈| Home
  Ranking -->|뒤로| Home
```

근거는 `src/App.tsx`와 `src/utils/appEntry.ts`입니다.

## 주요 사용자 여정

### 게임 플레이

```mermaid
flowchart LR
  Select["모드 선택"] --> Explain["마이크 사용 설명"]
  Explain --> Mic["사용자 버튼으로 권한 요청·보정"]
  Mic --> Ready["바람 인식 확인"]
  Ready --> Count["카운트다운"]
  Count --> Play["바람으로 플레이"]
  Play --> Result["결과 확인"]
  Result --> Retry["재도전"]
  Result --> Home["홈"]
```

마이크 권한은 앱 시작이나 모드 선택만으로 요청하지 않습니다. 사용자가 권한 화면의 `마이크 허용하고 준비하기` 버튼을 눌러야 요청하며, 보정이 끝난 뒤에만 시작 버튼을 제공합니다.

### 첫 랭킹 등록

```mermaid
flowchart LR
  Result["결과"] --> Choice{"등록 선택"}
  Choice -->|등록 안 함| Local["로컬 결과만 확인"]
  Choice -->|등록| Nickname["별명 입력"]
  Nickname --> Register["사용자 등록"]
  Register --> Submit["현재 기록 제출"]
  Submit --> Saved["최고 기록 표시"]
```

### 기록장

`ranking` 화면 안에서 URL 변경 없이 다음 탭을 전환합니다.

- `크게 불기`: 공개 `LUNG_CAPACITY` 순위
- `스피드런`: 공개 `BALLOON_COUNT` 순위
- `나의 기록`: 등록 사용자의 두 최고 기록과 별명 변경

공개 랭킹은 사용자 키 없이 접근하며, 나의 기록과 별명 변경은 등록된 사용자 키가 있어야 합니다.

## 조건부 UI

- 결과 이미지 생성 버튼과 미리보기는 없습니다. 생성 모듈만 존재합니다.
- 개발 환경 `?debug`에서만 진단 오버레이가 나타납니다.
- `VITE_BLOW_BALLOON_TEST_MODE=true`이면 권한 화면과 게임 화면에 버튼식 바람 입력이 추가됩니다.
