import { useCallback, useEffect, useState } from 'react';
import { getUserKeyForGame } from '@apps-in-toss/web-bridge';
import {
  getGameUser,
  getMyRecords,
  type GameUser,
} from '../api/gameApi';

export type GameUserStatus = 'loading' | 'ready' | 'unavailable';

export function useGameUser() {
  const [userKey, setUserKey] = useState<string | null>(null);
  const [user, setUser] = useState<GameUser | null>(null);
  const [status, setStatus] = useState<GameUserStatus>('loading');

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const keyResult = await getUserKeyForGame();
      if (
        !keyResult ||
        keyResult === 'INVALID_CATEGORY' ||
        keyResult === 'ERROR'
      ) {
        setUserKey(null);
        setUser(null);
        setStatus('unavailable');
        return;
      }

      const userRequest = getGameUser(keyResult.hash);
      const recordsRequest = getMyRecords(keyResult.hash).catch(() => null);
      const nextUser = await userRequest;
      if (nextUser.isRegistered) await recordsRequest;

      setUserKey(keyResult.hash);
      setUser(nextUser);
      setStatus('ready');
    } catch {
      setUserKey(null);
      setUser(null);
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  return { userKey, user, setUser, status, refresh };
}
