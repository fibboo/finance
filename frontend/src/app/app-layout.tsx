import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router';

import styles from './app-layout.module.css';
import { MainNavigation } from './main-navigation';

import { AccountMenu } from '@/components/account-menu/account-menu';
import { Logo } from '@/components/logo/logo';
import { ThemeSwitch } from '@/components/theme-switch/theme-switch';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { UserInitials } from '@/features/user/components/user-initials';
import { UserSummary } from '@/features/user/components/user-summary';

export function AppLayout() {
  const { data: userDictionaries } = useQuery(dictionaryQueries.user());

  return (
    <div className={styles['appLayout']}>
      <header className={styles['header']}>
        <Link to="/" className={styles['logoLink']}>
          <Logo />
        </Link>
        <div className={styles['account']}>
          <AccountMenu avatar={<UserInitials />}>
            {userDictionaries !== undefined && (
              <UserSummary providerTypes={userDictionaries.provider_types} />
            )}
            <ThemeSwitch />
            <SignOutButton />
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
