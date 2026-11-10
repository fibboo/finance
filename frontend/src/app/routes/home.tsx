import { useQuery } from '@tanstack/react-query';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { Page } from '@/components/page/page';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { AccountList } from '@/features/accounts/components/account-list';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MonthSummary } from '@/features/summary/components/month-summary';
import { TotalBalance } from '@/features/summary/components/total-balance';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './home.module.css';

export const handle = { isLogoShownOnPhone: true };

export function Component() {
  const baseCurrency = useBaseCurrency();
  const { data: accountPage } = useQuery(
    accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: [...MONEY_ACCOUNT_KINDS],
      order: 'recent_use',
    }),
  );
  const { data: dictionaries, isError: isDictionaryFailed } = useQuery(
    dictionaryQueries.accounting(),
  );
  return (
    <Page title="Home">
      {baseCurrency !== undefined && (
        <div className={styles['home']}>
          <div className={styles['summaries']}>
            <AccountList
              baseCurrency={baseCurrency}
              topAccountId={accountPage?.items[0]?.id}
              header={<TotalBalance baseCurrency={baseCurrency} />}
            />
            <MonthSummary baseCurrency={baseCurrency} />
          </div>
          {!(isDictionaryFailed && dictionaries === undefined) && (
            <RecentTransactions
              baseCurrency={baseCurrency}
              transactionTypes={dictionaries?.transaction_types}
              renderDetails={(topTransactionId) => (
                <div className={styles['details']}>
                  <DetailsColumn
                    baseCurrency={baseCurrency}
                    defaultTransactionId={topTransactionId}
                    defaultAccountId={accountPage?.items[0]?.id}
                    accountCount={accountPage?.total}
                    isAccountFirst
                  />
                </div>
              )}
            />
          )}
        </div>
      )}
    </Page>
  );
}
