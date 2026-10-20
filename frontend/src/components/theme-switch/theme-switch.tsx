import { useId } from 'react';

import styles from './theme-switch.module.css';
import { type Theme, useTheme } from './use-theme';

const THEME_OPTIONS = [
  { theme: 'system', label: 'System', iconPath: 'M3 4h18v12H3zM8 20h8M12 16v4' },
  {
    theme: 'light',
    label: 'Light',
    iconPath:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  },
  { theme: 'dark', label: 'Dark', iconPath: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' },
] as const satisfies readonly { theme: Theme; label: string; iconPath: string }[];

export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  const name = useId();

  return (
    <fieldset className={styles['themeSwitch']}>
      <legend className={styles['legend']}>Theme</legend>
      <div className={styles['track']}>
        {THEME_OPTIONS.map((option) => (
          <label key={option.theme} className={styles['option']}>
            <input
              type="radio"
              name={name}
              className={styles['input']}
              checked={theme === option.theme}
              onChange={() => {
                setTheme(option.theme);
              }}
            />
            <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
              <path d={option.iconPath} />
            </svg>
            {option.label}
          </label>
        ))}
      </div>
      <p className={styles['hint']}>
        {theme === 'system' ? 'Follows your device setting.' : 'Kept on this device.'}
      </p>
    </fieldset>
  );
}
