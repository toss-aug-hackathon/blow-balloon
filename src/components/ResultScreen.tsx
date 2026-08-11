import { useEffect, useState } from 'react';
import type { GameResult } from '../game/types';
import { createResultSnapshot } from '../result/createResultSnapshot';
import { formatSeconds } from '../utils/math';

type ResultScreenProps = {
  result: GameResult;
  onRetry: () => void;
  onHome: () => void;
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
}: ResultScreenProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(
    () => () => {
      if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    },
    [snapshotUrl],
  );

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
