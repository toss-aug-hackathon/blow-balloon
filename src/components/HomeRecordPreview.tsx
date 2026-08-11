import { useEffect, useState } from 'react';
import {
  getCachedMyRecords,
  getMyRecords,
  type MyRecordsResponse,
} from '../api/gameApi';
import { formatSeconds } from '../utils/math';

type HomeRecordPreviewProps = {
  userKey: string | null;
  isRegistered: boolean;
  onOpenRanking: () => void;
};

export function HomeRecordPreview({
  userKey,
  isRegistered,
  onOpenRanking,
}: HomeRecordPreviewProps) {
  const [records, setRecords] = useState<MyRecordsResponse | null>(() =>
    userKey ? getCachedMyRecords(userKey) : null,
  );
  const displayedRecords = userKey
    ? getCachedMyRecords(userKey) ?? records
    : records;

  useEffect(() => {
    if (!userKey || !isRegistered) return;
    let cancelled = false;

    const load = async () => {
      try {
        const nextRecords = await getMyRecords(userKey);
        if (!cancelled) setRecords(nextRecords);
      } catch {
        if (!cancelled) setRecords(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isRegistered, userKey]);

  if (!isRegistered || !displayedRecords) {
    return (
      <button className="home-ranking-entry" type="button" onClick={onOpenRanking}>
        <span>
          <small>나의 기록</small>
          <b>게임 후 내 랭킹을 확인해봐요.</b>
        </span>
        <strong>랭킹 <i aria-hidden="true">→</i></strong>
      </button>
    );
  }

  const lung = displayedRecords.records.LUNG_CAPACITY;
  const rush = displayedRecords.records.BALLOON_COUNT;

  return (
    <button className="home-record-preview" type="button" onClick={onOpenRanking}>
      <span className="home-record-preview__heading">
        <small>{displayedRecords.displayName}의 기록</small>
        <i aria-hidden="true">→</i>
      </span>
      <span className="home-record-preview__items">
        <span>
          <small>크게 불기</small>
          <strong>{lung.bestScore === null ? '기록 없음' : `${lung.bestScore}점`}</strong>
          {lung.bestDurationMs !== null && <i>{formatSeconds(lung.bestDurationMs)}초</i>}
          {lung.rank !== null && <em>{lung.rank}위</em>}
        </span>
        <span>
          <small>스피드런</small>
          <strong>{rush.bestScore === null ? '기록 없음' : `${rush.bestScore}개`}</strong>
          {rush.bestDurationMs !== null && <i>{formatSeconds(rush.bestDurationMs)}초</i>}
          {rush.rank !== null && <em>{rush.rank}위</em>}
        </span>
      </span>
    </button>
  );
}
