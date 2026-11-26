import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import type { DetailsBack } from '@/components/details-panel/details-panel';
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
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';
import { revealHorizontally } from '@/lib/reveal-horizontally';
import type { components } from '@/lib/api-schema';

import { writeClosedEntry, writeSelectedEntry } from './selected-entry';
import { readTransactionsLink } from './transactions-link';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type AccountingDictionaries = components['schemas']['AccountingDictionaries'];

const EDIT_SHEET_LABELS = {
  ASSET: 'Edit account',
  LIABILITY: 'Edit account',
  EXPENSE: 'Edit category',
  INCOME: 'Edit income source',
} as const;

type ShownAccount =
  | Readonly<{
      kind: 'selected';
      defaultAccountId: string | undefined;
      isDefaultAccountPending: boolean;
      isParamIgnored: boolean;
    }>
  | Readonly<{ kind: 'opened'; accountId: string; back: DetailsBack }>;

type SelectedAccountDetailsProps = Readonly<{
  form: AccountDetailsForm;
  baseCurrency: string;
  accountCount: number | undefined;
  shownAccount: ShownAccount;
  isKeptOpenOnDesktop: boolean;
  isMoneyAccountOnly: boolean;
}>;

type SelectedAccountProps = Readonly<{
  form: AccountDetailsForm;
  accountId: string | undefined;
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  isMoneyAccountOnly: boolean;
  back: DetailsBack | undefined;
  baseCurrency: string;
  isOnlyAccount: boolean;
  dictionaries: AccountingDictionaries | undefined;
}>;

type AccountFormProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  categoryPurposes: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
  onSaved: () => void;
  onBack: () => void;
}>;

function AccountForm({
  account,
  baseCurrency,
  categoryPurposes,
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
        mode={{
          kind: 'edit',
          category: account,
          relatedQueryKeys: [...relatedQueryKeys, summaryQueries.current().queryKey],
          onSaved,
        }}
        categoryPurposes={categoryPurposes}
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
      currencies={currencies}
      baseCurrency={baseCurrency}
      onBack={onBack}
    />
  );
}

function writeShownAccount({
  searchParams,
  accountId,
  isOpened,
}: Readonly<{
  searchParams: URLSearchParams;
  accountId: string | undefined;
  isOpened: boolean;
}>): URLSearchParams {
  const shownSearchParams = isOpened
    ? writeSelectedEntry({
        searchParams,
        entry: accountId === undefined ? undefined : { kind: 'account', id: accountId },
      })
    : writeSelectedAccount({ searchParams, accountId });
  return shownSearchParams;
}

function SelectedAccount({
  form,
  accountId,
  isShownByDefault,
  isKeptOpenOnDesktop,
  isMoneyAccountOnly,
  back,
  baseCurrency,
  isOnlyAccount,
  dictionaries,
}: SelectedAccountProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedAccountId, setEditedAccountId] = useState<string | undefined>(undefined);
  const [renamedAccountId, setRenamedAccountId] = useState<string | undefined>(undefined);
  const transactionsLinkId = useId();
  const isDesktop = useIsDesktop();
  const isEditing = accountId !== undefined && editedAccountId === accountId;
  if (editedAccountId !== undefined && !isEditing) {
    setEditedAccountId(undefined);
  }

  const isRenaming = accountId !== undefined && renamedAccountId === accountId;
  if (renamedAccountId !== undefined && !isRenaming) {
    setRenamedAccountId(undefined);
  }

  const { data: account, error } = useQuery({
    ...accountQueries.detail(accountId ?? ''),
    enabled: accountId !== undefined,
  });
  const isOpened = back !== undefined;
  const isAccountRevealEnabled = !isOpened && (isDesktop || !isShownByDefault);
  useEffect(() => {
    if (isAccountRevealEnabled && accountId !== undefined) {
      revealHorizontally(document.getElementById(readAccountLinkId(accountId)));
    }
  }, [accountId, isAccountRevealEnabled]);
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
        to={{
          search: writeShownAccount({ searchParams, accountId: undefined, isOpened }).toString(),
        }}
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
    setSearchParams(writeShownAccount({ searchParams, accountId: undefined, isOpened }), {
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
        dictionaries={dictionaries}
        readAdjustBalanceLink={(shownAccount) => ({
          search: writeNewAdjustment({ searchParams, accountId: shownAccount.id }).toString(),
        })}
        readTransactionsLink={readTransactionsLink}
        transactionsLinkId={transactionsLinkId}
        isOnlyAccount={isOnlyAccount}
        relatedQueryKeys={relatedQueryKeys}
        isShownByDefault={isShownByDefault}
        isKeptOpenOnDesktop={isKeptOpenOnDesktop}
        back={back}
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
          if (isOpened) {
            setSearchParams(writeClosedEntry(searchParams), { preventScrollReset: true });
          } else {
            dropSelectedAccount({ isReplaced: false });
          }
        }}
        onChoose={() => {
          if (accountId === undefined) {
            return;
          }

          setSearchParams(writeShownAccount({ searchParams, accountId, isOpened }), {
            preventScrollReset: true,
            replace: true,
          });
        }}
      />
      {isEditing &&
        account !== undefined &&
        dictionaries !== undefined &&
        account.kind !== 'EQUITY' && (
          <Sheet label={EDIT_SHEET_LABELS[account.kind]} onClose={closeEditForm}>
            <AccountForm
              account={account}
              baseCurrency={baseCurrency}
              categoryPurposes={dictionaries.category_purposes ?? []}
              currencies={dictionaries.currencies}
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
  shownAccount,
  isKeptOpenOnDesktop,
  isMoneyAccountOnly,
}: SelectedAccountDetailsProps) {
  const [searchParams] = useSearchParams();
  const selectedAccountId =
    shownAccount.kind === 'opened' || shownAccount.isParamIgnored
      ? undefined
      : readSelectedAccountId(searchParams);
  const accountId =
    shownAccount.kind === 'opened'
      ? shownAccount.accountId
      : (selectedAccountId ?? shownAccount.defaultAccountId);
  const isShownByDefault = shownAccount.kind === 'selected' && selectedAccountId === undefined;
  const { data: dictionaries, isError: isDictionaryFailed } = useQuery(
    dictionaryQueries.accounting(),
  );
  const isAccountPending =
    accountId === undefined &&
    shownAccount.kind === 'selected' &&
    shownAccount.isDefaultAccountPending;
  if (isDictionaryFailed && dictionaries === undefined) {
    return null;
  }

  if (accountId === undefined && !isAccountPending) {
    return null;
  }

  return (
    <SelectedAccount
      form={form}
      accountId={accountId}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={isKeptOpenOnDesktop}
      isMoneyAccountOnly={isMoneyAccountOnly}
      back={shownAccount.kind === 'opened' ? shownAccount.back : undefined}
      baseCurrency={baseCurrency}
      isOnlyAccount={accountCount === 1}
      dictionaries={dictionaries}
    />
  );
}
