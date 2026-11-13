import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { Navigate, useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';
import { accountQueries } from '@/features/accounts/api/account-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { locationQueries } from '@/features/locations/api/location-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import {
  readSelectedTransactionId,
  writeSelectedTransaction,
} from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { MovementForm } from '@/features/transactions/components/movement-form';
import { TransactionDetails } from '@/features/transactions/components/transaction-details';
import { TransactionForm } from '@/features/transactions/components/transaction-form';
import type { LocationLink } from '@/features/transactions/components/transaction-overview';
import type { ReadAccountLink } from '@/features/transactions/components/transaction-postings';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { TransactionFormSkeleton } from './transaction-form-skeleton';
import { useMovementChoices } from './use-movement-choices';

type DictionaryItem = components['schemas']['DictionaryItem'];

type SelectedTransactionDetailsProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  readAccountLink: ReadAccountLink;
  readLocationLink: (locationId: string) => LocationLink;
}>;

type SelectedTransactionProps = Readonly<{
  transactionId: string;
  isShownByDefault: boolean;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  readAccountLink: ReadAccountLink;
  readLocationLink: (locationId: string) => LocationLink;
}>;

function SelectedTransaction({
  transactionId,
  isShownByDefault,
  baseCurrency,
  transactionTypes,
  accountKinds,
  readAccountLink,
  readLocationLink,
}: SelectedTransactionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedTransactionId, setEditedTransactionId] = useState<string | undefined>(undefined);
  const isEditing = editedTransactionId === transactionId;
  if (editedTransactionId !== undefined && !isEditing) {
    setEditedTransactionId(undefined);
  }

  const editButtonId = useId();
  const relatedQueryKeys = [accountQueries.all().queryKey, summaryQueries.current().queryKey];
  const { data: transaction, error } = useQuery(transactionQueries.detail(transactionId));
  const choices = useMovementChoices(isEditing ? transaction?.transaction_type : undefined);
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

  function closeEditForm() {
    flushSync(() => {
      setEditedTransactionId(undefined);
    });
    document.getElementById(editButtonId)?.focus();
  }

  return (
    <>
      <TransactionDetails
        transactionId={transactionId}
        baseCurrency={baseCurrency}
        transactionTypes={transactionTypes}
        accountKinds={accountKinds}
        readAccountLink={readAccountLink}
        readLocationLink={readLocationLink}
        relatedQueryKeys={relatedQueryKeys}
        isShownByDefault={isShownByDefault}
        editButtonId={editButtonId}
        onEdit={() => {
          setEditedTransactionId(transactionId);
          if (isShownByDefault) {
            setSearchParams(writeSelectedTransaction({ searchParams, transactionId }), {
              preventScrollReset: true,
              replace: true,
            });
          }
        }}
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
      {isEditing && transaction !== undefined && (
        <Sheet label="Edit transaction" onClose={closeEditForm}>
          {choices.dictionaries === undefined ||
          choices.currencies === undefined ||
          choices.baseCurrency === undefined ||
          !choices.isEveryListLoaded ? (
            <TransactionFormSkeleton />
          ) : transaction.transaction_type === 'ADJUSTMENT' ? (
            <TransactionForm
              mode={{ kind: 'edit', transaction }}
              transactionType={transaction.transaction_type}
              moneyAccounts={choices.moneyAccounts}
              baseCurrency={choices.baseCurrency}
              relatedQueryKeys={relatedQueryKeys}
              onClose={closeEditForm}
            />
          ) : (
            <MovementForm
              mode={{ kind: 'edit', transaction }}
              transactionType={transaction.transaction_type}
              categoryTypes={choices.dictionaries.category_types}
              currencies={choices.currencies}
              moneyAccounts={choices.moneyAccounts}
              categories={choices.categories}
              incomeSources={choices.incomeSources}
              locations={choices.locations}
              baseCurrency={choices.baseCurrency}
              relatedQueryKeys={[...relatedQueryKeys, locationQueries.all().queryKey]}
              {...choices.createForms}
              onClose={closeEditForm}
            />
          )}
        </Sheet>
      )}
    </>
  );
}

export function SelectedTransactionDetails({
  baseCurrency,
  defaultTransactionId,
  readAccountLink,
  readLocationLink,
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
      transactionId={transactionId}
      isShownByDefault={isShownByDefault}
      baseCurrency={baseCurrency}
      transactionTypes={dictionaries.transaction_types}
      accountKinds={dictionaries.account_kinds}
      readAccountLink={readAccountLink}
      readLocationLink={readLocationLink}
    />
  );
}
