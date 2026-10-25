import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';

import { BaseAmountEstimate } from '@/components/base-amount-estimate/base-amount-estimate';
import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { formatMoney } from '@/lib/format-money';

import { accountQueries } from '../api/account-queries';
import { useFittingCount } from '../hooks/use-fitting-count';
import { AccountMark } from './account-mark';
import styles from './account-list.module.css';

const ACCOUNT_PAGE_SIZE = 100;

type AccountListProps = Readonly<{ baseCurrency: string }>;

export function AccountList({ baseCurrency }: AccountListProps) {
  const { data: accountPage, isPending } = useQuery(
    accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: ['ASSET', 'LIABILITY'] }),
  );
  const { ref, count } = useFittingCount();
  const titleId = useId();
  if (!isPending && accountPage === undefined) {
    return null;
  }

  const largestAccounts = (accountPage?.items ?? [])
    .flatMap((account) =>
      account.currency === null ? [] : [{ ...account, currency: account.currency }],
    )
    .toSorted(
      (first, second) => Number(second.base_currency_balance) - Number(first.base_currency_balance),
    )
    .slice(0, count);
  return (
    <section className={styles['accountList']} aria-labelledby={titleId} aria-busy={isPending}>
      <h2 id={titleId} className={styles['title']}>
        Accounts{' '}
        {accountPage === undefined ? (
          <Skeleton className={styles['totalSkeleton']} />
        ) : (
          <span className={styles['total']}>{accountPage.total}</span>
        )}
      </h2>
      <ul ref={ref} className={styles['accounts']}>
        {accountPage === undefined &&
          listSkeletonKeys(count).map((key) => (
            <li key={key} className={styles['account']}>
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
                <BaseAmountEstimate
                  amount={Number(account.base_currency_balance)}
                  currency={baseCurrency}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
