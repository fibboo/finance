import type { ReactNode } from 'react';

import { LOCALE } from '@/lib/format-money';

import styles from './page.module.css';

type PageProps = Readonly<{
  title: string;
  count?: Readonly<{ value: number; label: string }> | undefined;
  isTitleHiddenOnPhone?: boolean;
  children?: ReactNode;
}>;

export function Page({ title, count, isTitleHiddenOnPhone = false, children }: PageProps) {
  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        <h1
          className={`${styles['title'] ?? ''} ${isTitleHiddenOnPhone ? 'visually-hidden-on-phone' : ''}`}
        >
          {title}
          {count !== undefined && (
            <>
              <span className={styles['count']} aria-hidden="true">
                {new Intl.NumberFormat(LOCALE).format(count.value)}
              </span>
              <span className="visually-hidden">
                , {count.value} {count.label}
              </span>
            </>
          )}
        </h1>
      </div>
      <div className={styles['content']}>{children}</div>
    </div>
  );
}
