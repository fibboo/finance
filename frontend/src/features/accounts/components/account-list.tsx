import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useRef } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { formatMoney } from '@/lib/format-money';

import { accountQueries } from '../api/account-queries';
import { useStripEdges } from '../hooks/use-strip-edges';
import { AccountMark } from './account-mark';
import styles from './account-list.module.css';

const ACCOUNT_PAGE_SIZE = 100;
const ACCOUNT_SKELETON_COUNT = 3;
const STRIP_PAGE_SHARE = 0.8;

type AccountListProps = Readonly<{ baseCurrency: string; header?: ReactNode }>;

export function AccountList({ baseCurrency, header }: AccountListProps) {
  const { data: accountPage, isPending } = useQuery(
    accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: ['ASSET', 'LIABILITY'] }),
  );
  const accountsRef = useRef<HTMLUListElement>(null);
  const { observeFirst, observeLast, isFirstInView, isLastInView } = useStripEdges();
  if (!isPending && accountPage === undefined) {
    return null;
  }

  function scrollStrip(direction: number) {
    const strip = accountsRef.current;
    strip?.scrollBy({ left: direction * strip.clientWidth * STRIP_PAGE_SHARE, behavior: 'smooth' });
  }

  const accounts = (accountPage?.items ?? [])
    .flatMap((account) =>
      account.currency === null ? [] : [{ ...account, currency: account.currency }],
    )
    .toSorted(
      (first, second) => Number(second.base_currency_balance) - Number(first.base_currency_balance),
    );
  return (
    <section className={styles['accountList']} aria-label="Accounts" aria-busy={isPending}>
      {header !== undefined && <div className={styles['header']}>{header}</div>}
      <div className={styles['strip']}>
        {!isFirstInView && (
          <button
            type="button"
            className={styles['previous']}
            aria-label="Previous accounts"
            onClick={() => {
              scrollStrip(-1);
            }}
          >
            ‹
          </button>
        )}
        <ul ref={accountsRef} className={styles['accounts']}>
          {accountPage === undefined &&
            listSkeletonKeys(ACCOUNT_SKELETON_COUNT).map((key) => (
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
          {accounts.map((account, index) => (
            <li
              key={account.id}
              ref={
                index === 0 ? observeFirst : index === accounts.length - 1 ? observeLast : undefined
              }
              className={styles['account']}
            >
              <AccountMark account={account} />
              <span className={styles['identity']}>
                <span className={styles['name']}>{account.name}</span>
                <span className={styles['detail']}>{account.currency}</span>
              </span>
              <span
                className={Number(account.balance) < 0 ? styles['debtAmounts'] : styles['amounts']}
              >
                <span className={styles['balance']}>
                  {formatMoney({
                    amount: Number(account.base_currency_balance),
                    currency: baseCurrency,
                  })}
                </span>
                {account.currency !== baseCurrency && (
                  <span className={styles['accountBalance']}>
                    {formatMoney({ amount: Number(account.balance), currency: account.currency })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        {!isLastInView && (
          <button
            type="button"
            className={styles['next']}
            aria-label="Next accounts"
            onClick={() => {
              scrollStrip(1);
            }}
          >
            ›
          </button>
        )}
      </div>
    </section>
  );
}
