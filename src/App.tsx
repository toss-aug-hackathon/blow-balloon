import { useCallback, useEffect, useMemo, useState } from 'react';
import { BalloonCanvas } from './game/BalloonCanvas';
import type {
  GameHudState,
  GameMode,
  GameResult,
} from './game/types';
import { useBlowDetector } from './hooks/useBlowDetector';
import { useSafeArea } from './hooks/useSafeArea';
import { useScreenAwake } from './hooks/useScreenAwake';
import { formatSeconds } from './utils/math';
import { ResultScreen } from './components/ResultScreen';
import { RankingScreen } from './components/RankingScreen';
import { HomeRecordPreview } from './components/HomeRecordPreview';
import { WindMeter } from './components/WindMeter';
import { BALLOON_RUSH_DURATION_MS } from './game/rules';
import { useGameUser } from './hooks/useGameUser';
import {
  getCachedRegisteredGameUser,
  prefetchRankings,
} from './api/gameApi';

type AppScreen =
  | 'home'
  | 'mic-permission'
  | 'calibrating'
  | 'countdown'
  | 'game'
  | 'result'
  | 'ranking'
  | 'interrupted';

const INITIAL_HUD: GameHudState = {
  elapsedMs: 0,
  remainingMs: BALLOON_RUSH_DURATION_MS,
  completedCount: 0,
  windStrength: 0,
  isWaitingForBreath: true,
};

const MIC_NOTICE_SESSION_KEY = 'blow-balloon:mic-notice-shown';
const MIC_START_BUTTON_SESSION_KEY = 'blow-balloon:mic-start-button-used';

