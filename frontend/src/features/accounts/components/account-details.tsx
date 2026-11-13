import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountOverview } from './account-overview';
import { DeleteAccount } from './delete-account';
import { RestoreAccount } from './restore-account';

type DictionaryItem = components['schemas']['DictionaryItem'];

type AccountDetailsProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  isOnlyAccount: boolean;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onRestoreNameTaken: () => void;
  onClose: () => void;
  onChoose: () => void;
}>;

export function AccountDetails({
  accountId,
  baseCurrency,
  accountKinds,
  categoryTypes,
  adjustBalanceLink,
  transactionsLink,
  isOnlyAccount,
  relatedQueryKeys,
  isShownByDefault,
  isKeptOpenOnDesktop,
  onEdit,
  onDeleted,
  onRestoreNameTaken,
  onClose,
  onChoose,
}: AccountDetailsProps) {
  const transactionsLinkId = useId();
  const {
    data: account,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useQuery({ ...accountQueries.detail(accountId), placeholderData: keepPreviousData });

  function focusTransactionsLink() {
    requestAnimationFrame(() => {
      document.getElementById(transactionsLinkId)?.focus();
    });
  }

  return (
    <DetailsPanel
      label="Account details"
      isLoaded={account !== undefined}
      isError={isError}
      isFetching={isFetching}
      isReplacing={isPlaceholderData}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={isKeptOpenOnDesktop}
      errorMessage="Couldn't load the account"
      returnFocusId={readAccountLinkId(accountId)}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      onChoose={onChoose}
      renderContent={(closeButton) =>
        account !== undefined && (
          <AccountOverview
            account={account}
            baseCurrency={baseCurrency}
            accountKinds={accountKinds}
            categoryTypes={categoryTypes}
            adjustBalanceLink={adjustBalanceLink}
            transactionsLink={transactionsLink}
            transactionsLinkId={transactionsLinkId}
            closeButton={closeButton}
            statusAction={
              account.status === 'DELETED' ? (
                <RestoreAccount
                  key={accountId}
                  accountId={accountId}
                  relatedQueryKeys={relatedQueryKeys}
                  onRestored={focusTransactionsLink}
                  onNameTaken={onRestoreNameTaken}
                />
              ) : (
                <DeleteAccount
                  key={accountId}
                  account={account}
                  currency={account.currency ?? baseCurrency}
                  isOnlyAccount={isOnlyAccount}
                  relatedQueryKeys={relatedQueryKeys}
                  onDeleted={isMoneyAccountKind(account.kind) ? onDeleted : focusTransactionsLink}
                />
              )
            }
            onEdit={onEdit}
          />
        )
      }
    />
  );
}
