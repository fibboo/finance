import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';

import { accountQueries } from '@/features/accounts/api/account-queries';
import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import {
  AccountDetails,
  type AccountDetailsForm,
} from '@/features/accounts/components/account-details';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { IncomeSourceForm } from '@/features/accounts/components/income-source-form';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import { writeNewAdjustment } from '@/features/transactions/api/new-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import { revealHorizontally } from '@/lib/reveal-horizontally';
import type { components } from '@/lib/api-schema';

import { readTransactionsLink } from './transactions-link';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const EDIT_SHEET_LABELS = {
  ASSET: 'Edit account',
  LIABILITY: 'Edit account',
  EXPENSE: 'Edit category',
  INCOME: 'Edit income source',
} as const;

type SelectedAccountDetailsProps = Readonly<{
  form: AccountDetailsForm;
  baseCurrency: string;
  accountCount: number | undefined;
  defaultAccountId: string | undefined;
  isKeptOpenOnDesktop: boolean;
  isParamIgnored: boolean;
  isMoneyAccountOnly: boolean;
}>;

type SelectedAccountProps = Readonly<{
  form: AccountDetailsForm;
  accountId: string;
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  isMoneyAccountOnly: boolean;
  baseCurrency: string;
  isOnlyAccount: boolean;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
}>;

type AccountFormProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
  onSaved: () => void;
  onBack: () => void;
}>;

function AccountForm({
  account,
  baseCurrency,
  accountKinds,
  categoryTypes,
  currencies,
  onSaved,
  onBack,
}: AccountFormProps) {
  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];
  if (account.kind === 'EXPENSE') {
    return (
      <CategoryForm
        mode={{ kind: 'edit', category: account, relatedQueryKeys, onSaved }}
        categoryTypes={categoryTypes}
        onBack={onBack}
      />
    );
  }

  if (account.kind === 'INCOME') {
    return (
      <IncomeSourceForm
        mode={{ kind: 'edit', incomeSource: account, relatedQueryKeys, onSaved }}
        onBack={onBack}
      />
    );
  }

  return (
    <MoneyAccountForm
      mode={{ kind: 'edit', account, relatedQueryKeys, onSaved }}
      accountKinds={accountKinds}
      currencies={currencies}
      baseCurrency={baseCurrency}
      onBack={onBack}
    />
  );
}

function SelectedAccount({
  form,
  accountId,
  isShownByDefault,
  isKeptOpenOnDesktop,
  isMoneyAccountOnly,
  baseCurrency,
  isOnlyAccount,
  accountKinds,
  categoryTypes,
  currencies,
}: SelectedAccountProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedAccountId, setEditedAccountId] = useState<string | undefined>(undefined);
  const [renamedAccountId, setRenamedAccountId] = useState<string | undefined>(undefined);
  const transactionsLinkId = useId();
  const isEditing = editedAccountId === accountId;
  if (editedAccountId !== undefined && !isEditing) {
    setEditedAccountId(undefined);
  }

  const isRenaming = renamedAccountId === accountId;
  if (renamedAccountId !== undefined && !isRenaming) {
    setRenamedAccountId(undefined);
  }

  const { data: account, error } = useQuery(accountQueries.detail(accountId));
  useEffect(() => {
    revealHorizontally(document.getElementById(readAccountLinkId(accountId)));
  }, [accountId]);
  const isNotFound = error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  const isUnavailable =
    isNotFound ||
    account?.kind === 'EQUITY' ||
    (isMoneyAccountOnly && account !== undefined && !isMoneyAccountKind(account.kind));
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

  const relatedQueryKeys = [
    summaryQueries.current().queryKey,
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];

  function closeEditForm() {
    setEditedAccountId(undefined);
  }

  function closeRestoreForm() {
    setRenamedAccountId(undefined);
  }

  function focusTransactionsLink() {
    requestAnimationFrame(() => {
      document.getElementById(transactionsLinkId)?.focus();
    });
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
        form={form}
        accountId={accountId}
        baseCurrency={baseCurrency}
        accountKinds={accountKinds}
        categoryTypes={categoryTypes}
        adjustBalanceLink={{
          search: writeNewAdjustment({ searchParams, accountId }).toString(),
        }}
        readTransactionsLink={readTransactionsLink}
        transactionsLinkId={transactionsLinkId}
        isOnlyAccount={isOnlyAccount}
        relatedQueryKeys={relatedQueryKeys}
        isShownByDefault={isShownByDefault}
        isKeptOpenOnDesktop={isKeptOpenOnDesktop}
        onEdit={() => {
          setEditedAccountId(accountId);
        }}
        onDeleted={() => {
          dropSelectedAccount({ isReplaced: true });
        }}
        onStatusChanged={focusTransactionsLink}
        onRestoreNameTaken={() => {
          setRenamedAccountId(accountId);
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
      {isEditing && account !== undefined && account.kind !== 'EQUITY' && (
        <Sheet label={EDIT_SHEET_LABELS[account.kind]} onClose={closeEditForm}>
          <AccountForm
            account={account}
            baseCurrency={baseCurrency}
            accountKinds={accountKinds}
            categoryTypes={categoryTypes}
            currencies={currencies}
            onSaved={() => {
              setEditedAccountId((openAccountId) =>
                openAccountId === accountId ? undefined : openAccountId,
              );
            }}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
      {isRenaming &&
        account?.status === 'DELETED' &&
        (account.kind === 'EXPENSE' || account.kind === 'INCOME') && (
          <Sheet
            label={account.kind === 'EXPENSE' ? 'Restore category' : 'Restore income source'}
            onClose={closeRestoreForm}
          >
            <RestoreForm
              account={account}
              entityName={account.kind === 'EXPENSE' ? 'category' : 'income source'}
              relatedQueryKeys={relatedQueryKeys}
              onRestored={() => {
                closeRestoreForm();
                focusTransactionsLink();
              }}
              onBack={closeRestoreForm}
            />
          </Sheet>
        )}
    </>
  );
}

export function SelectedAccountDetails({
  form,
  baseCurrency,
  accountCount,
  defaultAccountId,
  isKeptOpenOnDesktop,
  isParamIgnored,
  isMoneyAccountOnly,
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
      form={form}
      accountId={accountId}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={isKeptOpenOnDesktop}
      isMoneyAccountOnly={isMoneyAccountOnly}
      baseCurrency={baseCurrency}
      isOnlyAccount={accountCount === 1}
      accountKinds={dictionaries.account_kinds}
      categoryTypes={dictionaries.category_types}
      currencies={dictionaries.currencies}
    />
  );
}
