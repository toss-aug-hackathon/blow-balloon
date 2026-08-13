import { useEffect, useRef, useState } from 'react';
import {
  getCachedMyRecords,
  getCachedRanking,
  getMyRecords,
  getRanking,
  updateCachedDisplayName,
  updateNickname,
  type RankingType,
  type MyRecordsResponse,
  type RankingItem,
  type RegisteredRankingUser,
} from '../api/rankingApi';
import { formatSeconds } from '../utils/math';
import { getNicknameValidationError } from '../utils/nicknamePolicy';
import { getRankingBalloonSrc } from '../utils/rankingBalloon';
import { RankingPodium } from './RankingPodium';

type RankingScreenProps = {
  anonymousKey: string | null;
  isRegistered: boolean;
  onUserUpdated: (user: RegisteredRankingUser) => void;
};

type View = 'ranking' | 'mine';
type RankMovement = 'up' | 'down' | 'same';

const RANKING_POLL_INTERVAL_MS = 3000;

const rankingTabs: Array<{ type: RankingType; label: string }> = [
  { type: 'LUNG_CAPACITY', label: '크게 불기' },
  { type: 'BALLOON_COUNT', label: '스피드런' },
];

function formatScore(rankingType: RankingType, score: number) {
  return rankingType === 'LUNG_CAPACITY'
    ? `${score}점`
    : `${score}개`;
}

export function RankingScreen({
  anonymousKey,
  isRegistered,
  onUserUpdated,
}: RankingScreenProps) {
  const [view, setView] = useState<View>('ranking');
  const [rankingType, setRankingType] = useState<RankingType>('LUNG_CAPACITY');
  const [ranking, setRanking] = useState<RankingItem[] | null>(() =>
    getCachedRanking('LUNG_CAPACITY'),
  );
  const [records, setRecords] = useState<MyRecordsResponse | null>(() =>
    anonymousKey ? getCachedMyRecords(anonymousKey) : null,
  );
  const rankHistoryRef = useRef(new Map<RankingType, Map<string, number>>());
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
    if (!anonymousKey || validationError) {
      setNicknameError(validationError ?? '사용자 정보를 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    setIsSavingNickname(true);
    setNicknameError(null);
    const nextRecordsRevision = recordsRevisionRef.current + 1;
    recordsRevisionRef.current = nextRecordsRevision;
    try {
      const updatedUser = await updateNickname(nextNickname, anonymousKey);
      onUserUpdated(updatedUser);
      updateCachedDisplayName(anonymousKey, updatedUser.displayName);
      setRecords((current) =>
        current ? { ...current, displayName: updatedUser.displayName } : current,
      );
      const refreshedRecords = await getMyRecords(anonymousKey, { forceRefresh: true })
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
      const previousRanks = rankHistoryRef.current.get(rankingType);
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
        rankingType,
        new Map(nextRanking.map((item) => [item.displayName, item.rank])),
      );
      setRankMovements(nextMovements);
      setRanking(nextRanking);
    };

    const load = async () => {
      setError(null);

      if (view === 'mine') {
        if (!anonymousKey || !isRegistered) return;
        const requestRevision = recordsRevisionRef.current;
        setRecords(getCachedMyRecords(anonymousKey));
        try {
          const nextRecords = await getMyRecords(anonymousKey);
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

      setRanking(getCachedRanking(rankingType));
      try {
        const nextRanking = await getRanking(rankingType);
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
  }, [rankingType, isRegistered, anonymousKey, view]);

  return (
    <main className="screen ranking-screen">
      <header className="ranking-header">
        <h1>풍선 기록장</h1>
        <p>
          {rankingType === 'LUNG_CAPACITY'
            ? <>풍선 점수가 높을수록, 같은 점수라면<br />호흡이 길수록 높은 기록이에요.</>
            : <>풍선 수가 많을수록, 같은 개수라면<br />마지막 완성이 빠를수록 높은 기록이에요.</>}
        </p>
      </header>

      <div className="ranking-tabs" role="tablist" aria-label="랭킹 메뉴">
        <button type="button" className={view === 'ranking' && rankingType === 'LUNG_CAPACITY' ? 'is-selected' : ''} onClick={() => { setRankMovements({}); setRankingType('LUNG_CAPACITY'); setView('ranking'); }}>크게 불기</button>
        <button type="button" className={view === 'ranking' && rankingType === 'BALLOON_COUNT' ? 'is-selected' : ''} onClick={() => { setRankMovements({}); setRankingType('BALLOON_COUNT'); setView('ranking'); }}>스피드런</button>
        <button type="button" className={view === 'mine' ? 'is-selected' : ''} onClick={() => setView('mine')}>나의 기록</button>
      </div>

      {view === 'ranking' ? (
        <>
          {ranking && ranking.length > 0 && (
            <div className="ranking-podium">
              <RankingPodium ranking={ranking} rankingType={rankingType} />
            </div>
          )}
          <section className="ranking-list" aria-live="polite">
            {error ? (
              <p className="ranking-notice">{error}</p>
            ) : ranking === null ? (
              <p className="ranking-notice">기록을 불러오는 중이에요.</p>
            ) : ranking.length === 0 ? (
              <p className="ranking-notice">아직 등록된 기록이 없어요.</p>
            ) : (
              [4, 5, 6, 7, 8].map((rank) => {
                const item = ranking.find((entry) => entry.rank === rank);
                return (
                <div className={`ranking-item${item ? '' : ' is-empty'}`} key={rank}>
                  <strong>{rank}</strong>
                  {item ? (
                    <>
                      <img className="ranking-item__balloon" src={getRankingBalloonSrc(rankingType, rank)} alt="" />
                      <span>{item.displayName}</span>
                      <b>
                        {formatScore(rankingType, item.score)}
                        <small>
                          {item.durationMs === null ? '시간 기록 없음' : `${formatSeconds(item.durationMs)}초`}
                        </small>
                      </b>
                    </>
                  ) : (
                    <>
                      <span className="ranking-item__placeholder" aria-hidden="true" />
                      <span className="ranking-item__empty-label">기록 없음</span>
                      <b className="ranking-item__empty-score">-</b>
                    </>
                  )}
                  <i
                    className={`ranking-movement ranking-movement--${item ? rankMovements[item.displayName] ?? 'same' : 'same'}`}
                    aria-label={
                      item && rankMovements[item.displayName] === 'up'
                        ? '순위 상승'
                        : item && rankMovements[item.displayName] === 'down'
                          ? '순위 하락'
                          : '순위 변동 없음'
                    }
                  >
                    {item && rankMovements[item.displayName] === 'up'
                      ? '↑'
                      : item && rankMovements[item.displayName] === 'down'
                        ? '↓'
                        : '-'}
                  </i>
                </div>
                );
              })
            )}
          </section>
        </>
      ) : !isRegistered || !anonymousKey ? (
        <section className="ranking-notice ranking-notice--card">
          플레이 결과에서 랭킹에 등록하면<br />
          나의 기록을 확인할 수 있어요.
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
              <small>별명은 랭킹에 공개돼요. 개인정보는 입력하지 마세요.</small>
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
          {rankingTabs.map((tab) => {
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
