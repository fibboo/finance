import { useSuspenseQuery } from '@tanstack/react-query';

import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { BaseCurrencyForm } from '@/features/user/components/base-currency-form';

import styles from './onboarding.module.css';

export function Component() {
  const { data: dictionaries } = useSuspenseQuery(dictionaryQueries.accounting());

  return (
    <main className={styles['onboarding']}>
      <p className={styles['logo']}>
        <span className={styles['logoMark']} aria-hidden="true" />
        finance
      </p>
      <div className={styles['intro']}>
        <h1 className={styles['title']}>Pick your base currency</h1>
        <p className={styles['text']}>
          Totals and monthly summaries are counted in it. We’ll open a Wallet in this currency.
        </p>
      </div>
      <BaseCurrencyForm currencies={dictionaries.currencies} />
    </main>
  );
}
