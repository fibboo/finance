import type { ReactNode } from 'react';

import styles from './page.module.css';

type PageProps = Readonly<{ title: string; children?: ReactNode }>;

export function Page({ title, children }: PageProps) {
  return (
    <div className={styles['page']}>
      <h1 className={styles['title']}>{title}</h1>
      <div className={styles['content']}>{children}</div>
    </div>
  );
}
