import { DependencyList, useEffect, useRef, useState } from 'react';

interface VisiblePollingOptions {
  enabled?: boolean;
  runImmediately?: boolean;
}

export const useVisiblePolling = (
  callback: () => void | Promise<void>,
  delayMs: number,
  deps: DependencyList = [],
  options: VisiblePollingOptions = {}
) => {
  const { enabled = true, runImmediately = true } = options;
  const callbackRef = useRef(callback);
  const depsKey = JSON.stringify(deps);
  const [isVisible, setIsVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible'
  );

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!enabled || !isVisible || delayMs <= 0) return undefined;

    if (runImmediately) {
      callbackRef.current();
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    }, delayMs);

    return () => window.clearInterval(interval);
  }, [delayMs, depsKey, enabled, isVisible, runImmediately]);
};
