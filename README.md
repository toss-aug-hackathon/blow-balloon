# 후우풍선

마이크에 바람을 불어 풍선을 키우는 Apps in Toss WebView 미니 앱입니다.

## 주요 기능

- `폐활량 테스트`: 한 번의 호흡으로 풍선을 키우고 지속 시간과 재미용 기록을 확인합니다.
- `풍선 많이 만들기`: 30초 동안 완성한 풍선 개수를 기록합니다.
- 35종 PNG 풍선을 무작위로 사용하며 연속으로 같은 풍선이 나오지 않습니다.
- 결과 화면을 이미지로 만들 수 있습니다.
- 마이크를 사용할 수 없는 샌드박스를 위한 버튼식 테스트 모드를 제공합니다.

> 폐활량 테스트는 마이크 입력을 이용한 게임이며 의료 목적의 폐활량 측정 기능이 아닙니다.

## 기술 스택

- React 19, TypeScript, Vite
- Apps in Toss Web Framework
- Canvas 2D, Web Audio API
- Vitest, ESLint

## 시작하기

프로젝트의 패키지 매니저는 pnpm입니다.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

개발 서버는 실행 시 활성 Wi-Fi 또는 Ethernet의 IPv4 주소를 자동으로 선택합니다. 네트워크를 변경했다면 개발 서버를 다시 시작하세요. 실제 마이크 입력을 사용하려면 브라우저 또는 Apps in Toss 샌드박스에서 마이크 권한을 허용해야 합니다.

## 환경 변수

`.env.local`에서 다음 값을 설정합니다.

```dotenv
VITE_BLOW_BALLOON_TEST_MODE=false
```

- `false`: 실제 마이크 입력을 사용합니다.
- `true`: 마이크 권한을 요청하지 않고 게임 화면의 `바람 불기` 버튼으로 입력을 테스트합니다.

환경 변수를 변경한 뒤에는 개발 서버를 다시 시작해야 합니다. `.env.local`은 Git에 포함되지 않습니다.

## 명령어

```bash
pnpm dev        # 개발 서버
pnpm typecheck  # TypeScript 검사
pnpm test       # 단위 테스트
pnpm lint       # ESLint 검사
pnpm build      # Apps in Toss 빌드
pnpm build:web  # 웹 빌드만 실행
```

## 주요 경로

```text
public/balloons/  16종 풍선 WebP 에셋
src/audio/        마이크 입력과 바람 감지
src/game/         Canvas 렌더링과 풍선 물리
src/result/       결과 이미지 생성
```