function readMicNoticeState(): boolean {
  try {
    return window.sessionStorage.getItem(MIC_NOTICE_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function readMicStartButtonState(): boolean {
  if (import.meta.env.DEV) return false;
  try {
    return window.sessionStorage.getItem(MIC_START_BUTTON_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  useSafeArea();

  useEffect(() => {
    prefetchRankings();
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let isEdgeGesture = false;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      isEdgeGesture =
        startX <= 28 || startX >= window.innerWidth - 28;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isEdgeGesture) return;
      const touch = event.touches[0];
      if (!touch) return;
      const deltaX = Math.abs(touch.clientX - startX);
      const deltaY = Math.abs(touch.clientY - startY);

      if (deltaX > 8 && deltaX > deltaY) {
        event.preventDefault();
      }
    };

    const resetEdgeGesture = () => {
      isEdgeGesture = false;
    };

    document.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    document.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    document.addEventListener('touchend', resetEdgeGesture, {
      passive: true,
    });
    document.addEventListener('touchcancel', resetEdgeGesture, {
      passive: true,
    });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', resetEdgeGesture);
      document.removeEventListener('touchcancel', resetEdgeGesture);
    };
  }, []);

  const [screen, setScreen] = useState<AppScreen>('home');
  const [mode, setMode] = useState<GameMode | null>(null);
  const [permissionBalloonId, setPermissionBalloonId] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [result, setResult] = useState<GameResult | null>(null);
  const [hasShownMicNotice, setHasShownMicNotice] = useState(readMicNoticeState);
  const [showMicNotice, setShowMicNotice] = useState(false);
  const [debugWindOn, setDebugWindOn] = useState(false);
  const [testWindOn, setTestWindOn] = useState(false);
  const gameUser = useGameUser();
  const effectiveUser =
    gameUser.user ??
    (gameUser.userKey
      ? getCachedRegisteredGameUser(gameUser.userKey)
      : null);
  const isPlaying = screen === 'game';
  useScreenAwake(isPlaying);

  const debugEnabled = useMemo(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has('debug'),
    [],
  );
  const detector = useBlowDetector(screen !== 'game' || debugEnabled);
  const {
    stop: stopDetector,
    requestPermission,
    resetBreath,
  } = detector;
  const [hasUsedMicStartButton, setHasUsedMicStartButton] = useState(
    () => (detector.testModeEnabled ? false : readMicStartButtonState()),
  );

  const goHome = useCallback(() => {
    stopDetector();
    setTestWindOn(false);
    setScreen('home');
    setMode(null);
    setResult(null);
    setHud(INITIAL_HUD);
    if (detector.testModeEnabled) {
      setHasUsedMicStartButton(false);
    }
  }, [detector.testModeEnabled, stopDetector]);

  const selectMode = (nextMode: GameMode) => {
    stopDetector();
    setTestWindOn(false);
    setMode(nextMode);
    if (detector.testModeEnabled) {
      setHasUsedMicStartButton(false);
    }
    const shouldShowNotice = !hasShownMicNotice;
    setShowMicNotice(shouldShowNotice);
    if (shouldShowNotice) {
      setHasShownMicNotice(true);
      try {
        window.sessionStorage.setItem(MIC_NOTICE_SESSION_KEY, '1');
      } catch {
        // In-memory state still covers WebViews without session storage.
      }
    }
    setPermissionBalloonId(Math.floor(Math.random() * 16) + 1);
    setResult(null);
    setHud(INITIAL_HUD);
    setScreen('mic-permission');
  };

  const openRanking = () => {
    stopDetector();
    setScreen('ranking');
  };

  const startMicrophone = useCallback(async () => {
    setHasUsedMicStartButton(true);
    try {
      window.sessionStorage.setItem(MIC_START_BUTTON_SESSION_KEY, '1');
    } catch {
      // In-memory state still covers WebViews without session storage.
    }
    await requestPermission();
  }, [requestPermission]);

  useEffect(() => {
    if (
      screen !== 'mic-permission' ||
      !mode ||
      !detector.testModeEnabled ||
      detector.permission !== 'idle'
    ) {
      return;
    }

    // 테스트 모드도 실제 마이크 모드와 동일하게 입력 루프를 먼저
    // 시작해야 버튼으로 바꾼 시뮬레이션 신호가 detector에 전달된다.
    void requestPermission();
  }, [
    detector.permission,
    detector.testModeEnabled,
    mode,
    requestPermission,
    screen,
  ]);

  useEffect(() => {
    if (screen !== 'mic-permission' || !mode) return;
    if (!detector.testModeEnabled && hasUsedMicStartButton) {
      const timeout = window.setTimeout(() => {
        void startMicrophone();
      }, 0);
      return () => window.clearTimeout(timeout);
    }
  }, [detector.testModeEnabled, hasUsedMicStartButton, mode, screen, startMicrophone]);

  const startTestWind = useCallback((event?: React.SyntheticEvent) => {
    if (event && event.cancelable) event.preventDefault();
    detector.setSimulatedWind(1);
    setTestWindOn(true);
  }, [detector]);

  const stopTestWind = useCallback((event?: React.SyntheticEvent) => {
    if (event && event.cancelable) event.preventDefault();
    detector.setSimulatedWind(0);
    setTestWindOn(false);
  }, [detector]);

  useEffect(() => {
    if (screen !== 'countdown') return;
    if (countdown <= 0) {
      const timeout = window.setTimeout(() => {
        resetBreath();
        setHud(INITIAL_HUD);
        setScreen('game');
      }, 450);
      return () => window.clearTimeout(timeout);
    }
    const timeout = window.setTimeout(
      () => setCountdown((value) => value - 1),
      900,
    );
    return () => window.clearTimeout(timeout);
  }, [countdown, resetBreath, screen]);

  const finishGame = useCallback(
    (nextResult: GameResult) => {
      stopDetector();
      setTestWindOn(false);
      setResult(nextResult);
      setScreen('result');
    },
    [stopDetector],
  );

  const interruptLungTest = useCallback(() => {
    stopDetector();
    setTestWindOn(false);
    setScreen('interrupted');
  }, [stopDetector]);

  const retry = useCallback(() => {
    stopDetector();
    setTestWindOn(false);
    setShowMicNotice(false);
    if (detector.testModeEnabled) {
      setHasUsedMicStartButton(false);
    }
    setResult(null);
    setHud(INITIAL_HUD);
    setPermissionBalloonId((prev) => {
      const candidateIds = Array.from({ length: 16 }, (_, i) => i + 1).filter(
        (id) => id !== prev,
      );
      return candidateIds[Math.floor(Math.random() * candidateIds.length)] ?? 1;
    });
    setScreen('mic-permission');
  }, [detector.testModeEnabled, stopDetector]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    setScreen('countdown');
  }, []);

  return (
    <div className="app-shell">
      {screen === 'home' && (
        <main className="screen home-screen">
          <header className="home-header">
            <h1>
              오늘은 어떤 풍선을
              <br />
              불어볼까요?
            </h1>
            <p>바람을 불어 나만의 기록을 만들어보세요.</p>
          </header>

          <HomeRecordPreview
            userKey={gameUser.userKey}
            isRegistered={gameUser.user?.isRegistered === true}
            onOpenRanking={openRanking}
          />

          <section className="mode-list" aria-label="게임 모드 선택">
            <button
              type="button"
              className="mode-card mode-card--lung"
              onClick={() => selectMode('lung-test')}
            >
              <img
                className="mode-card__art balloon-art balloon-art--lung balloon-art--open"
                src="/selection/heart-balloon.webp"
                alt=""
              />
              <img
                className="mode-card__art balloon-art balloon-art--lung balloon-art--blink"
                src="/selection/heart-balloon-blink.webp"
                alt=""
              />
              <strong>풍선 크게 불기</strong>
              <small>풍선 크기를 키우고, 같은 크기라면 더 빠르게 기록해요.</small>
              <span className="mode-card__arrow" aria-hidden="true">→</span>
              <span className="sr-only">풍선 크게 불기 시작하기</span>
            </button>
            <button
              type="button"
              className="mode-card mode-card--rush"
              onClick={() => selectMode('balloon-rush')}
            >
              <img
                className="mode-card__art balloon-art balloon-art--bunch"
                src="/selection/balloon-bunch.webp"
                alt=""
              />
              <strong>풍선 스피드런</strong>
              <small>30초 동안 최대한 많이 만들고 마지막 풍선까지의 시간을 겨뤄요.</small>
              <span className="mode-card__arrow" aria-hidden="true">→</span>
              <span className="sr-only">풍선 스피드런 시작하기</span>
            </button>
          </section>
          <p className="privacy-note">마이크 소리는 저장하지 않아요.</p>
        </main>
      )}

      {screen === 'mic-permission' && mode && (
        <main className="screen center-screen mic-permission-screen">
          <button className="back-button" type="button" onClick={goHome}>
            ←
            <span className="sr-only">홈으로</span>
          </button>
          <div className="permission-art" aria-hidden="true">
            <img
              className="permission-art__balloon"
              src={`/balloons/${mode === 'lung-test' ? 'lung-test' : 'balloon-rush'}/balloon_${String(permissionBalloonId).padStart(2, '0')}.webp`}
              alt=""
            />
          </div>
          <p className="eyebrow mode-eyebrow">
            {mode === 'lung-test' ? '풍선 크게 불기' : '풍선 스피드런'}
          </p>
          <h1>
            {detector.permission === 'granted'
              ? '바람을 잘 들을 수 있어요!'
              : detector.testModeEnabled
                ? '테스트 바람을 준비했어요'
                : '마이크에 바람을 불어주세요'}
          </h1>
          {showMicNotice && detector.permission !== 'granted' && (
            <p className="body-copy">
              {detector.testModeEnabled
                ? '화면의 바람 불기 버튼으로 마이크 입력 없이 테스트할 수 있어요.'
                : '풍선을 키우기 위해 마이크를 사용해요.'}
              <br />
              {detector.testModeEnabled
                ? '마이크 권한 없이 바로 시작할 수 있어요.'
                : '소리는 저장하거나 서버로 전송하지 않아요.'}
            </p>
          )}

          {/* 바람세기 미리 테스트 영역 */}
          <div className="mic-test-card">
            <div className="mic-test-header">
              <span className="mic-test-badge">바람세기 미리 테스트</span>
              <p className="mic-test-hint">
                {detector.permission === 'granted'
                  ? detector.frame.isBlowing
                    ? '바람 감지 중! 💨'
                    : '마이크에 후- 불면 반응해요!'
                  : detector.testModeEnabled
                    ? '아래 버튼을 눌러 테스트해보세요!'
                    : '마이크 허용 후 후- 불어서 테스트해보세요.'}
              </p>
            </div>
            <WindMeter strength={detector.frame.windStrength} />
            {detector.testModeEnabled && (
              <div className="test-wind-control">
                <button
                  className={`test-wind-button${testWindOn ? ' is-active' : ''}`}
                  type="button"
                  onPointerDown={startTestWind}
                  onPointerUp={stopTestWind}
                  onPointerCancel={stopTestWind}
                  onPointerLeave={stopTestWind}
                >
                  <i aria-hidden="true">〰</i>
                  바람 미리 불어보기
                </button>
              </div>
            )}
          </div>

          {detector.permission !== 'granted' && !detector.testModeEnabled ? (
            <button
              className="button button--primary"
              type="button"
              onClick={startMicrophone}
            >
              마이크 허용하고 시작
            </button>
          ) : (
            <button
              className="button button--primary"
              type="button"
              onClick={startCountdown}
            >
              {mode === 'lung-test' ? '준비 완료! 크게 불기 시작' : '준비 완료! 스피드런 시작'}
            </button>
          )}
        </main>
      )}

      {screen === 'calibrating' && (
        <main className="screen center-screen calibration-screen">
          {detector.permission === 'denied' ||
          detector.permission === 'error' ? (
            <>
              <div className="status-icon status-icon--error">!</div>
              <p className="eyebrow">마이크를 확인해 주세요</p>
              <h1>바람 소리를 들을 수 없어요</h1>
              <p className="body-copy error-text">
                {detector.errorMessage}
              </p>
              <button
                className="button button--primary"
                type="button"
                onClick={startMicrophone}
              >
                다시 시도
              </button>
              <button className="text-button" type="button" onClick={goHome}>
                홈으로
              </button>
            </>
          ) : (
            <>
              <div className="calibration-rings" aria-hidden="true">
                <i />
                <i />
                <i />
                <span>쉿</span>
              </div>
              <p className="eyebrow calibration-eyebrow">
                {detector.testModeEnabled ? '테스트 입력 준비 중' : '주변 소음 확인 중'}
              </p>
              <h1 className="calibration-title">
                {detector.testModeEnabled
                  ? '바람 버튼을 준비하고 있어요'
                  : '잠시만 조용히 있어주세요'}
              </h1>
              <p className="body-copy">
                {detector.testModeEnabled
                  ? '곧 화면의 바람 불기 버튼으로 풍선을 키울 수 있어요.'
                  : '휴대폰마다 다른 마이크 감도를 맞추고 있어요.'}
              </p>
              <div className="loading-dots" aria-label="보정 중">
                <i />
                <i />
                <i />
              </div>
            </>
          )}
        </main>
      )}

      {screen === 'countdown' && (
        <main className="screen countdown-screen">
          <p>{mode === 'lung-test' ? '한 번의 호흡을 준비하세요' : '30초 준비!'}</p>
          <strong
            key={countdown}
            data-countdown={countdown > 0 ? countdown : '후—!'}
          >
            {countdown > 0 ? countdown : '후—!'}
          </strong>
          <WindMeter strength={detector.frame.windStrength} />
        </main>
      )}

      {screen === 'game' && mode && (
        <main className="game-screen">
          <BalloonCanvas
            mode={mode}
            initialBalloonId={permissionBalloonId}
            signalRef={detector.signalRef}
            onHudChange={setHud}
            onFinish={finishGame}
            onInterrupted={interruptLungTest}
          />
          <div className="game-hud">
            <button
              className="game-exit"
              type="button"
              onClick={goHome}
              aria-label="게임 나가기"
            >
              ×
            </button>
            {mode === 'lung-test' ? (
              <div className="game-stat game-stat--center">
                <span className="game-stat__icon game-stat__icon--timer" aria-hidden="true" />
                <small>{hud.isWaitingForBreath ? '바람을 불어주세요' : '현재 호흡'}</small>
                <strong>{formatSeconds(hud.elapsedMs)}초</strong>
              </div>
            ) : (
              <>
                <div className="game-stat game-stat--timer">
                  <span className="game-stat__icon game-stat__icon--timer" aria-hidden="true" />
                  <small>남은 시간</small>
                  <strong>{Math.ceil(hud.remainingMs / 1000)}<em>초</em></strong>
                </div>
                <div className="game-stat game-stat--right">
                  <span className="game-stat__icon game-stat__icon--balloon" aria-hidden="true" />
                  <small>완성</small>
                  <strong>{hud.completedCount}<em>개</em></strong>
                </div>
              </>
            )}
          </div>
          <div className="game-control-panel">
          <p className="game-control-guide">
            <span aria-hidden="true">〰</span>
            <span>누르고 있는 동안 <strong>바람</strong>이 불어요</span>
          </p>
          <div className="game-wind-meter">
            <WindMeter strength={hud.windStrength} />
          </div>
          {detector.testModeEnabled && (
            <div className="test-wind-control">
              <span>누르고 있는 동안 바람이 불어요</span>
              <button
                className={`test-wind-button${testWindOn ? ' is-active' : ''}`}
                type="button"
                onPointerDown={startTestWind}
                onPointerUp={stopTestWind}
                onPointerCancel={stopTestWind}
                onPointerLeave={stopTestWind}
              >
                <i aria-hidden="true">〰</i>
                바람 불기
              </button>
            </div>
          )}
          </div>
        </main>
      )}

      {screen === 'interrupted' && (
        <main className="screen center-screen">
          <div className="status-icon">↻</div>
          <p className="eyebrow">도전이 잠시 멈췄어요</p>
          <h1>한 호흡 테스트를 다시 시작할까요?</h1>
          <p className="body-copy">
            앱이 백그라운드로 이동해 마이크 처리를 안전하게 종료했어요.
          </p>
          <button
            className="button button--primary"
            type="button"
            onClick={retry}
          >
            다시 도전
          </button>
          <button className="text-button" type="button" onClick={goHome}>
            홈으로
          </button>
        </main>
      )}

      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          onRetry={retry}
          onHome={goHome}
          onOpenRanking={openRanking}
          userKey={gameUser.userKey}
          user={effectiveUser}
          onRegistered={gameUser.setUser}
        />
      )}

      {screen === 'ranking' && (
        <RankingScreen
          userKey={gameUser.userKey}
          isRegistered={effectiveUser?.isRegistered === true}
          onHome={goHome}
          onUserUpdated={gameUser.setUser}
        />
      )}

      {debugEnabled && screen !== 'home' && (
        <aside className="debug-overlay">
          <b>mic debug</b>
          <span>rms {detector.frame.rawRms.toFixed(4)}</span>
          <span>base {detector.frame.baselineRms.toFixed(4)}</span>
          <span>wind {detector.frame.windStrength.toFixed(2)}</span>
          <span>state {detector.frame.state}</span>
          <span>
            breath {Math.round(detector.frame.currentBreathDurationMs)}ms
          </span>
          {detector.simulationEnabled && (
            <label>
              simulated wind
              <input
                aria-label="개발용 바람 세기"
                type="range"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0"
                onChange={(event) =>
                  detector.setSimulatedWind(Number(event.target.value))
                }
              />
              <button
                type="button"
                onClick={() => {
                  const nextValue = !debugWindOn;
                  setDebugWindOn(nextValue);
                  detector.setSimulatedWind(nextValue ? 1 : 0);
                }}
              >
                {debugWindOn ? '개발용 바람 끄기' : '개발용 바람 켜기'}
              </button>
            </label>
          )}
        </aside>
      )}
    </div>
  );
}
