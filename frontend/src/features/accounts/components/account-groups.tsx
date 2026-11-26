import { Link, useSearchParams } from 'react-router';

import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import { Skeleton } from '@/components/skeleton/skeleton';
import { listSkeletonKeys } from '@/components/skeleton/skeleton-keys';
import { useArrowKeySelection } from '@/hooks/use-arrow-key-selection';
import type { components } from '@/lib/api-schema';
import { readClassificationLabel } from '@/lib/classification-label';
import { formatMoney } from '@/lib/format-money';

import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '../api/selected-account';
import { readEstimatedBaseBalance } from './account-estimate';
import type { Classification } from '../api/classification-queries';
import { AccountMark } from './account-mark';
import styles from './account-groups.module.css';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];

const ACCOUNT_SKELETON_COUNT = 3;

type AccountGroupsProps = Readonly<{
  accounts: readonly Account[] | undefined;
  classifications: readonly Classification[] | undefined;
  hasTypeFilters?: boolean;
  topAccountId: string | undefined;
  baseCurrency: string;
  listSearchParams: URLSearchParams;
  isParamIgnored: boolean;
}>;

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

export function AccountGroups({
  accounts,
  classifications,
  hasTypeFilters = false,
  topAccountId,
  baseCurrency,
  listSearchParams,
  isParamIgnored,
}: AccountGroupsProps) {
  const [searchParams] = useSearchParams();
  const arrowKeySelection = useArrowKeySelection({
    list: 'accounts',
    orientation: 'vertical',
    isFocusRequired: false,
  });
  const selectedAccountId = isParamIgnored ? undefined : readSelectedAccountId(searchParams);
  return (
    <section
      className={[styles['accountGroups'], hasTypeFilters ? styles['withTypeFilters'] : undefined]
        .filter(Boolean)
        .join(' ')}
      aria-label={accounts === undefined ? undefined : 'Account balances'}
      aria-busy={accounts === undefined}
    >
      <div className={styles['columns']} aria-hidden="true">
        <span>Account</span>
        <span className={styles['amountColumn']}>In {baseCurrency}</span>
      </div>
      {accounts === undefined && (
        <ul className={styles['accounts']}>
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
      {accounts !== undefined && (
        <ul className={styles['accounts']}>
          {accounts.map((account) => {
            if (account.currency === null) return null;
            const hasDescription = account.description != null && account.description !== '';
            const classificationLabel = readClassificationLabel({
              classifications,
              classificationId: account.classification_id,
            });
            const rateText = readAccountRateText({ account, baseCurrency });
            const estimatedBaseBalance = readEstimatedBaseBalance(account);
            const isShownByDefault = selectedAccountId === undefined && account.id === topAccountId;
            return (
              <li
                key={account.id}
                className={readAccountClassName({
                  account,
                  isSelected: account.id === selectedAccountId,
                  isShownByDefault,
                })}
              >
                <AccountMark account={account} />
                <span className={styles['identity']}>
                  <Link
                    {...arrowKeySelection}
                    data-shown-by-default={isShownByDefault ? '' : undefined}
                    id={readAccountLinkId(account.id)}
                    to={{
                      search: writeSelectedAccount({
                        searchParams: listSearchParams,
                        accountId: account.id,
                      }).toString(),
                    }}
                    preventScrollReset
                    aria-current={account.id === selectedAccountId ? 'true' : undefined}
                    aria-label={hasDescription ? account.name : undefined}
                    className={styles['name']}
                  >
                    <span className={styles['nameLabel']}>{account.name}</span>
                    {hasDescription && (
                      <span className={styles['description']}> {account.description}</span>
                    )}
                  </Link>
                  <span className={styles['currency']}>
                    {classificationLabel !== undefined && (
                      <span className={styles['typeLabel']}>{classificationLabel}</span>
                    )}
                    <span className={styles['currencySuffix']}>
                      {classificationLabel !== undefined && ' · '}
                      {account.currency}
                      {rateText !== undefined && ` · ${rateText}`}
                    </span>
                  </span>
                </span>
                <span className={styles['balance']}>
                  {estimatedBaseBalance === null ? (
                    formatMoney({
                      amount: Number(account.base_currency_balance),
                      currency: baseCurrency,
                    })
                  ) : (
                    <EstimatedAmount amount={estimatedBaseBalance} currency={baseCurrency} />
                  )}
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
      )}
    </section>
  );
}
