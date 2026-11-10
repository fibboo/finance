import type { ReactNode } from 'react';

import styles from './action-bar.module.css';

type ActionBarProps = Readonly<{
  children: ReactNode;
}>;

export function ActionBar({ children }: ActionBarProps) {
  return <div className={styles['actionBar']}>{children}</div>;
}
