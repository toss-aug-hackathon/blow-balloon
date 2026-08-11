import { useCallback, useEffect, useRef, useState } from 'react';
import {
  registerNickname,
  syncRankingAfterScore,
  submitScore,
  type GameUser,
  type RegisteredGameUser,
  type SubmitScoreResponse,
} from '../api/gameApi';
import type { GameResult } from '../game/types';
import { createResultSnapshot } from '../result/createResultSnapshot';
import { formatSeconds } from '../utils/math';
import { getNicknameValidationError } from '../utils/nicknamePolicy';

type ResultScreenProps = {
  result: GameResult;
  onRetry: () => void;
  onHome: () => void;
  onOpenRanking: () => void;
  userKey: string | null;
  user: GameUser | null;
  onRegistered: (user: RegisteredGameUser) => void;
};

function getLungGrade(durationMs: number): string {
  if (durationMs >= 12_000) return '바람의 전설';
  if (durationMs >= 8_000) return '풍선 장인';
  if (durationMs >= 5_000) return '안정적인 한 호흡';
  return '말랑한 첫걸음';
}

export function ResultScreen({
  result,
  onRetry,
  onHome,
  onOpenRanking,
  userKey,
  user,
  onRegistered,
}: ResultScreenProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isSkipped, setIsSkipped] = useState(false);
  const [nickname, setNickname] = useState('');
  const [rankingError, setRankingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmitScoreResponse | null>(null);
  const submittedResultRef = useRef<string | null>(null);

  const gameType = result.mode === 'lung-test' ? 'LUNG_CAPACITY' : 'BALLOON_COUNT';
  const score =
    result.mode === 'lung-test'
      ? Math.round(result.finalBalloonScale * 100)
      : Math.round(result.completedCount);
  const durationMs =
    result.mode === 'lung-test'
      ? result.durationMs
      : result.completionTimeMs;
  const resultKey = `${gameType}-${score}-${durationMs ?? 'none'}`;

  const saveScore = useCallback(async (key: string) => {
    setIsSubmitting(true);
    setRankingError(null);
    try {
      const nextSubmission = await submitScore(gameType, score, durationMs, key);
      setSubmission(nextSubmission);
      if (user?.isRegistered) {
        syncRankingAfterScore({
          gameType,
          bestScore: nextSubmission.bestScore,
          bestDurationMs: nextSubmission.bestDurationMs,
          displayName: user.displayName,
          userKey: key,
        });
      }
    } catch (error) {
      setRankingError(
        error instanceof Error ? error.message : '기록을 저장하지 못했어요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [durationMs, gameType, score, user]);

  useEffect(
    () => () => {
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    },
    [snapshotUrl],
  );

  useEffect(() => {
    if (!userKey || !user?.isRegistered || submittedResultRef.current === resultKey) {
      return;
    }
    submittedResultRef.current = resultKey;
    void saveScore(userKey);
  }, [resultKey, saveScore, user?.isRegistered, userKey]);

  const handleCreateSnapshot = async () => {
    setIsCreating(true);
    setSnapshotError(null);
    try {
      const nextUrl = await createResultSnapshot(result);
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
      setSnapshotUrl(nextUrl);
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : '이미지를 만들지 못했어요.',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleRegister = async () => {
    const trimmedNickname = nickname.trim();
    const nicknameError = getNicknameValidationError(trimmedNickname);
    if (nicknameError) {
      setRankingError(nicknameError);
      return;
    }
    if (!userKey) {
      setRankingError('토스 앱에서 사용자 정보를 다시 확인한 뒤 시도해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setRankingError(null);
    try {
      const registeredUser = await registerNickname(trimmedNickname, userKey);
      onRegistered(registeredUser);
      const nextSubmission = await submitScore(gameType, score, durationMs, userKey);
      setSubmission(nextSubmission);
      syncRankingAfterScore({
        gameType,
        bestScore: nextSubmission.bestScore,
        bestDurationMs: nextSubmission.bestDurationMs,
        displayName: registeredUser.displayName,
        userKey,
      });
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
            ? getLungGrade(result.durationMs)
            : '30초 스피드런 기록이에요'}
        </p>
      </header>

      <section className="result-card">
        {result.mode === 'lung-test' ? (
          <dl className="result-grid">
            <div>
              <dt>한 번에 분 시간</dt>
              <dd>{formatSeconds(result.durationMs)}초</dd>
            </div>
            <div>
              <dt>평균 바람 세기</dt>
              <dd>{Math.round(result.averageWindStrength * 100)}%</dd>
            </div>
            <div>
              <dt>최대 바람 세기</dt>
              <dd>{Math.round(result.peakWindStrength * 100)}%</dd>
            </div>
            <div>
              <dt>최종 풍선 크기</dt>
              <dd>{Math.round(result.finalBalloonScale * 100)}점</dd>
            </div>
          </dl>
        ) : (
          <dl className="result-grid result-grid--rush">
            <div>
              <dt>완성한 풍선</dt>
              <dd>{result.completedCount}개</dd>
            </div>
            <div>
              <dt>마지막 풍선까지</dt>
              <dd>
                {result.completionTimeMs === null
                  ? '30초 내 미달성'
                  : `${formatSeconds(result.completionTimeMs)}초`}
              </dd>
            </div>
          </dl>
        )}
        {result.mode === 'lung-test' ? (
          <p className="result-mode-guide">
            풍선 크기 점수가 높을수록, 같은 점수라면 시간이 짧을수록 높은 기록이에요.
          </p>
        ) : (
          <p className="result-mode-guide">
            30개 미만은 현재 개수와 마지막 풍선까지의 시간으로 기록해요.
            30개를 만들면 30번째 풍선까지 걸린 시간으로 겨뤄요.
          </p>
        )}
        <p className="medical-note">
          마이크 입력을 이용한 재미용 기록이에요.
        </p>
      </section>

      {snapshotUrl && (
        <figure className="snapshot-preview">
          <img src={snapshotUrl} alt="blow-balloon 결과 이미지" />
          <figcaption>이미지를 길게 눌러 저장할 수 있어요.</figcaption>
        </figure>
      )}
      {snapshotError && <p className="error-text">{snapshotError}</p>}

      <section className="ranking-result" aria-live="polite">
        {submission ? (
          <>
            <p className="eyebrow">랭킹 저장 완료</p>
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
            {isSubmitting ? '이번 기록을 랭킹에 저장하고 있어요.' : '랭킹 저장을 다시 시도할 수 있어요.'}
          </p>
        ) : isSkipped ? (
          <p className="ranking-progress">이번 기록은 랭킹에 저장하지 않았어요.</p>
        ) : isRegistrationOpen ? (
          <div className="nickname-form">
            <label htmlFor="nickname">랭킹에서 사용할 별명</label>
            <input
              id="nickname"
              value={nickname}
              maxLength={12}
              placeholder="2~12자 입력"
              onChange={(event) => setNickname(event.target.value)}
            />
            <button
              className="button button--primary"
              type="button"
              disabled={isSubmitting}
              onClick={handleRegister}
            >
              {isSubmitting ? '등록하는 중…' : '별명 등록하고 기록 저장'}
            </button>
          </div>
        ) : (
          <div className="ranking-choice">
            <p>이번 기록을 랭킹에 남길까요?</p>
            <button
              className="button button--primary"
              type="button"
              disabled={!userKey}
              onClick={() => setIsRegistrationOpen(true)}
            >
              랭킹에 등록하기
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() => setIsSkipped(true)}
            >
              등록하지 않기
            </button>
            {!userKey && (
              <small>랭킹 등록은 토스 앱에서 사용할 수 있어요.</small>
            )}
          </div>
        )}
        {rankingError && (
          <>
            <p className="error-text">{rankingError}</p>
            {user?.isRegistered && userKey && (
              <button className="text-button" type="button" onClick={() => void saveScore(userKey)}>
                기록 저장 다시 시도
              </button>
            )}
          </>
        )}
      </section>

      <div className="button-stack">
        <button
          className="button button--primary"
          type="button"
          onClick={onOpenRanking}
        >
          랭킹 보러 가기
        </button>
        {!snapshotUrl && (
          <button
            className="button button--primary"
            type="button"
            onClick={handleCreateSnapshot}
            disabled={isCreating}
          >
            {isCreating ? '이미지 만드는 중…' : '결과 이미지 만들기'}
          </button>
        )}
        <button className="button button--secondary" type="button" onClick={onRetry}>
          다시 도전
        </button>
        <button className="text-button" type="button" onClick={onHome}>
          홈으로
        </button>
      </div>
    </main>
  );
}
