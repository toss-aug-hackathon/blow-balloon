import { useEffect, useState } from 'react';
import {
  getCachedRanking,
  getRanking,
  type GameType,
  type RankingItem,
} from '../api/gameApi';
import { formatSeconds } from '../utils/math';

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
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [lungRanking, rushRanking] = await Promise.all([
        getRanking('LUNG_CAPACITY').catch(() => null),
        getRanking('BALLOON_COUNT').catch(() => null),
      ]);
      if (!cancelled) {
        setItems(buildTickerItems(lungRanking, rushRanking));
        setActiveIndex(0);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  const item = items[activeIndex];

  return (
    <div className="home-ranking-preview">
      <div className="home-ranking-preview__heading">
        <strong>오늘의 풍선 랭킹</strong>
        <i aria-hidden="true">→</i>
      </div>
      <button className="home-record-preview" type="button" onClick={onOpenRanking}>
        {item ? (
          <span className="home-ranking-ticker" key={`${item.gameType}-${item.rank}-${activeIndex}`}>
            <b className="home-ranking-ticker__rank">{item.rank}위</b>
            <span className="home-ranking-ticker__name">
              <small>{getLabel(item.gameType)}</small>
              <strong>{item.displayName}</strong>
            </span>
            <span className="home-ranking-ticker__score">
              <strong>
                {item.gameType === 'LUNG_CAPACITY' ? `${item.score}점` : `${item.score}개`}
              </strong>
              {item.durationMs !== null && <small>{formatSeconds(item.durationMs)}초</small>}
            </span>
          </span>
        ) : (
          <span className="home-ranking-ticker home-ranking-ticker--empty">
            <strong>랭킹을 불러오는 중이에요</strong>
          </span>
        )}
      </button>
    </div>
  );
}
