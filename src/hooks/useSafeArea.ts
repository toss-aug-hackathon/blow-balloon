import { useEffect } from 'react';
import { SafeArea } from '@apps-in-toss/web-framework';

const ZERO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function applyInsets(insets: typeof ZERO_INSETS): void {
  const root = document.documentElement;
  root.style.setProperty('--ait-safe-top', `${insets.top}px`);
  root.style.setProperty('--ait-safe-right', `${insets.right}px`);
  root.style.setProperty('--ait-safe-bottom', `${insets.bottom}px`);
  root.style.setProperty('--ait-safe-left', `${insets.left}px`);
}

export function useSafeArea(): void {
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      applyInsets(SafeArea.get());
      unsubscribe = SafeArea.subscribe({ onEvent: applyInsets });
    } catch {
      applyInsets(ZERO_INSETS);
    }
    return () => unsubscribe?.();
  }, []);
}
