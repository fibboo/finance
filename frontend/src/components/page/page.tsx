import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Logo } from '@/components/logo/logo';

import styles from './page.module.css';

type PageProps = Readonly<{
  title: string;
  count?: number | undefined;
  isLogoShownOnPhone?: boolean;
  children?: ReactNode;
}>;

export function Page({ title, count, isLogoShownOnPhone = false, children }: PageProps) {
  return (
    <div className={styles['page']}>
      <div className={styles['header']}>
        {isLogoShownOnPhone && (
          <Link to="/" className={styles['phoneLogo']}>
            <Logo />
          </Link>
        )}
        <h1 className={isLogoShownOnPhone ? styles['desktopTitle'] : styles['title']}>
          {title}
          {count !== undefined && (
            <>
              {' '}
              <span className={styles['count']}>{count}</span>
            </>
          )}
        </h1>
      </div>
      <div className={styles['content']}>{children}</div>
    </div>
  );
}
