import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Navigate, type To, useSearchParams } from 'react-router';

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
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { TransactionFormSkeleton } from './transaction-form-skeleton';
import { useMovementChoices } from './use-movement-choices';

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
  categoryTypes: readonly DictionaryItem[];
  readAccountLink: (accountId: string) => To;
}>;

function SelectedTransaction({
  transactionId,
  isShownByDefault,
  baseCurrency,
  transactionTypes,
  accountKinds,
  categoryTypes,
  readAccountLink,
}: SelectedTransactionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const editButtonId = useId();
  const { data: transaction, error } = useQuery(transactionQueries.detail(transactionId));
  const movementType =
    transaction === undefined || transaction.transaction_type === 'ADJUSTMENT'
      ? undefined
      : transaction.transaction_type;
  const choices = useMovementChoices(isEditing ? movementType : undefined);
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
    setIsEditing(false);
  }

  return (
    <>
      <TransactionDetails
        transactionId={transactionId}
        baseCurrency={baseCurrency}
        transactionTypes={transactionTypes}
        accountKinds={accountKinds}
        readAccountLink={readAccountLink}
        relatedQueryKeys={[accountQueries.all().queryKey, summaryQueries.current().queryKey]}
        isShownByDefault={isShownByDefault}
        editButtonId={editButtonId}
        onEdit={() => {
          setIsEditing(true);
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
      {isEditing && transaction !== undefined && movementType !== undefined && (
        <Sheet label="Edit transaction" onClose={closeEditForm}>
          {choices.currencies === undefined ? (
            <TransactionFormSkeleton />
          ) : (
            <MovementForm
              mode={{ kind: 'edit', transaction }}
              transactionType={movementType}
              categoryTypes={categoryTypes}
              currencies={choices.currencies}
              moneyAccounts={choices.moneyAccounts}
              categories={choices.categories}
              incomeSources={choices.incomeSources}
              locations={choices.locations}
              baseCurrency={baseCurrency}
              relatedQueryKeys={[
                accountQueries.all().queryKey,
                summaryQueries.current().queryKey,
                locationQueries.all().queryKey,
              ]}
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
      categoryTypes={dictionaries.category_types}
      readAccountLink={readAccountLink}
    />
  );
}
