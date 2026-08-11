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
import { WindMeter } from './components/WindMeter';
import { BALLOON_RUSH_DURATION_MS } from './game/rules';

type AppScreen =
  | 'home'
  | 'mic-permission'
  | 'calibrating'
  | 'countdown'
  | 'game'
  | 'result'
  | 'interrupted';

const INITIAL_HUD: GameHudState = {
  elapsedMs: 0,
  remainingMs: BALLOON_RUSH_DURATION_MS,
  completedCount: 0,
  windStrength: 0,
  isWaitingForBreath: true,
};

export default function App() {
  useSafeArea();

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

  const detector = useBlowDetector();
  const {
    stop: stopDetector,
    requestPermission,
    resetBreath,
  } = detector;
  const [screen, setScreen] = useState<AppScreen>('home');
  const [mode, setMode] = useState<GameMode | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [result, setResult] = useState<GameResult | null>(null);
  const [debugWindOn, setDebugWindOn] = useState(false);
  const [testWindOn, setTestWindOn] = useState(false);
  const isPlaying = screen === 'game';
  useScreenAwake(isPlaying);

  const debugEnabled = useMemo(
    () =>
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has('debug'),
    [],
  );

  const goHome = useCallback(() => {
    stopDetector();
    setTestWindOn(false);
    setScreen('home');
    setMode(null);
    setResult(null);
    setHud(INITIAL_HUD);
  }, [stopDetector]);

  const selectMode = (nextMode: GameMode) => {
    stopDetector();
    setTestWindOn(false);
    setMode(nextMode);
    setResult(null);
    setHud(INITIAL_HUD);
    setScreen('mic-permission');
  };

  const startMicrophone = async () => {
    setScreen('calibrating');
    await requestPermission();
  };

  const startTestWind = () => {
    detector.setSimulatedWind(1);
    setTestWindOn(true);
  };

  const stopTestWind = () => {
    detector.setSimulatedWind(0);
    setTestWindOn(false);
  };

  useEffect(() => {
    if (screen !== 'calibrating' || !detector.isCalibrated) return;
    const timeout = window.setTimeout(() => {
      setCountdown(3);
      setScreen('countdown');
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [detector.isCalibrated, screen]);

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
    setResult(null);
    setHud(INITIAL_HUD);
    setScreen('mic-permission');
  }, [stopDetector]);

  return (
    <div className="app-shell">
      {screen === 'home' && (
        <main className="screen home-screen">
          <header className="home-header">
            <div className="brand-mark" aria-hidden="true">
              <span />
            </div>
            <p className="eyebrow">후— 불면 시작!</p>
            <h1>
              오늘은 어떤 풍선을
              <br />
              불어볼까요?
            </h1>
            <p>마이크에 바람을 불어 말랑한 풍선을 키워보세요.</p>
          </header>

          <section className="mode-list" aria-label="게임 모드 선택">
            <button
              type="button"
              className="mode-card mode-card--lung"
              onClick={() => selectMode('lung-test')}
            >
              <img
                className="mode-card__art balloon-art balloon-art--lung"
                src="/balloons/balloon_09.svg"
                alt=""
              />
              <span className="mode-card__number">01</span>
              <strong>폐활량 테스트</strong>
              <small>한 번의 숨으로 풍선을 얼마나 크게 만들 수 있을까요?</small>
              <span className="mode-card__arrow">시작하기 →</span>
            </button>
            <button
              type="button"
              className="mode-card mode-card--rush"
              onClick={() => selectMode('balloon-rush')}
            >
              <img
                className="mode-card__art balloon-art balloon-art--rush"
                src="/balloons/balloon_30.svg"
                alt=""
              />
              <span className="mode-card__number">02</span>
              <strong>풍선 많이 만들기</strong>
              <small>30초 동안 풍선을 최대한 많이 만들어보세요.</small>
              <span className="mode-card__arrow">도전하기 →</span>
            </button>
          </section>
          <p className="privacy-note">소리는 저장하거나 전송하지 않아요.</p>
        </main>
      )}

      {screen === 'mic-permission' && mode && (
        <main className="screen center-screen">
          <button className="back-button" type="button" onClick={goHome}>
            ←
            <span className="sr-only">홈으로</span>
          </button>
          <div className="permission-art" aria-hidden="true">
            <img
              className="permission-art__balloon"
              src="/balloons/balloon_03.svg"
              alt=""
            />
          </div>
          <p className="eyebrow">
            {mode === 'lung-test' ? '폐활량 테스트' : '풍선 많이 만들기'}
          </p>
          <h1>
            {detector.testModeEnabled
              ? '테스트 바람을 준비할게요'
              : '마이크에 바람을 불어주세요'}
          </h1>
          <p className="body-copy">
            {detector.testModeEnabled
              ? '실기기 테스트 모드에서는 화면 버튼으로 바람을 만들어요.'
              : '풍선을 키우기 위해 마이크를 사용해요.'}
            <br />
            {detector.testModeEnabled
              ? '마이크 권한 없이 바로 시작할 수 있어요.'
              : '소리는 저장하거나 서버로 전송하지 않아요.'}
          </p>
          <button
            className="button button--primary"
            type="button"
            onClick={startMicrophone}
          >
            {detector.testModeEnabled ? '테스트 모드로 시작' : '마이크 허용하고 시작'}
          </button>
          <button className="text-button" type="button" onClick={goHome}>
            다음에 할게요
          </button>
        </main>
      )}

      {screen === 'calibrating' && (
        <main className="screen center-screen">
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
              <p className="eyebrow">
                {detector.testModeEnabled ? '테스트 입력 준비 중' : '주변 소음 확인 중'}
              </p>
              <h1>
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
          <strong key={countdown}>{countdown > 0 ? countdown : '후—!'}</strong>
          <WindMeter strength={detector.frame.windStrength} />
        </main>
      )}

      {screen === 'game' && mode && (
        <main className="game-screen">
          <BalloonCanvas
            mode={mode}
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
                <small>{hud.isWaitingForBreath ? '바람을 불어주세요' : '현재 호흡'}</small>
                <strong>{formatSeconds(hud.elapsedMs)}초</strong>
              </div>
            ) : (
              <>
                <div className="game-stat">
                  <small>남은 시간</small>
                  <strong>{Math.ceil(hud.remainingMs / 1000)}</strong>
                </div>
                <div className="game-stat game-stat--right">
                  <small>완성</small>
                  <strong>{hud.completedCount}개</strong>
                </div>
              </>
            )}
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
        <ResultScreen result={result} onRetry={retry} onHome={goHome} />
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
