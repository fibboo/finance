import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountOverview } from './account-overview';
import { DeleteAccount } from './delete-account';

type DictionaryItem = components['schemas']['DictionaryItem'];

type AccountDetailsProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  isOnlyAccount: boolean;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  onEdit: () => void;
  onDeleted: () => void;
  onClose: () => void;
  onChoose: () => void;
}>;

export function AccountDetails({
  accountId,
  baseCurrency,
  accountKinds,
  adjustBalanceLink,
  transactionsLink,
  isOnlyAccount,
  relatedQueryKeys,
  isShownByDefault,
  isKeptOpenOnDesktop,
  onEdit,
  onDeleted,
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
            adjustBalanceLink={adjustBalanceLink}
            transactionsLink={transactionsLink}
            closeButton={closeButton}
            deleteAction={
              <DeleteAccount
                key={accountId}
                account={account}
                currency={account.currency ?? baseCurrency}
                isOnlyAccount={isOnlyAccount}
                relatedQueryKeys={relatedQueryKeys}
                onDeleted={onDeleted}
              />
            }
            onEdit={onEdit}
          />
        )
      }
    />
  );
}
