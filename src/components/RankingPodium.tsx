import type { RankingType, RankingItem } from '../api/rankingApi';
import { getRankingBalloonSrc } from '../utils/rankingBalloon';

type RankingPodiumProps = {
  ranking: RankingItem[];
  rankingType: RankingType;
};

const formatScore = (rankingType: RankingType, score: number) =>
  rankingType === 'LUNG_CAPACITY' ? `${score}점` : `${score}개`;

export function RankingPodium({ ranking, rankingType }: RankingPodiumProps) {
  return (
    <span className="home-ranking-podium" aria-label="상위 3위">
      {[1, 2, 3].map((rank) => {
        const item = ranking.find((entry) => entry.rank === rank);
        return (
          <span
            className={`home-ranking-podium__card home-ranking-podium__card--${rank}${item ? '' : ' is-empty'}`}
            key={rank}
          >
            <span className="home-ranking-podium__rank">{rank}</span>
            {item ? (
              <>
                <img
                  className="home-ranking-podium__balloon"
                  src={getRankingBalloonSrc(rankingType, rank)}
                  alt=""
                />
                <span className="home-ranking-podium__name">{item.displayName}</span>
                <strong className="home-ranking-podium__score">
                  {formatScore(rankingType, item.score)}
                </strong>
              </>
            ) : (
              <span className="home-ranking-podium__empty">기록 없음</span>
            )}
          </span>
        );
      })}
    </span>
  );
}
