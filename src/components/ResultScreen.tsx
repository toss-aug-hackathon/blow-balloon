import { useCallback, useEffect, useRef, useState } from 'react';
import {
  registerNickname,
  syncRankingAfterScore,
  type RankingUser,
  type RegisteredRankingUser,
  type SubmitScoreResponse,
} from '../api/rankingApi';
import {
  saveRankingScoreReliably,
  subscribeRankingSync,
} from '../api/rankingOutbox';
import type { GameResult } from '../game/types';
import { getLungScoreTitle } from '../game/rules';
import { formatSeconds } from '../utils/math';
import {
  getNicknameValidationError,
  NICKNAME_MAX_LENGTH,
} from '../utils/nicknamePolicy';

type ResultScreenProps = {
  result: GameResult;
  onRetry: () => void;
  onHome: () => void;
  onOpenRanking: () => void;
  anonymousKey: string | null;
  user: RankingUser | null;
  onRegistered: (user: RegisteredRankingUser) => void;
};

export function ResultScreen({
  result,
  onRetry,
  onHome,
  onOpenRanking,
  anonymousKey,
  user,
  onRegistered,
}: ResultScreenProps) {
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmitScoreResponse | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'queued' | 'failed'>('idle');
  const submittedResultRef = useRef<string | null>(null);
  const pendingSubmissionIdRef = useRef<string | null>(null);
  const pendingDisplayNameRef = useRef<string | null>(null);

  const rankingType = result.mode === 'lung-test' ? 'LUNG_CAPACITY' : 'BALLOON_COUNT';
  const score =
    result.mode === 'lung-test'
      ? Math.round(result.finalBalloonScale * 100)
      : Math.round(result.completedCount);
  const rawDurationMs =
    result.mode === 'lung-test'
      ? result.durationMs
      : result.completionTimeMs;
  const durationMs = rawDurationMs == null
    ? null
    : Math.max(0, Math.round(rawDurationMs));
  const resultKey = `${rankingType}-${score}-${durationMs ?? 'none'}`;
  const registeredDisplayName = user?.isRegistered ? user.displayName : null;

  const applySubmission = useCallback((
    nextSubmission: SubmitScoreResponse,
    key: string,
    displayName: string,
  ) => {
    setSubmission(nextSubmission);
    setSaveStatus('idle');
    syncRankingAfterScore({
      rankingType,
      bestScore: nextSubmission.bestScore,
      bestDurationMs: nextSubmission.bestDurationMs,
      displayName,
      anonymousKey: key,
    });
  }, [rankingType]);

  const saveScore = useCallback(async (key: string, displayName: string) => {
    setIsSubmitting(true);
    setRankingError(null);
    setSaveStatus('idle');
    try {
      const saved = await saveRankingScoreReliably({
        rankingType,
        score,
        durationMs,
        anonymousKey: key,
      });
      pendingSubmissionIdRef.current = saved.pending.id;
      pendingDisplayNameRef.current = displayName;
      if (saved.status === 'synced') {
        applySubmission(saved.response, key, displayName);
      } else {
        setSaveStatus('queued');
      }
    } catch (error) {
      setSaveStatus('failed');
      setRankingError(
        error instanceof Error ? error.message : '기록을 저장하지 못했어요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [applySubmission, durationMs, rankingType, score]);

  useEffect(() => subscribeRankingSync((event) => {
    if (
      event.pending.id !== pendingSubmissionIdRef.current ||
      !anonymousKey ||
      !pendingDisplayNameRef.current
    ) {
      return;
    }
    if (event.type === 'synced') {
      applySubmission(event.response, anonymousKey, pendingDisplayNameRef.current);
      return;
    }
    setSaveStatus('failed');
    setRankingError(event.error.message);
  }), [anonymousKey, applySubmission]);

  useEffect(() => {
    if (!anonymousKey || !registeredDisplayName || submittedResultRef.current === resultKey) {
      return;
    }
    submittedResultRef.current = resultKey;
    void saveScore(anonymousKey, registeredDisplayName);
  }, [resultKey, saveScore, registeredDisplayName, anonymousKey]);

  const handleRegister = async () => {
    const trimmedNickname = nickname.trim();
    const nicknameError = getNicknameValidationError(trimmedNickname);
    if (nicknameError) {
      setRankingError(nicknameError);
      return;
    }
    if (!anonymousKey) {
      setRankingError('토스 앱에서 사용자 정보를 다시 확인한 뒤 시도해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setRankingError(null);
    try {
      const registeredUser = await registerNickname(trimmedNickname, anonymousKey);
      // onRegistered로 부모 상태가 바뀌면 자동 저장 effect가 실행될 수 있다.
      // 이 등록 흐름에서는 아래의 수동 저장만 사용해 중복 제출을 막는다.
      submittedResultRef.current = resultKey;
      onRegistered(registeredUser);
      await saveScore(anonymousKey, registeredUser.displayName);
    } catch (error) {
      setRankingError(
        error instanceof Error ? error.message : '랭킹 등록을 완료하지 못했어요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="screen result-screen">
      <div className="result-confetti" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <header className="result-record-heading">
        <p className="eyebrow">오늘의 기록</p>
        <h1>
          {result.mode === 'lung-test'
            ? `${formatSeconds(result.durationMs)}초!`
            : `${result.completedCount}개 완성!`}
        </h1>
        <p className="result-title">
          {result.mode === 'lung-test'
            ? getLungScoreTitle(score)
            : '30초 스피드런 기록이에요'}
        </p>
      </header>

      <section className="result-card">
        {result.mode === 'lung-test' ? (
          <dl className="result-grid">
            <div>
              <dt>호흡 시간</dt>
              <dd>{formatSeconds(result.durationMs)}초</dd>
            </div>
            <div>
              <dt>풍선 점수</dt>
              <dd>{score.toLocaleString()}점</dd>
            </div>
          </dl>
        ) : (
          <dl className="result-grid result-grid--rush">
            <div>
              <dt>만든 풍선 수</dt>
              <dd>{result.completedCount}개</dd>
            </div>
            <div>
              <dt>마지막 풍선 완성</dt>
              <dd>
                {result.completionTimeMs === null
                  ? '완성 기록 없음'
                  : `${formatSeconds(result.completionTimeMs)}초`}
              </dd>
            </div>
          </dl>
        )}
        <div className="result-note-group">
          <p className="result-mode-guide">
            {result.mode === 'lung-test'
              ? '풍선 크기 점수와 기록 시간으로 순위를 정해요.'
              : '완성한 풍선 수가 많을수록 높은 기록이에요.'}
          </p>
          <p className="medical-note">
            마이크 입력을 이용한 재미용 기록이에요.
          </p>
        </div>
        <section className="ranking-result" aria-live="polite">
          {submission ? (
          <>
            <p className="eyebrow">랭킹에 반영됐어요</p>
            <strong>
              {submission.isNewBest ? '새로운 최고 기록이에요!' : '최고 기록을 유지했어요.'}
            </strong>
            <span>
              {result.mode === 'lung-test'
                ? `풍선 크기 ${submission.bestScore}점 · ${submission.bestDurationMs === null ? '-' : `${formatSeconds(submission.bestDurationMs)}초`}`
                : `${submission.bestScore}개 · ${submission.bestDurationMs === null ? '-' : `${formatSeconds(submission.bestDurationMs)}초`}`}
            </span>
          </>
          ) : user?.isRegistered ? (
          <p className="ranking-progress">
            {isSubmitting
              ? '이번 기록을 안전하게 보관하고 있어요.'
              : saveStatus === 'queued'
                ? '기록을 안전하게 보관했어요. 연결되면 자동으로 랭킹에 반영돼요.'
                : saveStatus === 'failed'
                  ? '기록 저장을 다시 시도할 수 있어요.'
                  : '이번 기록을 안전하게 보관하고 있어요.'}
          </p>
          ) : isRegistrationOpen ? (
          <div className="nickname-form">
            <label htmlFor="nickname">랭킹에서 사용할 별명</label>
            <small>다른 사용자에게 공개돼요. 개인정보는 입력하지 마세요.</small>
            <input
              id="nickname"
              value={nickname}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="한글·영문·숫자 2~6자"
              onChange={(event) => setNickname(event.target.value)}
            />
            <div className="nickname-form__actions">
              <button
                className="button button--primary"
                type="button"
                disabled={isSubmitting}
                onClick={handleRegister}
              >
                {isSubmitting ? '등록하는 중…' : '별명 등록하고 기록 저장'}
              </button>
              <button className="button ranking-view-button" type="button" onClick={onOpenRanking}>
                랭킹 보러 가기
              </button>
            </div>
          </div>
          ) : (
          <div className="ranking-choice">
            <div className="ranking-choice__actions">
              <button
                className="button button--primary"
                type="button"
                disabled={!anonymousKey}
                onClick={() => setIsRegistrationOpen(true)}
              >
                랭킹에 등록하기
              </button>
              <button
                className="button ranking-view-button"
                type="button"
                onClick={onOpenRanking}
              >
                랭킹 보러 가기
              </button>
            </div>
            {!anonymousKey && (
              <small>랭킹 등록은 토스 앱에서 사용할 수 있어요.</small>
            )}
          </div>
          )}
          {rankingError && (
            <>
              <p className="error-text">{rankingError}</p>
              {user?.isRegistered && anonymousKey && (
                <button className="text-button" type="button" onClick={() => void saveScore(anonymousKey, user.displayName)}>
                  기록 저장 다시 시도
                </button>
              )}
            </>
          )}
        </section>

        {(submission || user?.isRegistered) && (
          <div className="result-utility-links result-utility-links--wide">
            <button className="button ranking-view-button" type="button" onClick={onOpenRanking}>
              랭킹 보러 가기
            </button>
          </div>
        )}
      </section>

      <div className="button-stack">
        <button className="button result-retry-button" type="button" onClick={onRetry}>
          다시 도전
        </button>
        <button className="text-button" type="button" onClick={onHome}>
          홈으로
        </button>
      </div>
    </main>
  );
}
