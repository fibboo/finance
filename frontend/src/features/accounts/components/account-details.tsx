import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { LoadError } from '@/components/load-error/load-error';
import { Skeleton } from '@/components/skeleton/skeleton';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountActions } from './account-actions';
import { AccountBalance } from './account-balance';
import styles from './account-details.module.css';
import { AccountOverview } from './account-overview';
import { DeleteAccount } from './delete-account';
import { RestoreAccount } from './restore-account';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type AccountDetailsForm = 'panel' | 'summary';

const LOAD_ERROR_MESSAGE = "Couldn't load the account";

type AccountDetailsProps = Readonly<{
  form: AccountDetailsForm;
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
  form,
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

  const statusAction =
    account === undefined ? undefined : account.status === 'DELETED' ? (
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
    );
  if (form === 'summary' && account === undefined) {
    return isError ? (
      <LoadError
        message={LOAD_ERROR_MESSAGE}
        onRetry={() => {
          void refetch();
        }}
      />
    ) : (
      <Skeleton className={styles['balanceSkeleton']} />
    );
  }

  if (form === 'summary') {
    return (
      account !== undefined && (
        <div className={styles['summary']}>
          <AccountBalance account={account} baseCurrency={baseCurrency} isInline />
          {account.description !== undefined &&
            account.description !== null &&
            account.description !== '' && (
              <p className={styles['description']}>{account.description}</p>
            )}
          <AccountActions
            account={account}
            adjustBalanceLink={adjustBalanceLink}
            transactionsLink={readTransactionsLink(account)}
            transactionsLinkId={transactionsLinkId}
            statusAction={statusAction}
            onEdit={onEdit}
          />
        </div>
      )
    );
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
      errorMessage={LOAD_ERROR_MESSAGE}
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
            statusAction={statusAction}
            onEdit={onEdit}
          />
        )
      }
    />
  );
}
