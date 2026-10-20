import { useLayoutEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';

const themeSchema = z.enum(['system', 'light', 'dark']);

export type Theme = z.infer<typeof themeSchema>;

const STORAGE_KEY = 'theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';
const themeListeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  themeListeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    themeListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readTheme(): Theme {
  const storedTheme = themeSchema.safeParse(localStorage.getItem(STORAGE_KEY));
  const theme = storedTheme.success ? storedTheme.data : 'system';

  return theme;
}

function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  themeListeners.forEach((listener) => {
    listener();
  });
}

export function useTheme(): { readonly theme: Theme; readonly setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, readTheme);

  useLayoutEffect(() => {
    const darkScheme = window.matchMedia(DARK_SCHEME_QUERY);

    function applyTheme() {
      const systemTheme = darkScheme.matches ? 'dark' : 'light';
      document.documentElement.dataset['theme'] = theme === 'system' ? systemTheme : theme;
    }

    applyTheme();
    darkScheme.addEventListener('change', applyTheme);

    return () => {
      darkScheme.removeEventListener('change', applyTheme);
    };
  }, [theme]);

  return { theme, setTheme };
}
