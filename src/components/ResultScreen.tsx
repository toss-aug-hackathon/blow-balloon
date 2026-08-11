import { useCallback, useEffect, useRef, useState } from 'react';
import {
  registerNickname,
  submitScore,
  type GameUser,
  type RegisteredGameUser,
  type SubmitScoreResponse,
} from '../api/gameApi';
import type { GameResult } from '../game/types';
import { createResultSnapshot } from '../result/createResultSnapshot';
import { formatSeconds } from '../utils/math';

type ResultScreenProps = {
  result: GameResult;
  onRetry: () => void;
  onHome: () => void;
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
      ? Math.round(result.durationMs)
      : Math.round(result.completedCount);
  const resultKey = `${gameType}-${score}`;

  const saveScore = useCallback(async (key: string) => {
    setIsSubmitting(true);
    setRankingError(null);
    try {
      setSubmission(await submitScore(gameType, score, key));
    } catch (error) {
      setRankingError(
        error instanceof Error ? error.message : '기록을 저장하지 못했어요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [gameType, score]);

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
    const length = Array.from(trimmedNickname).length;
    if (
      length < 2 ||
      length > 12 ||
      trimmedNickname.includes('#') ||
      Array.from(trimmedNickname).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      })
    ) {
      setRankingError('별명은 공백을 제외하고 2~12자이며 # 없이 입력해 주세요.');
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
      setSubmission(await submitScore(gameType, score, userKey));
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
            : '30초 풍선 공장이 문을 닫았어요'}
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
              <dt>실제로 분 시간</dt>
              <dd>{formatSeconds(result.totalBlowingMs)}초</dd>
            </div>
          </dl>
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
              내 최고 기록 {result.mode === 'lung-test'
                ? `${formatSeconds(submission.bestScore)}초`
                : `${submission.bestScore}개`}
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
