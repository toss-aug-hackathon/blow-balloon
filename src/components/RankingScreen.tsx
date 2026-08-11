import { useEffect, useRef, useState } from 'react';
import {
  getCachedMyRecords,
  getCachedRanking,
  getMyRecords,
  getRanking,
  updateCachedDisplayName,
  updateNickname,
  type GameType,
  type MyRecordsResponse,
  type RankingItem,
  type RegisteredGameUser,
} from '../api/gameApi';
import { formatSeconds } from '../utils/math';
import { getNicknameValidationError } from '../utils/nicknamePolicy';

type RankingScreenProps = {
  userKey: string | null;
  isRegistered: boolean;
  onHome: () => void;
  onUserUpdated: (user: RegisteredGameUser) => void;
};

type View = 'ranking' | 'mine';
type RankMovement = 'up' | 'down' | 'same';

const RANKING_POLL_INTERVAL_MS = 3000;
const MAX_VISIBLE_RANKING_ITEMS = 15;

const gameTabs: Array<{ type: GameType; label: string }> = [
  { type: 'LUNG_CAPACITY', label: '크게 불기' },
  { type: 'BALLOON_COUNT', label: '스피드런' },
];

function formatScore(gameType: GameType, score: number) {
  return gameType === 'LUNG_CAPACITY'
    ? `${score}점`
    : `${score}개`;
}

