import { useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { LoadError } from '@/components/load-error/load-error';
import { Skeleton } from '@/components/skeleton/skeleton';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import styles from './account-details.module.css';
import { AccountOverview } from './account-overview';

type DictionaryItem = components['schemas']['DictionaryItem'];

type AccountDetailsProps = Readonly<{
  accountId: string;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  onClose: () => void;
}>;

export function AccountDetails({
  accountId,
  baseCurrency,
  accountKinds,
  adjustBalanceLink,
  transactionsLink,
  onClose,
}: AccountDetailsProps) {
  const { data: account, isError, refetch } = useQuery(accountQueries.detail(accountId));
  return (
    <DetailsPanel
      label="Account details"
      isBusy={account === undefined && !isError}
      returnFocusId={readAccountLinkId(accountId)}
      onClose={onClose}
      renderContent={(closeButton) =>
        account !== undefined ? (
          <AccountOverview
            account={account}
            baseCurrency={baseCurrency}
            accountKinds={accountKinds}
            adjustBalanceLink={adjustBalanceLink}
            transactionsLink={transactionsLink}
            closeButton={closeButton}
          />
        ) : (
          <div className={styles['placeholder']}>
            {isError ? (
              <LoadError
                message="Couldn't load the account"
                onRetry={() => {
                  void refetch();
                }}
              />
            ) : (
              <div className={styles['skeleton']}>
                <Skeleton className={styles['metaSkeleton']} />
                <Skeleton className={styles['titleSkeleton']} />
                <Skeleton className={styles['balanceSkeleton']} />
              </div>
            )}
            {closeButton}
          </div>
        )
      }
    />
  );
}
