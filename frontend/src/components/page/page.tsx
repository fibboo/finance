import type { ReactNode } from 'react';

import styles from './page.module.css';
import { useIsLogoShownOnPhone } from './use-is-logo-shown-on-phone';

type PageProps = Readonly<{ title: string; children?: ReactNode }>;

export function Page({ title, children }: PageProps) {
  const isLogoShownOnPhone = useIsLogoShownOnPhone();
  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        <h1
          className={`${styles['title'] ?? ''} ${isLogoShownOnPhone ? 'visually-hidden-on-phone' : ''}`}
        >
          {title}
        </h1>
      </div>
      <div className={styles['content']}>{children}</div>
    </div>
  );
}
