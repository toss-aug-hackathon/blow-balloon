import { useEffect, useState } from 'react';
import {
  getCachedRanking,
  getRanking,
  type GameType,
  type RankingItem,
} from '../api/gameApi';

type HomeRecordPreviewProps = {
  userKey: string | null;
  isRegistered: boolean;
  onOpenRanking: () => void;
};

const ROTATION_MS = 4000;

const getLabel = (gameType: GameType) =>
  gameType === 'LUNG_CAPACITY' ? '풍선 크게 불기' : '풍선 스피드런';

export function HomeRecordPreview({ onOpenRanking }: HomeRecordPreviewProps) {
  const [rankings, setRankings] = useState<Record<GameType, RankingItem[]>>(() => ({
    LUNG_CAPACITY: getCachedRanking('LUNG_CAPACITY') ?? [],
    BALLOON_COUNT: getCachedRanking('BALLOON_COUNT') ?? [],
  }));
  const [activeGameType, setActiveGameType] = useState<GameType>('LUNG_CAPACITY');

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
      setActiveGameType((current) =>
        current === 'LUNG_CAPACITY' ? 'BALLOON_COUNT' : 'LUNG_CAPACITY',
      );
    }, ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);

  const items = rankings[activeGameType];

  return (
    <div className="home-ranking-preview">
      <button
        className="home-ranking-preview__title"
        type="button"
        onClick={onOpenRanking}
        aria-label={`${getLabel(activeGameType)} 랭킹 보기`}
      >
        <strong>{getLabel(activeGameType)} 랭킹</strong>
      </button>
      <button className="home-record-preview" type="button" onClick={onOpenRanking}>
        <span className="home-ranking-podium">
          {[0, 1, 2].map((index) => {
            const rankingItem = items[index];
            return (
              <span
                className={`home-ranking-podium__card home-ranking-podium__card--${index + 1}${rankingItem ? '' : ' is-empty'}`}
                key={rankingItem ? `${activeGameType}-${rankingItem.rank}` : `empty-${index + 1}`}
                aria-label={rankingItem ? getLabel(activeGameType) : `${index + 1}위 기록 없음`}
              >
                <span className="home-ranking-podium__rank">{index + 1}</span>
                {rankingItem ? (
                  <>
                    <img
                      className="home-ranking-podium__balloon"
                      src={`/balloons/${activeGameType === 'LUNG_CAPACITY' ? 'lung-test' : 'balloon-rush'}/balloon_${String((index % 3) + 1).padStart(2, '0')}.webp`}
                      alt=""
                    />
                    <span className="home-ranking-podium__name">{rankingItem.displayName}</span>
                    <strong className="home-ranking-podium__score">
                      {activeGameType === 'LUNG_CAPACITY'
                        ? `${rankingItem.score}점`
                        : `${rankingItem.score}개`}
                    </strong>
                  </>
                ) : (
                  <span className="home-ranking-podium__empty">기록 없음</span>
                )}
              </span>
            );
          })}
        </span>
      </button>
    </div>
  );
}
