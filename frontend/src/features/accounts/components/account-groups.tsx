import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { AccountMark } from './account-mark';
import styles from './account-groups.module.css';

type Account = components['schemas']['Account'];
type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];

const ACCOUNT_SKELETON_COUNT = 3;

const GROUP_HEADINGS = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
} satisfies Readonly<Record<MoneyAccountKind, string>>;

type AccountGroupsProps = Readonly<{
  accounts: readonly Account[] | undefined;
  baseCurrency: string;
}>;

function readGroupAccounts({
  accounts,
  kind,
}: Readonly<{ accounts: readonly Account[]; kind: MoneyAccountKind }>) {
  const groupAccounts = accounts
    .flatMap((account) =>
      account.kind === kind && account.currency !== null
        ? [{ ...account, currency: account.currency }]
        : [],
    )
    .toSorted(
      (first, second) =>
        Math.abs(Number(second.base_currency_balance)) -
        Math.abs(Number(first.base_currency_balance)),
    );
  return groupAccounts;
}

function sumBaseCurrencyBalances(accounts: readonly Account[]): number {
  const total = accounts.reduce((sum, account) => sum + Number(account.base_currency_balance), 0);
  return total;
}

export function AccountGroups({ accounts, baseCurrency }: AccountGroupsProps) {
  const groups = MONEY_ACCOUNT_KINDS.map((kind) => ({
    kind,
    accounts: accounts === undefined ? [] : readGroupAccounts({ accounts, kind }),
  })).filter((group) => group.accounts.length > 0);
  return (
    <div className={styles['accountGroups']} aria-busy={accounts === undefined}>
      <div className={styles['columns']} aria-hidden="true">
        <span className={styles['accountColumn']}>Account</span>
        <span className={styles['amountColumn']}>Balance</span>
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
              {group.accounts.map((account) => (
                <li key={account.id} className={styles['account']}>
                  <AccountMark account={account} />
                  <span className={styles['identity']}>
                    <span className={styles['name']}>{account.name}</span>
                    <span className={styles['currency']}>{account.currency}</span>
                  </span>
                  <span
                    className={`${styles['balance'] ?? ''} ${Number(account.base_currency_balance) < 0 ? (styles['debt'] ?? '') : ''}`}
                  >
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
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
