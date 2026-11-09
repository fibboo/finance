import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { useBaseCurrency } from '@/app/use-base-currency';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { Sheet } from '@/components/sheet/sheet';
import { Skeleton } from '@/components/skeleton/skeleton';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { IncomeSourceForm } from '@/features/accounts/components/income-source-form';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { LOCATION_PAGE_SIZE, locationQueries } from '@/features/locations/api/location-queries';
import { LocationForm } from '@/features/locations/components/location-form';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  type EntryTransactionType,
  readNewTransactionAccountId,
  readNewTransactionType,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';
import { MovementForm } from '@/features/transactions/components/movement-form';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { isThrownWithoutData } from '@/lib/query-meta';

import styles from './new-transaction.module.css';

export function NewTransaction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const transactionType = readNewTransactionType(searchParams);
  const isOpen = transactionType !== undefined;
  const baseCurrency = useBaseCurrency();
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    enabled: isOpen,
    throwOnError: isThrownWithoutData,
  });
  const { data: moneyAccounts } = useQuery({
    ...accountQueries.list({
      kinds: [...MONEY_ACCOUNT_KINDS],
      size: ACCOUNT_PAGE_SIZE,
      order: 'recent_use',
    }),
    enabled: isOpen,
    throwOnError: isThrownWithoutData,
  });
  const isExpense = transactionType === 'EXPENSE';
  const { data: categories } = useQuery({
    ...accountQueries.list({ kinds: ['EXPENSE'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
    throwOnError: isThrownWithoutData,
  });
  const { data: locations } = useQuery({
    ...locationQueries.list({ size: LOCATION_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
    throwOnError: isThrownWithoutData,
  });
  const { data: incomeSources } = useQuery({
    ...accountQueries.list({ kinds: ['INCOME'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
    enabled: transactionType === 'INCOME',
    throwOnError: isThrownWithoutData,
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
  function renderMoneyAccountForm(props: CreateFormProps) {
    if (dictionaries === undefined || baseCurrency === undefined) {
      throw new Error('A money account form needs the dictionaries and the base currency.');
    }

    return (
      <MoneyAccountForm
        mode={{ kind: 'create', name: props.name, onCreated: props.onCreated }}
        onBack={props.onBack}
        accountKinds={dictionaries.account_kinds}
        currencies={dictionaries.currencies}
        baseCurrency={baseCurrency}
      />
    );
  }

  return (
    <Sheet label="New transaction" onClose={close}>
      {dictionaries === undefined || baseCurrency === undefined ? (
        <div className={styles['skeleton']} aria-busy="true">
          <Skeleton className={styles['titleSkeleton']} />
          <Skeleton className={styles['amountSkeleton']} />
          <Skeleton className={styles['rowsSkeleton']} />
        </div>
      ) : transactionType === 'ADJUSTMENT' ? (
        <TransactionForm
          transactionType={transactionType}
          transactionTypes={dictionaries.transaction_types}
          moneyAccounts={moneyAccounts?.items}
          presetAccountId={readNewTransactionAccountId(searchParams)}
          baseCurrency={baseCurrency}
          relatedQueryKeys={relatedQueryKeys}
          renderMoneyAccountForm={renderMoneyAccountForm}
          onTypeChange={changeType}
          onClose={close}
        />
      ) : (
        <MovementForm
          key={transactionType}
          transactionType={transactionType}
          transactionTypes={dictionaries.transaction_types}
          categoryTypes={dictionaries.category_types}
          currencies={dictionaries.currencies}
          moneyAccounts={moneyAccounts?.items}
          categories={categories?.items}
          incomeSources={incomeSources?.items}
          locations={locations?.items}
          baseCurrency={baseCurrency}
          relatedQueryKeys={[...relatedQueryKeys, locationQueries.all().queryKey]}
          renderCategoryForm={(props) => (
            <CategoryForm {...props} categoryTypes={dictionaries.category_types} />
          )}
          renderIncomeSourceForm={(props) => <IncomeSourceForm {...props} />}
          renderMoneyAccountForm={renderMoneyAccountForm}
          renderLocationForm={(props) => <LocationForm {...props} />}
          onTypeChange={changeType}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
