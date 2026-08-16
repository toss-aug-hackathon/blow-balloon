import { useCallback, useEffect, useState } from 'react';
import { getAnonymousKey } from '@apps-in-toss/web-bridge';
import {
  getRankingUser,
  getMyRecords,
  getCachedRegisteredRankingUser,
  type RankingUser,
} from '../api/rankingApi';
import { extractAnonymousKey } from '../utils/anonymousIdentity';

export type RankingUserStatus = 'loading' | 'ready' | 'cached' | 'unavailable';

export function useRankingUser() {
  const [anonymousKey, setAnonymousKey] = useState<string | null>(null);
  const [user, setUser] = useState<RankingUser | null>(null);
  const [status, setStatus] = useState<RankingUserStatus>('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');

    try {
      const keyResult = await getAnonymousKey();
      const nextAnonymousKey = extractAnonymousKey(keyResult);
      if (!nextAnonymousKey) {
        setAnonymousKey(null);
        setUser(null);
        setStatus('unavailable');
        return;
      }
      setAnonymousKey(nextAnonymousKey);
      try {
        const userRequest = getRankingUser(nextAnonymousKey);
        const recordsRequest = getMyRecords(nextAnonymousKey).catch(() => null);
        const nextUser = await userRequest;
        if (nextUser.isRegistered) await recordsRequest;

        setUser(nextUser);
        setStatus('ready');
      } catch {
        // 서버 저장 성공으로 간주하지 않고, 오프라인 Outbox 보관을 허용하는 힌트로만 쓴다.
        const cachedUser = getCachedRegisteredRankingUser(nextAnonymousKey);
        setUser(cachedUser);
        setStatus(cachedUser ? 'cached' : 'unavailable');
      }
    } catch {
      setAnonymousKey(null);
      setUser(null);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  useEffect(() => {
    if (status !== 'cached') return;
    const handleOnline = () => void refresh();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh, status]);

  return { anonymousKey, user, setUser, status, refresh };
}
