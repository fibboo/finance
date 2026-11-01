import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { useBaseCurrency } from '@/app/use-base-currency';
import { Sheet } from '@/components/sheet/sheet';
import { Skeleton } from '@/components/skeleton/skeleton';
import {
  ACCOUNT_PAGE_SIZE,
  accountQueries,
  MONEY_ACCOUNT_KINDS,
} from '@/features/accounts/api/account-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  readNewTransactionType,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';
import { TransactionForm } from '@/features/transactions/components/transaction-form';

import styles from './new-transaction.module.css';

export function NewTransaction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const transactionType = readNewTransactionType(searchParams);
  const isOpen = transactionType !== undefined;
  const baseCurrency = useBaseCurrency();
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    enabled: isOpen,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  const { data: moneyAccounts } = useQuery({
    ...accountQueries.list({
      kinds: [...MONEY_ACCOUNT_KINDS],
      size: ACCOUNT_PAGE_SIZE,
      order: 'recent_use',
    }),
    enabled: isOpen,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  if (transactionType === undefined) {
    return null;
  }

  function close() {
    setSearchParams(writeNewTransactionType({ searchParams, transactionType: undefined }), {
      preventScrollReset: true,
    });
  }

  return (
    <Sheet label="New transaction" onClose={close}>
      {dictionaries === undefined || baseCurrency === undefined ? (
        <div className={styles['skeleton']} aria-busy="true">
          <Skeleton className={styles['titleSkeleton']} />
          <Skeleton className={styles['amountSkeleton']} />
          <Skeleton className={styles['rowsSkeleton']} />
        </div>
      ) : (
        <TransactionForm
          transactionType={transactionType}
          transactionTypes={dictionaries.transaction_types}
          moneyAccounts={moneyAccounts?.items}
          baseCurrency={baseCurrency}
          relatedQueryKeys={[accountQueries.all().queryKey, summaryQueries.current().queryKey]}
          onTypeChange={(nextType) => {
            setSearchParams(writeNewTransactionType({ searchParams, transactionType: nextType }), {
              preventScrollReset: true,
              replace: true,
            });
          }}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
