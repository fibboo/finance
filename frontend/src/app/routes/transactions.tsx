import { useQuery } from '@tanstack/react-query';

import { TransactionFeed } from '@/features/transactions/components/transaction-feed';
import { userQueries } from '@/features/user/api/user-queries';

import styles from './transactions.module.css';

export function Component() {
  const { data: user } = useQuery(userQueries.me());
  if (user?.base_currency === null) {
    throw new Error('The signed-in user has no base currency yet.');
  }

  const baseCurrency = user?.base_currency;
  return (
    <div className={styles['transactions']}>
      <h1 className={styles['title']}>Transactions</h1>
      {baseCurrency !== undefined && <TransactionFeed baseCurrency={baseCurrency} />}
    </div>
  );
}
