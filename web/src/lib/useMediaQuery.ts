import { useSyncExternalStore } from 'react';

/** Tailwind's `sm` breakpoint (40rem). */
export const SM_UP = '(min-width: 40rem)';

/** Whether `query` matches now, updating on change. Without matchMedia (tests) it reports a wide screen. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onChange => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => typeof window.matchMedia !== 'function' || window.matchMedia(query).matches,
    () => true,
  );
}
