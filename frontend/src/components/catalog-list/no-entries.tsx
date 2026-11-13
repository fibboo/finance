import type { ReactNode } from 'react';

import styles from './no-entries.module.css';

type NoEntriesProps = Readonly<{
  iconPath: string;
  title: string;
  text: string;
  children?: ReactNode;
}>;

export function NoEntries({ iconPath, title, text, children }: NoEntriesProps) {
  return (
    <div className={styles['noEntries']}>
      <span className={styles['iconBox']} aria-hidden="true">
        <svg className={styles['icon']} viewBox="0 0 24 24">
          <path d={iconPath} />
        </svg>
      </span>
      <p className={styles['title']}>{title}</p>
      <p className={styles['text']}>{text}</p>
      {children}
    </div>
  );
}
