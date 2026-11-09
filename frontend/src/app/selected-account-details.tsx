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
import { summaryQueries } from '@/features/summary/api/summary-queries';
import { writeNewAdjustment } from '@/features/transactions/api/new-transaction';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

type DictionaryItem = components['schemas']['DictionaryItem'];

type SelectedAccountDetailsProps = Readonly<{
  baseCurrency: string;
  accountCount: number | undefined;
}>;

type SelectedAccountProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  isOnlyAccount: boolean;
  accountKinds: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
}>;

function SelectedAccount({
  accountId,
  baseCurrency,
  isOnlyAccount,
  accountKinds,
  currencies,
}: SelectedAccountProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const { data: account, error } = useQuery(accountQueries.detail(accountId));
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
    setIsEditing(false);
  }

  function dropSelectedAccount() {
    setSearchParams(writeSelectedAccount({ searchParams, accountId: undefined }), {
      preventScrollReset: true,
    });
  }

  return (
    <>
      <AccountDetails
        accountId={accountId}
        baseCurrency={baseCurrency}
        accountKinds={accountKinds}
        adjustBalanceLink={{
          search: writeNewAdjustment({ searchParams, accountId }).toString(),
        }}
        transactionsLink={{
          pathname: '/transactions',
          search: writeTransactionFilters({
            transaction_types: [],
            account_ids: [accountId],
            category_ids: [],
            income_source_ids: [],
          }).toString(),
        }}
        isOnlyAccount={isOnlyAccount}
        relatedQueryKeys={[summaryQueries.current().queryKey, transactionQueries.feeds().queryKey]}
        onEdit={() => {
          setIsEditing(true);
        }}
        onDeleted={dropSelectedAccount}
        onClose={dropSelectedAccount}
      />
      {isEditing && account !== undefined && (
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
            accountKinds={accountKinds}
            currencies={currencies}
            baseCurrency={baseCurrency}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
    </>
  );
}

export function SelectedAccountDetails({
  baseCurrency,
  accountCount,
}: SelectedAccountDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedAccountId = readSelectedAccountId(searchParams);
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (selectedAccountId === undefined || dictionaries === undefined) {
    return null;
  }

  return (
    <SelectedAccount
      key={selectedAccountId}
      accountId={selectedAccountId}
      baseCurrency={baseCurrency}
      isOnlyAccount={accountCount === 1}
      accountKinds={dictionaries.account_kinds}
      currencies={dictionaries.currencies}
    />
  );
}
