import { useEffect, useState } from 'react';
import { getMyRecords, type MyRecordsResponse } from '../api/gameApi';
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
  const [records, setRecords] = useState<MyRecordsResponse | null>(null);

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

  if (!isRegistered || !records) {
    return (
      <button className="home-ranking-entry" type="button" onClick={onOpenRanking}>
        <span>
          <small>내 기록</small>
          <b>게임 후 랭킹에 등록하면 여기서 볼 수 있어요.</b>
        </span>
        <strong>랭킹 <i aria-hidden="true">→</i></strong>
      </button>
    );
  }

  const lung = records.records.LUNG_CAPACITY;
  const rush = records.records.BALLOON_COUNT;

  return (
    <button className="home-record-preview" type="button" onClick={onOpenRanking}>
      <span className="home-record-preview__heading">
        <small>{records.displayName}의 기록</small>
        <i aria-hidden="true">→</i>
      </span>
      <span className="home-record-preview__items">
        <span>
          <small>폐활량</small>
          <strong>{lung.bestScore === null ? '기록 없음' : `${formatSeconds(lung.bestScore)}초`}</strong>
          {lung.rank !== null && <em>{lung.rank}위</em>}
        </span>
        <span>
          <small>풍선 많이</small>
          <strong>{rush.bestScore === null ? '기록 없음' : `${rush.bestScore}개`}</strong>
          {rush.rank !== null && <em>{rush.rank}위</em>}
        </span>
      </span>
    </button>
  );
}
