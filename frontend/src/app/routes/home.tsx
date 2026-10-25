import { useQuery } from '@tanstack/react-query';

import { AccountList } from '@/features/accounts/components/account-list';
import { BalancePanel } from '@/features/summary/components/balance-panel';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';
import { userQueries } from '@/features/user/api/user-queries';

import styles from './home.module.css';

export function Component() {
  const { data: user } = useQuery(userQueries.me());
  if (user?.base_currency === null) {
    throw new Error('The signed-in user has no base currency yet.');
  }

  const baseCurrency = user?.base_currency;
  return (
    <div className={styles['home']}>
      <h1 className={styles['title']}>Home</h1>
      {baseCurrency !== undefined && (
        <>
          <BalancePanel baseCurrency={baseCurrency} />
          <AccountList baseCurrency={baseCurrency} />
          <RecentTransactions baseCurrency={baseCurrency} />
        </>
      )}
    </div>
  );
}
