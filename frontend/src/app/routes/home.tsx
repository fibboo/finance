import { useQuery } from '@tanstack/react-query';

import { DetailsColumn } from '@/app/details-column';
import { useBaseCurrency } from '@/app/use-base-currency';
import { useShownAccount } from '@/app/use-shown-account';
import { Page } from '@/components/page/page';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { AccountList } from '@/features/accounts/components/account-list';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { MonthSummary } from '@/features/summary/components/month-summary';
import { TotalBalance } from '@/features/summary/components/total-balance';
import { readTopTransactionId } from '@/features/transactions/components/feed-transactions';
import { RecentTransactions } from '@/features/transactions/components/recent-transactions';
import { useTransactionFeed } from '@/features/transactions/hooks/use-transaction-feed';
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
  const feed = useTransactionFeed({
    isOpeningDayKept: false,
    isFirstPageErrorThrown: false,
    filterQuery: {},
  });
  const topTransactionId = readTopTransactionId(feed);
  const shownAccount = useShownAccount({
    defaultTransactionId: topTransactionId,
    firstAccountId: accountPage?.items[0]?.id,
  });
  const isRecentShown =
    !(feed.query.isError && feed.query.data === undefined) &&
    !(isDictionaryFailed && dictionaries === undefined);
  return (
    <Page title="Home">
      {baseCurrency !== undefined && (
        <div className={styles['home']}>
          <div className={styles['summaries']}>
            <AccountList
              baseCurrency={baseCurrency}
              chosenAccountId={shownAccount.chosenAccountId}
              defaultAccountId={shownAccount.defaultAccountId}
              header={<TotalBalance baseCurrency={baseCurrency} />}
            />
            <MonthSummary baseCurrency={baseCurrency} />
          </div>
          {isRecentShown && (
            <RecentTransactions
              feed={feed}
              topTransactionId={topTransactionId}
              baseCurrency={baseCurrency}
              transactionTypes={dictionaries?.transaction_types}
            />
          )}
          <div className={styles['details']}>
            <DetailsColumn
              baseCurrency={baseCurrency}
              defaultTransactionId={topTransactionId}
              shownAccount={shownAccount}
              accountCount={accountPage?.total}
              isAccountFirst
              isEntryParamOwnedByPage={false}
            />
          </div>
        </div>
      )}
    </Page>
  );
}
