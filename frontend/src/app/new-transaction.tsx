import { useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';
import { accountQueries } from '@/features/accounts/api/account-queries';
import { locationQueries } from '@/features/locations/api/location-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  type EntryTransactionType,
  readNewTransactionAccountId,
  readNewTransactionType,
  writeNewTransactionType,
} from '@/features/transactions/api/new-transaction';
import { MovementForm } from '@/features/transactions/components/movement-form';
import { TransactionForm } from '@/features/transactions/components/transaction-form';

import { TransactionFormSkeleton } from './transaction-form-skeleton';
import { useMovementChoices } from './use-movement-choices';

export function NewTransaction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const transactionType = readNewTransactionType(searchParams);
  const {
    dictionaries,
    currencies,
    baseCurrency,
    moneyAccounts,
    categories,
    incomeSources,
    locations,
    createForms,
  } = useMovementChoices(transactionType);
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
      {dictionaries === undefined || currencies === undefined || baseCurrency === undefined ? (
        <TransactionFormSkeleton />
      ) : transactionType === 'ADJUSTMENT' ? (
        <TransactionForm
          transactionType={transactionType}
          transactionTypes={dictionaries.transaction_types}
          moneyAccounts={moneyAccounts}
          presetAccountId={readNewTransactionAccountId(searchParams)}
          baseCurrency={baseCurrency}
          relatedQueryKeys={relatedQueryKeys}
          renderMoneyAccountForm={createForms.renderMoneyAccountForm}
          onTypeChange={changeType}
          onClose={close}
        />
      ) : (
        <MovementForm
          key={transactionType}
          mode={{
            kind: 'create',
            typeChoice: {
              transactionType,
              transactionTypes: dictionaries.transaction_types,
              onTypeChange: changeType,
            },
          }}
          transactionType={transactionType}
          categoryTypes={dictionaries.category_types}
          currencies={currencies}
          moneyAccounts={moneyAccounts}
          categories={categories}
          incomeSources={incomeSources}
          locations={locations}
          baseCurrency={baseCurrency}
          relatedQueryKeys={[...relatedQueryKeys, locationQueries.all().queryKey]}
          {...createForms}
          onClose={close}
        />
      )}
    </Sheet>
  );
}
