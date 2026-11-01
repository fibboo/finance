import { SelectedTransactionDetails } from '@/app/selected-transaction-details';
import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { AccountList } from '@/features/accounts/components/account-list';
import { MonthSummary } from '@/features/summary/components/month-summary';
import { TotalBalance } from '@/features/summary/components/total-balance';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';

import styles from './home.module.css';

export const handle = { isLogoShownOnPhone: true };

export function Component() {
  const baseCurrency = useBaseCurrency();
  return (
    <Page title="Home">
      {baseCurrency !== undefined && (
        <>
          <AccountList
            baseCurrency={baseCurrency}
            header={<TotalBalance baseCurrency={baseCurrency} />}
          />
          <MonthSummary baseCurrency={baseCurrency} />
          <div className={styles['transactions']}>
            <RecentTransactions baseCurrency={baseCurrency} />
            <SelectedTransactionDetails baseCurrency={baseCurrency} />
          </div>
        </>
      )}
    </Page>
  );
}
