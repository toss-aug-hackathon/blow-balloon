import { useCallback, useEffect, useState } from 'react';
import { getUserKeyForGame } from '@apps-in-toss/web-bridge';
import { getGameUser, type GameUser } from '../api/gameApi';

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

      setUserKey(keyResult.hash);
      setUser(await getGameUser(keyResult.hash));
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
