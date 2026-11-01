import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from 'react-router';

import styles from './app-layout.module.css';
import { MainNavigation } from './main-navigation';

import { AccountMenu } from '@/components/account-menu/account-menu';
import { Logo } from '@/components/logo/logo';
import { useIsLogoShownOnPhone } from '@/components/page/use-is-logo-shown-on-phone';
import { ThemeSwitch } from '@/components/theme-switch/theme-switch';
import { startLink } from '@/features/auth/api/link-provider';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { LinkedProviders } from '@/features/user/components/linked-providers';
import { UserInitials } from '@/features/user/components/user-initials';
import { UserSummary } from '@/features/user/components/user-summary';

export function AppLayout() {
  const isLogoShownOnPhone = useIsLogoShownOnPhone();
  const { data: userDictionaries } = useQuery(dictionaryQueries.user());

  return (
    <div className={styles['appLayout']}>
      <header className={styles['header']}>
        <Link
          to="/"
          className={isLogoShownOnPhone ? styles['logoLinkOnPhone'] : styles['logoLink']}
        >
          <Logo />
        </Link>
        <div className={styles['account']}>
          <AccountMenu avatar={<UserInitials />}>
            {userDictionaries !== undefined && (
              <>
                <UserSummary providerTypes={userDictionaries.provider_types} />
                <LinkedProviders
                  providerTypes={userDictionaries.provider_types}
                  startLink={startLink}
                />
              </>
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
