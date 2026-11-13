import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';

import { accountQueries } from '@/features/accounts/api/account-queries';
import {
  readAccountLinkId,
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
import { revealHorizontally } from '@/lib/reveal-horizontally';
import type { components } from '@/lib/api-schema';

type DictionaryItem = components['schemas']['DictionaryItem'];

type SelectedAccountDetailsProps = Readonly<{
  baseCurrency: string;
  accountCount: number | undefined;
  defaultAccountId: string | undefined;
  isKeptOpenOnDesktop: boolean;
  isParamIgnored: boolean;
}>;

type SelectedAccountProps = Readonly<{
  accountId: string;
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  baseCurrency: string;
  isOnlyAccount: boolean;
  accountKinds: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
}>;

function SelectedAccount({
  accountId,
  isShownByDefault,
  isKeptOpenOnDesktop,
  baseCurrency,
  isOnlyAccount,
  accountKinds,
  currencies,
}: SelectedAccountProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedAccountId, setEditedAccountId] = useState<string | undefined>(undefined);
  const isEditing = editedAccountId === accountId;
  if (editedAccountId !== undefined && !isEditing) {
    setEditedAccountId(undefined);
  }

  const { data: account, error } = useQuery(accountQueries.detail(accountId));
  useEffect(() => {
    revealHorizontally(document.getElementById(readAccountLinkId(accountId)));
  }, [accountId]);
  const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  const isUnavailable = isNotFound || (account !== undefined && !isMoneyAccountKind(account.kind));
  if (isUnavailable && isShownByDefault) {
    return null;
  }

  if (isUnavailable) {
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

  function dropSelectedAccount({ isReplaced }: Readonly<{ isReplaced: boolean }>) {
    setSearchParams(writeSelectedAccount({ searchParams, accountId: undefined }), {
      preventScrollReset: true,
      replace: isReplaced,
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
        isShownByDefault={isShownByDefault}
        isKeptOpenOnDesktop={isKeptOpenOnDesktop}
        onEdit={() => {
          setEditedAccountId(accountId);
        }}
        onDeleted={() => {
          dropSelectedAccount({ isReplaced: true });
        }}
        onClose={() => {
          dropSelectedAccount({ isReplaced: false });
        }}
        onChoose={() => {
          setSearchParams(writeSelectedAccount({ searchParams, accountId }), {
            preventScrollReset: true,
            replace: true,
          });
        }}
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
              onSaved: () => {
                setEditedAccountId((openAccountId) =>
                  openAccountId === accountId ? undefined : openAccountId,
                );
              },
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
  defaultAccountId,
  isKeptOpenOnDesktop,
  isParamIgnored,
}: SelectedAccountDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedAccountId = isParamIgnored ? undefined : readSelectedAccountId(searchParams);
  const accountId = selectedAccountId ?? defaultAccountId;
  const isShownByDefault = selectedAccountId === undefined;
  const { data: dictionaries } = useQuery(dictionaryQueries.accounting());
  if (accountId === undefined || dictionaries === undefined) {
    return null;
  }

  return (
    <SelectedAccount
      accountId={accountId}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={isKeptOpenOnDesktop}
      baseCurrency={baseCurrency}
      isOnlyAccount={accountCount === 1}
      accountKinds={dictionaries.account_kinds}
      currencies={dictionaries.currencies}
    />
  );
}
