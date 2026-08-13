import { useEffect, useState } from 'react';
import {
  getCachedRanking,
  getRanking,
  type RankingType,
  type RankingItem,
} from '../api/rankingApi';
import { RankingPodium } from './RankingPodium';

type HomeRecordPreviewProps = {
  anonymousKey: string | null;
  isRegistered: boolean;
  onOpenRanking: () => void;
};

const ROTATION_MS = 4000;

const getLabel = (rankingType: RankingType) =>
  rankingType === 'LUNG_CAPACITY' ? '풍선 크게 불기' : '풍선 스피드런';

export function HomeRecordPreview({ onOpenRanking }: HomeRecordPreviewProps) {
  const [rankings, setRankings] = useState<Record<RankingType, RankingItem[]>>(() => ({
    LUNG_CAPACITY: getCachedRanking('LUNG_CAPACITY') ?? [],
    BALLOON_COUNT: getCachedRanking('BALLOON_COUNT') ?? [],
  }));
  const [activeRankingType, setActiveRankingType] = useState<RankingType>('LUNG_CAPACITY');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [lungRanking, rushRanking] = await Promise.all([
        getRanking('LUNG_CAPACITY').catch(() => null),
        getRanking('BALLOON_COUNT').catch(() => null),
      ]);
      if (!cancelled) {
        setRankings({
          LUNG_CAPACITY: lungRanking ?? [],
          BALLOON_COUNT: rushRanking ?? [],
        });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveRankingType((current) =>
        current === 'LUNG_CAPACITY' ? 'BALLOON_COUNT' : 'LUNG_CAPACITY',
      );
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);

  const items = rankings[activeRankingType];

  return (
    <div className="home-ranking-preview">
      <button
        className="home-ranking-preview__title"
        type="button"
        onClick={onOpenRanking}
        aria-label={`${getLabel(activeRankingType)} 랭킹 보기`}
      >
        <strong>{getLabel(activeRankingType)} 랭킹</strong>
      </button>
      <button className="home-record-preview" type="button" onClick={onOpenRanking}>
        <RankingPodium ranking={items} rankingType={activeRankingType} />
      </button>
    </div>
  );
}
