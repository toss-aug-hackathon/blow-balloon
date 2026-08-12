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

type TickerItem = RankingItem & { gameType: GameType };

const getLabel = (gameType: GameType) =>
  gameType === 'LUNG_CAPACITY' ? '크게 불기' : '풍선 스피드런';

function buildTickerItems(
  lungRanking: RankingItem[] | null,
  rushRanking: RankingItem[] | null,
): TickerItem[] {
  const items: TickerItem[] = [];
  const maxLength = Math.max(lungRanking?.length ?? 0, rushRanking?.length ?? 0);

  for (let index = 0; index < maxLength && items.length < 5; index += 1) {
    const lung = lungRanking?.[index];
    const rush = rushRanking?.[index];
    if (lung) items.push({ ...lung, gameType: 'LUNG_CAPACITY' });
    if (rush && items.length < 5) items.push({ ...rush, gameType: 'BALLOON_COUNT' });
  }

  return items;
}

export function HomeRecordPreview({ onOpenRanking }: HomeRecordPreviewProps) {
  const [items, setItems] = useState<TickerItem[]>(() =>
    buildTickerItems(
      getCachedRanking('LUNG_CAPACITY'),
      getCachedRanking('BALLOON_COUNT'),
    ),
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [lungRanking, rushRanking] = await Promise.all([
        getRanking('LUNG_CAPACITY').catch(() => null),
        getRanking('BALLOON_COUNT').catch(() => null),
      ]);
      if (!cancelled) {
        setItems(buildTickerItems(lungRanking, rushRanking));
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-ranking-preview">
      <button
        className="home-ranking-preview__title"
        type="button"
        onClick={onOpenRanking}
        aria-label="오늘의 풍선 랭킹 보기"
      >
        <strong>오늘의 풍선 랭킹</strong>
      </button>
      <button className="home-record-preview" type="button" onClick={onOpenRanking}>
        <span className="home-ranking-podium">
          {[0, 1, 2].map((index) => {
            const rankingItem = items[index];
            return (
              <span
                className={`home-ranking-podium__card home-ranking-podium__card--${index + 1}${rankingItem ? '' : ' is-empty'}`}
                key={rankingItem ? `${rankingItem.gameType}-${rankingItem.rank}` : `empty-${index + 1}`}
                aria-label={rankingItem ? getLabel(rankingItem.gameType) : `${index + 1}위 기록 없음`}
              >
                <span className="home-ranking-podium__rank">{index + 1}</span>
                {rankingItem ? (
                  <>
                    <img
                      className="home-ranking-podium__balloon"
                      src={`/balloons/${rankingItem.gameType === 'LUNG_CAPACITY' ? 'lung-test' : 'balloon-rush'}/balloon_${String((index % 3) + 1).padStart(2, '0')}.webp`}
                      alt=""
                    />
                    <span className="home-ranking-podium__name">{rankingItem.displayName}</span>
                    <strong className="home-ranking-podium__score">
                      {rankingItem.gameType === 'LUNG_CAPACITY'
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
