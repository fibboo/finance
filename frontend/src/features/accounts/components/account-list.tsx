import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { formatMoney } from '@/lib/format-money';

import { accountQueries } from '../api/account-queries';
import { useFittingCount } from '../hooks/use-fitting-count';
import { AccountMark } from './account-mark';
import styles from './account-list.module.css';

const ACCOUNT_PAGE_SIZE = 100;
const SKELETON_ACCOUNTS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

type AccountListProps = Readonly<{ baseCurrency: string }>;

export function AccountList({ baseCurrency }: AccountListProps) {
  const { data: accountPage, isPending } = useQuery(
    accountQueries.list({ size: ACCOUNT_PAGE_SIZE }),
  );
  const { ref, count } = useFittingCount();
  const titleId = useId();
  if (isPending) {
    return (
      <section className={styles['accountList']} aria-labelledby={titleId} aria-busy="true">
        <h2 id={titleId} className={styles['title']}>
          Accounts <Skeleton className={styles['totalSkeleton']} />
        </h2>
        <ul ref={ref} className={styles['accounts']}>
          {SKELETON_ACCOUNTS.slice(0, count).map((account) => (
            <li key={account} className={styles['account']}>
              <Skeleton className={styles['markSkeleton']} />
              <span className={styles['identity']}>
                <Skeleton className={styles['nameSkeleton']} />
                <Skeleton className={styles['detailSkeleton']} />
              </span>
              <span className={styles['amounts']}>
                <Skeleton className={styles['balanceSkeleton']} />
                <Skeleton className={styles['detailSkeleton']} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (accountPage === undefined) {
    return null;
  }

  const largestAccounts = accountPage.items
    .toSorted(
      (first, second) => Number(second.base_currency_balance) - Number(first.base_currency_balance),
    )
    .slice(0, count);
  return (
    <section className={styles['accountList']} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles['title']}>
        Accounts <span className={styles['total']}>{accountPage.total}</span>
      </h2>
      <ul ref={ref} className={styles['accounts']}>
        {largestAccounts.map((account) => (
          <li key={account.id} className={styles['account']}>
            <AccountMark account={account} />
            <span className={styles['identity']}>
              <span className={styles['name']}>{account.name}</span>
              <span className={styles['detail']}>{account.currency}</span>
            </span>
            <span className={styles['amounts']}>
              <span className={styles['balance']}>
                {formatMoney({ amount: Number(account.balance), currency: account.currency })}
              </span>
              {account.currency !== baseCurrency && (
                <span className={styles['detail']}>
                  ≈{' '}
                  {formatMoney({
                    amount: Number(account.base_currency_balance),
                    currency: baseCurrency,
                  })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
