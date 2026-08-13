import { useCallback, useEffect, useMemo, useState } from 'react';
import { closeView, graniteEvent } from '@apps-in-toss/web-bridge';
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
import { useRankingUser } from './hooks/useRankingUser';
import { calculateExpectedRank } from './api/rankingRules';
import {
  getCachedRanking,
  getCachedRegisteredRankingUser,
  getRanking,
  prefetchRankings,
  type RankingItem,
} from './api/rankingApi';
import { resolveAppEntry } from './utils/appEntry';

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
  completionTimeMs: null,
  windStrength: 0,
  isWaitingForBreath: true,
  balloonScore: 0,
};


export default function App() {
  useSafeArea();

  const [initialEntry] = useState(() => resolveAppEntry(window.location.pathname));

  useEffect(() => {
    prefetchRankings();
  }, []);

  const [screen, setScreen] = useState<AppScreen>(() =>
    initialEntry === 'ranking'
      ? 'ranking'
      : initialEntry === 'home'
        ? 'home'
        : 'mic-permission',
  );
  const [mode, setMode] = useState<GameMode | null>(() =>
    initialEntry === 'lung-test' || initialEntry === 'balloon-rush'
      ? initialEntry
      : null,
  );
  const [permissionBalloonId, setPermissionBalloonId] = useState(
    () => Math.floor(Math.random() * 15) + 1,
  );
  const [countdown, setCountdown] = useState(3);
  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [result, setResult] = useState<GameResult | null>(null);
  const [debugWindOn, setDebugWindOn] = useState(false);
  const [testWindOn, setTestWindOn] = useState(false);
  const [rankingSnapshot, setRankingSnapshot] = useState<RankingItem[]>(() => {
    if (initialEntry === 'lung-test') {
      return getCachedRanking('LUNG_CAPACITY') ?? [];
    }
    if (initialEntry === 'balloon-rush') {
      return getCachedRanking('BALLOON_COUNT') ?? [];
    }
    return [];
  });
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const rankingUser = useRankingUser();
  const effectiveUser =
    rankingUser.user ??
    (rankingUser.anonymousKey
      ? getCachedRegisteredRankingUser(rankingUser.anonymousKey)
      : null);
  const isPlaying = screen === 'game';
  useScreenAwake(isPlaying);

  useEffect(() => {
    if (!mode) return;
    const rankingType = mode === 'lung-test' ? 'LUNG_CAPACITY' : 'BALLOON_COUNT';
    void getRanking(rankingType).then(setRankingSnapshot).catch(() => undefined);
  }, [mode]);

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

  const goHome = useCallback(() => {
    stopDetector();
    setTestWindOn(false);
    setScreen('home');
    setMode(null);
    setResult(null);
    setHud(INITIAL_HUD);
    setIsExitConfirmOpen(false);
  }, [stopDetector]);

  const selectMode = useCallback(
    (nextMode: GameMode) => {
      stopDetector();
      setTestWindOn(false);
      setMode(nextMode);
      setPermissionBalloonId(Math.floor(Math.random() * 15) + 1);
      setResult(null);
      setHud(INITIAL_HUD);
      const rankingType = nextMode === 'lung-test' ? 'LUNG_CAPACITY' : 'BALLOON_COUNT';
      setRankingSnapshot(getCachedRanking(rankingType) ?? []);
      setScreen('mic-permission');
    },
    [stopDetector],
  );

  const openRanking = useCallback(() => {
    stopDetector();
    setScreen('ranking');
  }, [stopDetector]);

  const requestMicrophone = useCallback(() => {
    setScreen('calibrating');
    void requestPermission(() => setScreen('mic-permission'));
  }, [requestPermission]);

  useEffect(() => {
    let removeBackListener: (() => void) | undefined;
    let removeHomeListener: (() => void) | undefined;

    try {
      removeBackListener = graniteEvent.addEventListener('backEvent', {
        onEvent: () => {
          if (screen === 'home') {
            void closeView().catch(() => undefined);
          } else if (screen === 'game') {
            setIsExitConfirmOpen(true);
          } else {
            goHome();
          }
        },
      });
      removeHomeListener = graniteEvent.addEventListener('homeEvent', {
        onEvent: goHome,
      });
    } catch {
      // 일반 브라우저에서는 Apps in Toss 내비게이션 이벤트가 없을 수 있어요.
    }

    return () => {
      removeBackListener?.();
      removeHomeListener?.();
    };
  }, [goHome, screen]);

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
    setResult(null);
    setHud(INITIAL_HUD);
    setPermissionBalloonId((prev) => {
      const candidateIds = Array.from({ length: 15 }, (_, i) => i + 1).filter(
        (id) => id !== prev,
      );
      return candidateIds[Math.floor(Math.random() * candidateIds.length)] ?? 1;
    });
    setScreen('mic-permission');
  }, [stopDetector]);

  const startCountdown = useCallback(() => {
    setCountdown(3);
    setScreen('countdown');
  }, []);

  const expectedRank = useMemo(() => {
    if (!mode || screen !== 'game' || rankingSnapshot.length === 0) return null;
    const score = mode === 'lung-test' ? hud.balloonScore : hud.completedCount;
    if (score <= 0) return null;
    return calculateExpectedRank(
      mode === 'lung-test' ? 'LUNG_CAPACITY' : 'BALLOON_COUNT',
      rankingSnapshot,
      score,
      mode === 'lung-test' ? hud.elapsedMs : hud.completionTimeMs,
    );
  }, [hud.balloonScore, hud.completedCount, hud.completionTimeMs, hud.elapsedMs, mode, rankingSnapshot, screen]);

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
            anonymousKey={rankingUser.anonymousKey}
            isRegistered={rankingUser.user?.isRegistered === true}
            onOpenRanking={openRanking}
          />

          <section className="mode-list" aria-label="기능 선택">
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
              <small>풍선 크기를 키우고, 같은 크기라면 오래 분 기록이 앞서요.</small>
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
              <span className="sr-only">풍선 스피드런 시작하기</span>
            </button>
          </section>
          <p className="privacy-note">마이크 소리는 저장하지 않아요.</p>
        </main>
      )}

      {screen === 'mic-permission' && mode && (
        <main className="screen center-screen mic-permission-screen">
          <p className="eyebrow mode-eyebrow">
            {mode === 'lung-test' ? '풍선 크게 불기' : '풍선 스피드런'}
          </p>
          <div className="permission-art" aria-hidden="true">
            <img
              className="permission-art__balloon"
              src={`/balloons/${mode === 'lung-test' ? 'lung-test' : 'balloon-rush'}/balloon_${String(permissionBalloonId).padStart(2, '0')}.webp`}
              alt=""
            />
          </div>
          {detector.permission === 'idle' ? (
            <>
              <h1 className="mic-permission-title">마이크로 바람을 감지해요</h1>
              <p className="body-copy permission-copy">
                풍선을 불기 위해 마이크를 사용해요.<br />
                소리는 저장하거나 서버로 전송하지 않아요.
              </p>
              <button
                className="button button--primary"
                type="button"
                onClick={requestMicrophone}
              >
                마이크 허용하고 준비하기
              </button>
            </>
          ) : (
            <>
              <div className="mic-test-card">
                <div className="mic-test-header">
                  <span className="mic-test-badge">바람세기 미리 테스트</span>
                  <p className="mic-test-hint">
                    {detector.frame.isBlowing
                      ? '바람 감지 중!'
                      : detector.testModeEnabled
                        ? '아래 버튼을 눌러 테스트해보세요!'
                        : '마이크에 후- 불면 반응해요!'}
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
                      바람 미리 불어보기
                    </button>
                  </div>
                )}
              </div>
              <button
                className="button button--primary"
                type="button"
                onClick={startCountdown}
              >
                {mode === 'lung-test'
                  ? '준비 완료! 크게 불기 시작'
                  : '준비 완료! 스피드런 시작'}
              </button>
            </>
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
                onClick={requestMicrophone}
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
          <strong
            key={countdown}
            data-countdown={countdown > 0 ? countdown : '후—!'}
          >
            {countdown > 0 ? countdown : '후—!'}
          </strong>
          <p>
            {mode === 'lung-test'
              ? '한 번의 호흡을 준비하세요'
              : '30초 동안 최대한 많이 불어보세요!'}
          </p>
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
              onClick={() => setIsExitConfirmOpen(true)}
              aria-label="플레이 종료하고 홈으로"
            >
              <img src="/navigation/cancel.png" alt="" aria-hidden="true" />
            </button>
          </div>
          {expectedRank !== null && (
            <div className="live-rank-impact" key={expectedRank} aria-live="polite">
              <span className="live-rank-impact__label">
                {expectedRank === 1 ? '새로운 왕좌!' : expectedRank <= 10 ? 'TOP 10 진입!' : '실시간 예상 순위'}
              </span>
              <span className="live-rank-impact__rank">
                <strong className="live-rank-impact__value">
                  {expectedRank}<small>위</small>
                </strong>
                <i className="live-rank-impact__arrow" aria-hidden="true">↑</i>
              </span>
            </div>
          )}
          <div className="game-control-panel">
            {mode && (
              <div className="lung-live-stats" aria-live="polite">
                {mode === 'lung-test' ? (
                  <>
                    <div>
                      <span>호흡 시간</span>
                      <strong>{formatSeconds(hud.elapsedMs)}초</strong>
                    </div>
                    <div>
                      <span>현재 점수</span>
                      <strong>{hud.balloonScore.toLocaleString()}점</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span>남은 시간</span>
                      <strong>{Math.ceil(hud.remainingMs / 1000)}초</strong>
                    </div>
                    <div>
                      <span>현재 풍선 수</span>
                      <strong>{hud.completedCount}개</strong>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="game-control-guide">
              <span>{mode === 'lung-test' ? '바람을 불어 풍선을 키워보세요' : '누르고 있는 동안 바람이 불어요'}</span>
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
          anonymousKey={rankingUser.anonymousKey}
          user={effectiveUser}
          onRegistered={rankingUser.setUser}
        />
      )}

      {screen === 'ranking' && (
        <RankingScreen
          anonymousKey={rankingUser.anonymousKey}
          isRegistered={effectiveUser?.isRegistered === true}
          onUserUpdated={rankingUser.setUser}
        />
      )}

      {isExitConfirmOpen && (
        <div className="confirm-dialog-backdrop">
          <section
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exit-dialog-title"
          >
            <h2 id="exit-dialog-title">플레이를 종료할까요?</h2>
            <p>진행 중인 기록은 저장되지 않아요.</p>
            <div className="confirm-dialog__actions">
              <button
                className="button ranking-view-button"
                type="button"
                onClick={() => setIsExitConfirmOpen(false)}
              >
                계속하기
              </button>
              <button className="button button--primary" type="button" onClick={goHome}>
                종료하고 홈으로
              </button>
            </div>
          </section>
        </div>
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
