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
import { LOCATION_PAGE_SIZE, locationQueries } from '@/features/locations/api/location-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  type EntryTransactionType,
  readNewTransactionType,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';
import { ExpenseForm } from '@/features/transactions/components/expense-form';
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
  const isExpense = transactionType === 'EXPENSE';
  const { data: categories } = useQuery({
    ...accountQueries.list({ kinds: ['EXPENSE'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
    throwOnError: (_error, query) => query.state.data === undefined,
  });
  const { data: locations } = useQuery({
    ...locationQueries.list({ size: LOCATION_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
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

  function changeType(nextType: EntryTransactionType) {
    setSearchParams(writeNewTransactionType({ searchParams, transactionType: nextType }), {
      preventScrollReset: true,
      replace: true,
    });
  }

  const relatedQueryKeys = [accountQueries.all().queryKey, summaryQueries.current().queryKey];
  return (
    <Sheet label="New transaction" onClose={close}>
      {dictionaries === undefined || baseCurrency === undefined ? (
        <div className={styles['skeleton']} aria-busy="true">
          <Skeleton className={styles['titleSkeleton']} />
          <Skeleton className={styles['amountSkeleton']} />
          <Skeleton className={styles['rowsSkeleton']} />
        </div>
      ) : isExpense ? (
        <ExpenseForm
          transactionTypes={dictionaries.transaction_types}
          categoryTypes={dictionaries.category_types}
          currencies={dictionaries.currencies}
          moneyAccounts={moneyAccounts?.items}
          categories={categories?.items}
          locations={locations?.items}
          baseCurrency={baseCurrency}
          relatedQueryKeys={[...relatedQueryKeys, locationQueries.all().queryKey]}
          onTypeChange={changeType}
          onClose={close}
        />
      ) : (
        <TransactionForm
          transactionType={transactionType}
          transactionTypes={dictionaries.transaction_types}
          moneyAccounts={moneyAccounts?.items}
          baseCurrency={baseCurrency}
          relatedQueryKeys={relatedQueryKeys}
          onTypeChange={changeType}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
