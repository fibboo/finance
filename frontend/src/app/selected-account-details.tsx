import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';

import { accountQueries } from '@/features/accounts/api/account-queries';
import {
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import { AccountDetails } from '@/features/accounts/components/account-details';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeNewAdjustment } from '@/features/transactions/api/new-transaction';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';

type SelectedAccountDetailsProps = Readonly<{ baseCurrency: string }>;

export function SelectedAccountDetails({ baseCurrency }: SelectedAccountDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAccountId = readSelectedAccountId(searchParams);
  const [editedAccountId, setEditedAccountId] = useState<string | undefined>(undefined);
  if (editedAccountId !== undefined && editedAccountId !== selectedAccountId) {
    setEditedAccountId(undefined);
  }
  const { data: account, error } = useQuery({
    ...accountQueries.detail(selectedAccountId ?? ''),
    enabled: selectedAccountId !== undefined,
  });
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (selectedAccountId === undefined || dictionaries === undefined) {
    return null;
  }

  const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  if (isNotFound || (account !== undefined && !isMoneyAccountKind(account.kind))) {
    return (
      <Navigate
        to={{ search: writeSelectedAccount({ searchParams, accountId: undefined }).toString() }}
        replace
      />
    );
  }

  function closeEditForm() {
    setEditedAccountId(undefined);
  }

  return (
    <>
      <AccountDetails
        key={selectedAccountId}
        accountId={selectedAccountId}
        baseCurrency={baseCurrency}
        accountKinds={dictionaries.account_kinds}
        adjustBalanceLink={{
          search: writeNewAdjustment({ searchParams, accountId: selectedAccountId }).toString(),
        }}
        transactionsLink={{
          pathname: '/transactions',
          search: writeTransactionFilters({
            transaction_types: [],
            account_ids: [selectedAccountId],
            category_ids: [],
            income_source_ids: [],
          }).toString(),
        }}
        onEdit={() => {
          setEditedAccountId(selectedAccountId);
        }}
        onClose={() => {
          setSearchParams(writeSelectedAccount({ searchParams, accountId: undefined }), {
            preventScrollReset: true,
          });
        }}
      />
      {editedAccountId !== undefined && account !== undefined && (
        <Sheet label="Edit account" onClose={closeEditForm}>
          <MoneyAccountForm
            mode={{
              kind: 'edit',
              account,
              relatedQueryKeys: [
                transactionQueries.feeds().queryKey,
                transactionQueries.details().queryKey,
              ],
              onSaved: closeEditForm,
            }}
            accountKinds={dictionaries.account_kinds}
            currencies={dictionaries.currencies}
            baseCurrency={baseCurrency}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
    </>
  );
}
