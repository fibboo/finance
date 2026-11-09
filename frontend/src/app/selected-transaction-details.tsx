import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router';

import { accountQueries } from '@/features/accounts/api/account-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { TransactionDetails } from '@/features/transactions/components/transaction-details';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

type DictionaryItem = components['schemas']['DictionaryItem'];

type SelectedTransactionDetailsProps = Readonly<{ baseCurrency: string }>;

type SelectedTransactionProps = Readonly<{
  transactionId: string;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
}>;

function SelectedTransaction({
  transactionId,
  baseCurrency,
  transactionTypes,
  accountKinds,
}: SelectedTransactionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { error } = useQuery(transactionQueries.detail(transactionId));
  const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  if (isNotFound) {
    return (
      <Navigate
        to={{
          search: writeSelectedTransaction({ searchParams, transactionId: undefined }).toString(),
        }}
        replace
      />
    );
  }

  return (
    <TransactionDetails
      transactionId={transactionId}
      baseCurrency={baseCurrency}
      transactionTypes={transactionTypes}
      accountKinds={accountKinds}
      relatedQueryKeys={[accountQueries.all().queryKey, summaryQueries.current().queryKey]}
      onClose={() => {
        setSearchParams(writeSelectedTransaction({ searchParams, transactionId: undefined }), {
          preventScrollReset: true,
        });
      }}
    />
  );
}

export function SelectedTransactionDetails({ baseCurrency }: SelectedTransactionDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (selectedTransactionId === undefined || dictionaries === undefined) {
    return null;
  }

  return (
    <SelectedTransaction
      key={selectedTransactionId}
      transactionId={selectedTransactionId}
      baseCurrency={baseCurrency}
      transactionTypes={dictionaries.transaction_types}
      accountKinds={dictionaries.account_kinds}
    />
  );
}
