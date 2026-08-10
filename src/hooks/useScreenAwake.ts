import { useEffect } from 'react';
import { Screen } from '@apps-in-toss/web-framework';

export function useScreenAwake(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    try {
      void Screen.setAwakeMode({ enabled: true }).catch(() => undefined);
    } catch {
      // 일반 브라우저에서는 Apps in Toss 브리지가 없을 수 있어요.
    }
    return () => {
      try {
        void Screen.setAwakeMode({ enabled: false }).catch(() => undefined);
      } catch {
        // 일반 브라우저에서는 복구할 브리지 상태가 없어요.
      }
    };
  }, [enabled]);
}
