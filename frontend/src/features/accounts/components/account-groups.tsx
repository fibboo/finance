import { Link, useSearchParams } from 'react-router';

import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import type { MoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '../api/selected-account';
import { readAccountGroups } from './account-grouping';
import { AccountMark } from './account-mark';
import styles from './account-groups.module.css';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];

const ACCOUNT_SKELETON_COUNT = 3;

const GROUP_HEADINGS = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
} satisfies Readonly<Record<MoneyAccountKind, string>>;

type AccountGroupsProps = Readonly<{
  accounts: readonly Account[] | undefined;
  topAccountId: string | undefined;
  baseCurrency: string;
}>;

function sumBaseCurrencyBalances(accounts: readonly Account[]): number {
  const total = accounts.reduce((sum, account) => sum + Number(account.base_currency_balance), 0);
  return total;
}

function readAccountClassName({
  account,
  isSelected,
  isShownByDefault,
}: Readonly<{ account: Account; isSelected: boolean; isShownByDefault: boolean }>): string {
  const accountClassName = [
    styles['account'],
    Number(account.balance) < 0 ? styles['debtAccount'] : undefined,
    isSelected ? styles['selected'] : undefined,
    isShownByDefault ? styles['shownByDefault'] : undefined,
  ]
    .filter((className) => className !== undefined)
    .join(' ');
  return accountClassName;
}

export function AccountGroups({ accounts, topAccountId, baseCurrency }: AccountGroupsProps) {
  const [searchParams] = useSearchParams();
  const selectedAccountId = readSelectedAccountId(searchParams);
  const groups = readAccountGroups(accounts ?? []);
  return (
    <div className={styles['accountGroups']} aria-busy={accounts === undefined}>
      <div className={styles['columns']} aria-hidden="true">
        <span>Account</span>
        <span className={styles['amountColumn']}>In {baseCurrency}</span>
      </div>
      {accounts === undefined && (
        <ul className={styles['group']}>
          {listSkeletonKeys(ACCOUNT_SKELETON_COUNT).map((key) => (
            <li key={key} className={styles['account']}>
              <Skeleton className={styles['markSkeleton']} />
              <span className={styles['identity']}>
                <Skeleton className={styles['nameSkeleton']} />
              </span>
              <Skeleton className={styles['balanceSkeleton']} />
            </li>
          ))}
        </ul>
      )}
      {groups.map((group) => {
        const total = sumBaseCurrencyBalances(group.accounts);
        return (
          <section
            key={group.kind}
            className={styles['group']}
            aria-labelledby={`account-group-${group.kind}`}
          >
            <div className={styles['groupHeader']}>
              <h2 id={`account-group-${group.kind}`} className={styles['groupHeading']}>
                {GROUP_HEADINGS[group.kind]}
              </h2>
              <span className={total < 0 ? styles['debt'] : undefined}>
                {formatMoney({ amount: total, currency: baseCurrency })}
              </span>
            </div>
            <ul className={styles['accounts']}>
              {group.accounts.map((account) => {
                const rateText = readAccountRateText({ account, baseCurrency });
                return (
                  <li
                    key={account.id}
                    className={readAccountClassName({
                      account,
                      isSelected: account.id === selectedAccountId,
                      isShownByDefault:
                        selectedAccountId === undefined && account.id === topAccountId,
                    })}
                  >
                    <AccountMark account={account} />
                    <span className={styles['identity']}>
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
                        className={styles['name']}
                      >
                        {account.name}
                      </Link>
                      <span className={styles['currency']}>
                        {account.currency}
                        {rateText !== undefined && ` · ${rateText}`}
                      </span>
                    </span>
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
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