export function RankingScreen({
  userKey,
  isRegistered,
  onHome,
  onUserUpdated,
}: RankingScreenProps) {
  const [view, setView] = useState<View>('ranking');
  const [gameType, setGameType] = useState<GameType>('LUNG_CAPACITY');
  const [ranking, setRanking] = useState<RankingItem[] | null>(() =>
    getCachedRanking('LUNG_CAPACITY'),
  );
  const [records, setRecords] = useState<MyRecordsResponse | null>(() =>
    userKey ? getCachedMyRecords(userKey) : null,
  );
  const rankHistoryRef = useRef(new Map<GameType, Map<string, number>>());
  const [rankMovements, setRankMovements] = useState<Record<string, RankMovement>>({});
  const [error, setError] = useState<string | null>(null);
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nickname, setNickname] = useState('');
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const recordsRevisionRef = useRef(0);

  const openNicknameEditor = () => {
    const currentNickname = records?.displayName.split(' #')[0] ?? '';
    setNickname(currentNickname);
    setNicknameError(null);
    setIsEditingNickname(true);
  };

  const saveNickname = async () => {
    const nextNickname = nickname.trim();
    const validationError = getNicknameValidationError(nextNickname);
    if (!userKey || validationError) {
      setNicknameError(validationError ?? '사용자 정보를 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    setIsSavingNickname(true);
    setNicknameError(null);
    const nextRecordsRevision = recordsRevisionRef.current + 1;
    recordsRevisionRef.current = nextRecordsRevision;
    try {
      const updatedUser = await updateNickname(nextNickname, userKey);
      onUserUpdated(updatedUser);
      updateCachedDisplayName(userKey, updatedUser.displayName);
      setRecords((current) =>
        current ? { ...current, displayName: updatedUser.displayName } : current,
      );
      const refreshedRecords = await getMyRecords(userKey, { forceRefresh: true })
        .catch(() => null);
      if (recordsRevisionRef.current === nextRecordsRevision && refreshedRecords) {
        setRecords(refreshedRecords);
      }
      setIsEditingNickname(false);
    } catch (requestError) {
      setNicknameError(
        requestError instanceof Error ? requestError.message : '별명을 바꾸지 못했어요.',
      );
    } finally {
      setIsSavingNickname(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const applyRanking = (nextRanking: RankingItem[]) => {
      const previousRanks = rankHistoryRef.current.get(gameType);
      const nextMovements: Record<string, RankMovement> = {};

      if (previousRanks) {
        for (const item of nextRanking) {
          const previousRank = previousRanks.get(item.displayName);
          if (previousRank === undefined || item.rank === previousRank) {
            nextMovements[item.displayName] = 'same';
          } else if (item.rank < previousRank) {
            nextMovements[item.displayName] = 'up';
          } else {
            nextMovements[item.displayName] = 'down';
          }
        }
      }

      rankHistoryRef.current.set(
        gameType,
        new Map(nextRanking.map((item) => [item.displayName, item.rank])),
      );
      setRankMovements(nextMovements);
      setRanking(nextRanking);
    };

    const load = async () => {
      setError(null);

      if (view === 'mine') {
        if (!userKey || !isRegistered) return;
        const requestRevision = recordsRevisionRef.current;
        setRecords(getCachedMyRecords(userKey));
        try {
          const nextRecords = await getMyRecords(userKey);
          if (
            !cancelled &&
            recordsRevisionRef.current === requestRevision
          ) {
            setRecords(nextRecords);
          }
        } catch (requestError) {
          if (!cancelled) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : '나의 기록을 불러오지 못했어요.',
            );
          }
        }
        return;
      }

      setRanking(getCachedRanking(gameType));
      try {
        const nextRanking = await getRanking(gameType);
        if (!cancelled) applyRanking(nextRanking);
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
    const pollId = view === 'ranking'
      ? window.setInterval(() => void load(), RANKING_POLL_INTERVAL_MS)
      : undefined;

    return () => {
      cancelled = true;
      if (pollId !== undefined) window.clearInterval(pollId);
    };
  }, [gameType, isRegistered, userKey, view]);

  return (
    <main className="screen ranking-screen">
      <header className="ranking-header">
        <button className="back-button" type="button" onClick={onHome}>
          ←<span className="sr-only">홈으로</span>
        </button>
        <p className="eyebrow">blow-balloon</p>
        <h1>풍선 기록장</h1>
        <p>점수가 높을수록, 같은 점수라면 시간이 짧을수록 높은 기록이에요.</p>
      </header>

      <div className="ranking-view-tabs" role="tablist" aria-label="기록 보기">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'ranking'}
          className={view === 'ranking' ? 'is-selected' : ''}
          onClick={() => {
            setRankMovements({});
            setView('ranking');
          }}
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
          나의 기록
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
                onClick={() => {
                  setRankMovements({});
                  setGameType(tab.type);
                }}
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
              ranking.slice(0, MAX_VISIBLE_RANKING_ITEMS).map((item) => (
                <div className="ranking-item" key={item.displayName}>
                  <strong>{item.rank}</strong>
                  <span>{item.displayName}</span>
                  <b>
                    {formatScore(gameType, item.score)}
                    <small>
                      {item.durationMs === null
                        ? '시간 기록 없음'
                        : `${formatSeconds(item.durationMs)}초`}
                    </small>
                  </b>
                  <i
                    className={`ranking-movement ranking-movement--${rankMovements[item.displayName] ?? 'same'}`}
                    aria-label={
                      rankMovements[item.displayName] === 'up'
                        ? '순위 상승'
                        : rankMovements[item.displayName] === 'down'
                          ? '순위 하락'
                          : '순위 변동 없음'
                    }
                  >
                    {rankMovements[item.displayName] === 'up'
                      ? '↑'
                      : rankMovements[item.displayName] === 'down'
                        ? '↓'
                        : '-'}
                  </i>
                </div>
              ))
            )}
          </section>
        </>
      ) : !isRegistered || !userKey ? (
        <section className="ranking-notice ranking-notice--card">
          게임 결과에서 랭킹에 등록하면 나의 기록을 확인할 수 있어요.
        </section>
      ) : error ? (
        <section className="ranking-notice ranking-notice--card">{error}</section>
      ) : records === null ? (
        <section className="ranking-notice ranking-notice--card">
          나의 기록을 불러오는 중이에요.
        </section>
      ) : (
        <section className="my-records">
          <div className="my-records__heading">
            <p>{records.displayName}</p>
            {!isEditingNickname && (
              <button className="text-button" type="button" onClick={openNicknameEditor}>
                별명 바꾸기
              </button>
            )}
          </div>
          {isEditingNickname && (
            <div className="nickname-edit-form">
              <label htmlFor="my-records-nickname">새 별명</label>
              <div>
                <input
                  id="my-records-nickname"
                  value={nickname}
                  maxLength={12}
                  autoFocus
                  onChange={(event) => setNickname(event.target.value)}
                />
                <button type="button" disabled={isSavingNickname} onClick={() => void saveNickname()}>
                  {isSavingNickname ? '저장 중…' : '저장'}
                </button>
              </div>
              {nicknameError && <small>{nicknameError}</small>}
            </div>
          )}
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
                <small>
                  {record.bestDurationMs === null
                    ? '시간 기록 없음'
                    : `${formatSeconds(record.bestDurationMs)}초`}
                  {record.rank === null ? '' : ` · 현재 ${record.rank}위`}
                </small>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
