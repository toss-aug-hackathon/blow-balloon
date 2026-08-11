import { useEffect, useState } from 'react';
import {
  getMyRecords,
  getRanking,
  type GameType,
  type MyRecordsResponse,
  type RankingItem,
} from '../api/gameApi';
import { formatSeconds } from '../utils/math';

type RankingScreenProps = {
  userKey: string | null;
  isRegistered: boolean;
  onHome: () => void;
};

type View = 'ranking' | 'mine';

const gameTabs: Array<{ type: GameType; label: string }> = [
  { type: 'LUNG_CAPACITY', label: '폐활량' },
  { type: 'BALLOON_COUNT', label: '풍선 많이' },
];

function formatScore(gameType: GameType, score: number) {
  return gameType === 'LUNG_CAPACITY'
    ? `${formatSeconds(score)}초`
    : `${score}개`;
}

export function RankingScreen({
  userKey,
  isRegistered,
  onHome,
}: RankingScreenProps) {
  const [view, setView] = useState<View>('ranking');
  const [gameType, setGameType] = useState<GameType>('LUNG_CAPACITY');
  const [ranking, setRanking] = useState<RankingItem[] | null>(null);
  const [records, setRecords] = useState<MyRecordsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setError(null);

      if (view === 'mine') {
        if (!userKey || !isRegistered) return;
        setRecords(null);
        try {
          const nextRecords = await getMyRecords(userKey);
          if (!cancelled) setRecords(nextRecords);
        } catch (requestError) {
          if (!cancelled) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : '내 기록을 불러오지 못했어요.',
            );
          }
        }
        return;
      }

      setRanking(null);
      try {
        const nextRanking = await getRanking(gameType);
        if (!cancelled) setRanking(nextRanking);
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : '랭킹을 불러오지 못했어요.',
          );
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [gameType, isRegistered, userKey, view]);

  return (
    <main className="screen ranking-screen">
      <header className="ranking-header">
        <button className="back-button" type="button" onClick={onHome}>
          ←<span className="sr-only">홈으로</span>
        </button>
        <p className="eyebrow">blow-balloon</p>
        <h1>바람 기록</h1>
        <p>오늘 가장 멀리 간 한 호흡을 만나보세요.</p>
      </header>

      <div className="ranking-view-tabs" role="tablist" aria-label="기록 보기">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'ranking'}
          className={view === 'ranking' ? 'is-selected' : ''}
          onClick={() => setView('ranking')}
        >
          전체 랭킹
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'mine'}
          className={view === 'mine' ? 'is-selected' : ''}
          onClick={() => setView('mine')}
        >
          내 기록
        </button>
      </div>

      {view === 'ranking' ? (
        <>
          <div className="ranking-game-tabs" role="tablist" aria-label="게임 선택">
            {gameTabs.map((tab) => (
              <button
                key={tab.type}
                type="button"
                className={gameType === tab.type ? 'is-selected' : ''}
                onClick={() => setGameType(tab.type)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <section className="ranking-list" aria-live="polite">
            {error ? (
              <p className="ranking-notice">{error}</p>
            ) : ranking === null ? (
              <p className="ranking-notice">기록을 불러오는 중이에요.</p>
            ) : ranking.length === 0 ? (
              <p className="ranking-notice">아직 등록된 기록이 없어요.</p>
            ) : (
              ranking.map((item) => (
                <div className="ranking-item" key={`${item.rank}-${item.displayName}`}>
                  <strong>{item.rank}</strong>
                  <span>{item.displayName}</span>
                  <b>{formatScore(gameType, item.score)}</b>
                </div>
              ))
            )}
          </section>
        </>
      ) : !isRegistered || !userKey ? (
        <section className="ranking-notice ranking-notice--card">
          게임 결과에서 랭킹에 등록하면 내 기록을 확인할 수 있어요.
        </section>
      ) : error ? (
        <section className="ranking-notice ranking-notice--card">{error}</section>
      ) : records === null ? (
        <section className="ranking-notice ranking-notice--card">
          내 기록을 불러오는 중이에요.
        </section>
      ) : (
        <section className="my-records">
          <p>{records.displayName}</p>
          {gameTabs.map((tab) => {
            const record = records.records[tab.type];
            return (
              <div key={tab.type} className="my-record">
                <span>{tab.label}</span>
                <strong>
                  {record.bestScore === null
                    ? '기록 없음'
                    : formatScore(tab.type, record.bestScore)}
                </strong>
                <small>{record.rank === null ? '' : `현재 ${record.rank}위`}</small>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
