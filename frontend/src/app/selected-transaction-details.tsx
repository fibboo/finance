import { useQuery } from '@tanstack/react-query';
import { Navigate, type To, useSearchParams } from 'react-router';

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

type SelectedTransactionDetailsProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  readAccountLink: (accountId: string) => To;
}>;

type SelectedTransactionProps = Readonly<{
  transactionId: string;
  isShownByDefault: boolean;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  readAccountLink: (accountId: string) => To;
}>;

function SelectedTransaction({
  transactionId,
  isShownByDefault,
  baseCurrency,
  transactionTypes,
  accountKinds,
  readAccountLink,
}: SelectedTransactionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { error } = useQuery(transactionQueries.detail(transactionId));
  const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  if (isNotFound && isShownByDefault) {
    return null;
  }

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
      readAccountLink={readAccountLink}
      relatedQueryKeys={[accountQueries.all().queryKey, summaryQueries.current().queryKey]}
      isShownByDefault={isShownByDefault}
      onClose={() => {
        setSearchParams(writeSelectedTransaction({ searchParams, transactionId: undefined }), {
          preventScrollReset: true,
        });
      }}
      onChoose={() => {
        setSearchParams(writeSelectedTransaction({ searchParams, transactionId }), {
          preventScrollReset: true,
          replace: true,
        });
      }}
    />
  );
}

export function SelectedTransactionDetails({
  baseCurrency,
  defaultTransactionId,
  readAccountLink,
}: SelectedTransactionDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const transactionId = selectedTransactionId ?? defaultTransactionId;
  const isShownByDefault = selectedTransactionId === undefined;
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (transactionId === undefined || dictionaries === undefined) {
    return null;
  }

  return (
    <SelectedTransaction
      key={transactionId}
      transactionId={transactionId}
      isShownByDefault={isShownByDefault}
      baseCurrency={baseCurrency}
      transactionTypes={dictionaries.transaction_types}
      accountKinds={dictionaries.account_kinds}
      readAccountLink={readAccountLink}
    />
  );
}
