import { Link, Outlet } from 'react-router';

import styles from './app-layout.module.css';
import { MainNavigation } from './main-navigation';

import { AccountMenu } from '@/components/account-menu/account-menu';
import { ThemeSwitch } from '@/components/theme-switch/theme-switch';

export function AppLayout() {
  return (
    <div className={styles['appLayout']}>
      <header className={styles['header']}>
        <Link to="/" className={styles['logo']}>
          <span className={styles['logoMark']} aria-hidden="true" />
          finance
        </Link>
        <div className={styles['account']}>
          <AccountMenu>
            <ThemeSwitch />
          </AccountMenu>
        </div>
      </header>
      <div className={styles['navigation']}>
        <MainNavigation />
      </div>
      <main className={styles['main']}>
        <Outlet />
      </main>
    </div>
  );
}
