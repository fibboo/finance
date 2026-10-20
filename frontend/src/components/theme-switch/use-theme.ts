import { useLayoutEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';

const themeSchema = z.enum(['system', 'light', 'dark']);

export type Theme = z.infer<typeof themeSchema>;

const STORAGE_KEY = 'theme';
const themeListeners = new Set<() => void>();
let unkeptTheme: Theme = 'system';

function subscribe(listener: () => void): () => void {
  themeListeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readTheme(): Theme {
  try {
    const storedTheme = themeSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    const theme = storedTheme.success ? storedTheme.data : 'system';

    return theme;
  } catch {
    return unkeptTheme;
  }
}

function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    unkeptTheme = theme;
  }

  themeListeners.forEach((listener) => {
    listener();
  });
}

export function useTheme(): { readonly theme: Theme; readonly setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, readTheme);

  useLayoutEffect(() => {
    if (theme === 'system') {
      delete document.documentElement.dataset['theme'];
    } else {
      document.documentElement.dataset['theme'] = theme;
    }
  }, [theme]);

  return { theme, setTheme };
}
