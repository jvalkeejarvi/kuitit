import { useCallback, useEffect, useSyncExternalStore } from 'react';

export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

/** The toggle's order: light -> dark -> system -> light. */
export function nextTheme(theme: Theme): Theme {
  return theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
}

const storageKey = 'kuitit.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey);
    return themes.includes(stored as Theme) ? (stored as Theme) : 'system';
  } catch {
    return 'system';
  }
}

/** Sets the `dark` class Tailwind's dark variant keys off. Also run inline in index.html to avoid a flash. */
export function applyTheme(theme: Theme = readTheme()): void {
  const dark = theme === 'dark' || (theme === 'system' && media().matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const query = media();
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // Private mode etc.: the choice just isn't remembered.
    }
    listeners.forEach(l => l());
  }, []);

  return [theme, setTheme];
}
