import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { formatMoney } from '@/lib/format-money';

import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';
import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '../api/selected-account';
import { useStripEdges } from '../hooks/use-strip-edges';
import { AccountMark } from './account-mark';
import styles from './account-list.module.css';

const ACCOUNT_SKELETON_COUNT = 3;
const STRIP_PAGE_SHARE = 0.8;

type AccountListProps = Readonly<{ baseCurrency: string; header?: ReactNode }>;

export function AccountList({ baseCurrency, header }: AccountListProps) {
  const { data: accountPage, isPending } = useQuery(
    accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: [...MONEY_ACCOUNT_KINDS] }),
  );
  const [searchParams] = useSearchParams();
  const selectedAccountId = readSelectedAccountId(searchParams);
  const accountsRef = useRef<HTMLUListElement>(null);
  const { observeFirst, observeLast, isFirstInView, isLastInView } = useStripEdges();
  const isFailed = !isPending && accountPage === undefined;
  if (isFailed && header === undefined) {
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
      <div className={styles['header']}>
        {header}
        <Link to="/accounts" className={styles['allLink']}>
          All
        </Link>
      </div>
      {!isFailed && (
        <div className={styles['strip']}>
          {accounts.length > 1 && !isFirstInView && (
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
                  index === 0
                    ? observeFirst
                    : index === accounts.length - 1
                      ? observeLast
                      : undefined
                }
                className={styles['accountItem']}
              >
                <Link
                  id={readAccountLinkId(account.id)}
                  to={{
                    search: writeSelectedAccount({
                      searchParams,
                      accountId: account.id,
                    }).toString(),
                  }}
                  preventScrollReset
                  aria-current={account.id === selectedAccountId ? 'true' : undefined}
                  className={`${styles['account'] ?? ''} ${account.id === selectedAccountId ? (styles['selected'] ?? '') : ''}`}
                >
                  <AccountMark account={account} />
                  <span className={styles['identity']}>
                    <span className={styles['name']}>{account.name}</span>
                    <span className={styles['detail']}>{account.currency}</span>
                  </span>
                  <span
                    className={
                      Number(account.balance) < 0 ? styles['debtAmounts'] : styles['amounts']
                    }
                  >
                    <span className={styles['balance']}>
                      {formatMoney({
                        amount: Number(account.base_currency_balance),
                        currency: baseCurrency,
                      })}
                    </span>
                    {account.currency !== baseCurrency && (
                      <span className={styles['accountBalance']}>
                        {formatMoney({
                          amount: Number(account.balance),
                          currency: account.currency,
                        })}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {accounts.length > 1 && !isLastInView && (
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
      )}
    </section>
  );
}
