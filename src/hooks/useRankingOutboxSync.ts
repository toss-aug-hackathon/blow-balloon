import { useEffect } from 'react';
import { getMyRecords, getRanking } from '../api/rankingApi';
import { syncRankingOutbox } from '../api/rankingOutbox';

export function useRankingOutboxSync(
  anonymousKey: string | null,
  isRegistered: boolean,
): void {
  useEffect(() => {
    if (!anonymousKey || !isRegistered) return;
    let disposed = false;
    let retryTimer: number | undefined;

    const scheduleSync = (delayMs = 0) => {
      if (disposed) return;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(() => void runSync(), delayMs);
    };

    const runSync = async () => {
      if (disposed || document.visibilityState === 'hidden') return;
      try {
        const result = await syncRankingOutbox(anonymousKey);
        if (result.synced.length > 0) {
          const rankingTypes = new Set(result.synced.map((event) => event.pending.rankingType));
          await Promise.allSettled([
            ...Array.from(rankingTypes, (rankingType) => getRanking(rankingType)),
            getMyRecords(anonymousKey, { forceRefresh: true }),
          ]);
        }
        if (!disposed && result.nextRetryAt !== null) {
          scheduleSync(Math.max(250, result.nextRetryAt - Date.now()));
        }
      } catch {
        if (!disposed) scheduleSync(30_000);
      }
    };

    const handleOnline = () => scheduleSync();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleSync();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    scheduleSync();

    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [anonymousKey, isRegistered]);
}
