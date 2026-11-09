import { useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountOverview } from './account-overview';

type DictionaryItem = components['schemas']['DictionaryItem'];

type AccountDetailsProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  onEdit: () => void;
  onClose: () => void;
}>;

export function AccountDetails({
  accountId,
  baseCurrency,
  accountKinds,
  adjustBalanceLink,
  transactionsLink,
  onEdit,
  onClose,
}: AccountDetailsProps) {
  const {
    data: account,
    isError,
    isFetching,
    refetch,
  } = useQuery(accountQueries.detail(accountId));
  return (
    <DetailsPanel
      label="Account details"
      isLoaded={account !== undefined}
      isError={isError}
      isFetching={isFetching}
      errorMessage="Couldn't load the account"
      returnFocusId={readAccountLinkId(accountId)}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      renderContent={(closeButton) =>
        account !== undefined && (
          <AccountOverview
            account={account}
            baseCurrency={baseCurrency}
            accountKinds={accountKinds}
            adjustBalanceLink={adjustBalanceLink}
            transactionsLink={transactionsLink}
            closeButton={closeButton}
            onEdit={onEdit}
          />
        )
      }
    />
  );
}
