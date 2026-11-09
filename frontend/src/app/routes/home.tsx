import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { SelectedAccountDetails } from '@/app/selected-account-details';
import { SelectedTransactionDetails } from '@/app/selected-transaction-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { SELECTED_ACCOUNT_PARAM } from '@/features/accounts/api/selected-account';
import { AccountList } from '@/features/accounts/components/account-list';
import { MonthSummary } from '@/features/summary/components/month-summary';
import { TotalBalance } from '@/features/summary/components/total-balance';
import { SELECTED_TRANSACTION_PARAM } from '@/features/transactions/api/selected-transaction';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './home.module.css';

export const handle = { isLogoShownOnPhone: true };

function readIsAccountOpenedLast(searchParams: URLSearchParams): boolean {
  const keys = [...searchParams.keys()];
  const isAccountOpenedLast =
    keys.indexOf(SELECTED_ACCOUNT_PARAM) > keys.indexOf(SELECTED_TRANSACTION_PARAM);
  return isAccountOpenedLast;
}

export function Component() {
  const baseCurrency = useBaseCurrency();
  const [searchParams] = useSearchParams();
  const { data: accountPage } = useQuery(
    accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: [...MONEY_ACCOUNT_KINDS] }),
  );
  const isAccountOpenedLast = readIsAccountOpenedLast(searchParams);
  return (
    <Page title="Home">
      {baseCurrency !== undefined && (
        <>
          <div className={styles['overview']}>
            <div className={styles['summaries']}>
              <AccountList
                baseCurrency={baseCurrency}
                header={<TotalBalance baseCurrency={baseCurrency} />}
              />
              <MonthSummary baseCurrency={baseCurrency} />
            </div>
            <div className={isAccountOpenedLast ? styles['selection'] : styles['earlierSelection']}>
              <SelectedAccountDetails
                baseCurrency={baseCurrency}
                accountCount={accountPage?.total}
              />
            </div>
          </div>
          <div className={styles['transactions']}>
            <RecentTransactions baseCurrency={baseCurrency} />
            <div className={isAccountOpenedLast ? styles['earlierSelection'] : styles['selection']}>
              <SelectedTransactionDetails baseCurrency={baseCurrency} />
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
