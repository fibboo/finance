import { useQuery } from '@tanstack/react-query';

import { Logo } from '@/components/logo/logo';
import { SignOutButton } from '@/features/auth/components/sign-out-button';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { BaseCurrencyForm } from '@/features/user/components/base-currency-form';

import styles from './onboarding.module.css';

export function Component() {
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });

  return (
    <main className={styles['onboarding']}>
      <BaseCurrencyForm
        copy={
          <>
            <header className={styles['header']}>
              <Logo />
              <SignOutButton appearance="text" />
            </header>
            <div className={styles['intro']}>
              <h1 className={styles['title']}>Set up your account</h1>
            </div>
          </>
        }
        currencies={dictionaries?.currencies}
      />
    </main>
  );
}
