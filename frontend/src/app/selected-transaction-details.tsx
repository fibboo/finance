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
import type { ReadLocationLink } from '@/features/transactions/components/transaction-overview';
import type { ReadAccountLink } from '@/features/transactions/components/transaction-entry-block';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { TransactionFormSkeleton } from './transaction-form-skeleton';
import { useMovementChoices } from './use-movement-choices';

type AccountingDictionaries = components['schemas']['AccountingDictionaries'];

type SelectedTransactionDetailsProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  isDefaultTransactionPending: boolean;
  readAccountLink: ReadAccountLink;
  readLocationLink: ReadLocationLink;
}>;

type SelectedTransactionProps = Readonly<{
  transactionId: string | undefined;
  isTransactionPending: boolean;
  isShownByDefault: boolean;
  baseCurrency: string;
  dictionaries: AccountingDictionaries | undefined;
  readAccountLink: ReadAccountLink;
  readLocationLink: ReadLocationLink;
}>;

function SelectedTransaction({
  transactionId,
  isTransactionPending,
  isShownByDefault,
  baseCurrency,
  dictionaries,
  readAccountLink,
  readLocationLink,
}: SelectedTransactionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedTransactionId, setEditedTransactionId] = useState<string | undefined>(undefined);
  const isEditing = transactionId !== undefined && editedTransactionId === transactionId;
  if (editedTransactionId !== undefined && !isEditing) {
    setEditedTransactionId(undefined);
  }

  const editButtonId = useId();
  const relatedQueryKeys = [accountQueries.all().queryKey, summaryQueries.current().queryKey];
  const { data: transaction, error } = useQuery({
    ...transactionQueries.detail(transactionId ?? ''),
    enabled: transactionId !== undefined,
  });
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
        isTransactionPending={isTransactionPending}
        baseCurrency={baseCurrency}
        dictionaries={dictionaries}
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
          if (transactionId === undefined) {
            return;
          }

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
              optionChoices={choices.optionChoices}
              moneyAccounts={choices.moneyAccounts}
              baseCurrency={choices.baseCurrency}
              relatedQueryKeys={relatedQueryKeys}
              onClose={closeEditForm}
            />
          ) : (
            <MovementForm
              mode={{ kind: 'edit', transaction }}
              transactionType={transaction.transaction_type}
              optionChoices={choices.optionChoices}
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
  isDefaultTransactionPending,
  readAccountLink,
  readLocationLink,
}: SelectedTransactionDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const transactionId = selectedTransactionId ?? defaultTransactionId;
  const isShownByDefault = selectedTransactionId === undefined;
  const { data: dictionaries, isError: isDictionaryFailed } = useQuery(
    dictionaryQueries.accounting(),
  );
  if (isDictionaryFailed && dictionaries === undefined) {
    return null;
  }

  return (
    <SelectedTransaction
      transactionId={transactionId}
      isTransactionPending={transactionId === undefined && isDefaultTransactionPending}
      isShownByDefault={isShownByDefault}
      baseCurrency={baseCurrency}
      dictionaries={dictionaries}
      readAccountLink={readAccountLink}
      readLocationLink={readLocationLink}
    />
  );
}
