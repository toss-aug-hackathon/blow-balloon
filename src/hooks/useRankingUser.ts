import { useCallback, useEffect, useState } from 'react';
import { getAnonymousKey } from '@apps-in-toss/web-bridge';
import {
  getRankingUser,
  getMyRecords,
  type RankingUser,
} from '../api/rankingApi';
import { extractAnonymousKey } from '../utils/anonymousIdentity';

export type RankingUserStatus = 'loading' | 'ready' | 'unavailable';

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

      const userRequest = getRankingUser(nextAnonymousKey);
      const recordsRequest = getMyRecords(nextAnonymousKey).catch(() => null);
      const nextUser = await userRequest;
      if (nextUser.isRegistered) await recordsRequest;

      setAnonymousKey(nextAnonymousKey);
      setUser(nextUser);
      setStatus('ready');
    } catch {
      setAnonymousKey(null);
      setUser(null);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  return { anonymousKey, user, setUser, status, refresh };
}
