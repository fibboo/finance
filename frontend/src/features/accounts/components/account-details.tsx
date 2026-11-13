import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountOverview } from './account-overview';
import { DeleteAccount } from './delete-account';
import { RestoreAccount } from './restore-account';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

type AccountDetailsProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  adjustBalanceLink: To;
  readTransactionsLink: (account: Readonly<Account>) => To;
  transactionsLinkId: string;
  isOnlyAccount: boolean;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onStatusChanged: () => void;
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
  readTransactionsLink,
  transactionsLinkId,
  isOnlyAccount,
  relatedQueryKeys,
  isShownByDefault,
  isKeptOpenOnDesktop,
  onEdit,
  onDeleted,
  onStatusChanged,
  onRestoreNameTaken,
  onClose,
  onChoose,
}: AccountDetailsProps) {
  const {
    data: account,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useQuery({ ...accountQueries.detail(accountId), placeholderData: keepPreviousData });

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
      arrowKeyList={undefined}
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
            transactionsLink={readTransactionsLink(account)}
            transactionsLinkId={transactionsLinkId}
            closeButton={closeButton}
            statusAction={
              account.status === 'DELETED' ? (
                <RestoreAccount
                  key={accountId}
                  accountId={accountId}
                  relatedQueryKeys={relatedQueryKeys}
                  onRestored={onStatusChanged}
                  onNameTaken={onRestoreNameTaken}
                />
              ) : (
                <DeleteAccount
                  key={accountId}
                  account={account}
                  currency={account.currency ?? baseCurrency}
                  isOnlyAccount={isOnlyAccount}
                  relatedQueryKeys={relatedQueryKeys}
                  onDeleted={isMoneyAccountKind(account.kind) ? onDeleted : onStatusChanged}
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
