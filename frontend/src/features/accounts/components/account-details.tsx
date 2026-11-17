import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import type { To } from 'react-router';

import { type DetailsBack, DetailsPanel } from '@/components/details-panel/details-panel';
import { LoadError } from '@/components/load-error/load-error';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import { accountQueries } from '../api/account-queries';
import { readAccountLinkId } from '../api/selected-account';
import { AccountActions } from './account-actions';
import { AccountBalance } from './account-balance';
import styles from './account-details.module.css';
import { AccountOverview } from './account-overview';
import { AccountOverviewSkeleton } from './account-overview-skeleton';
import { AccountSummarySkeleton } from './account-summary-skeleton';
import { DeleteAccount } from './delete-account';
import { RestoreAccount } from './restore-account';

type Account = components['schemas']['Account'];
type AccountingDictionaries = components['schemas']['AccountingDictionaries'];

export type AccountDetailsForm = 'panel' | 'compact-panel' | 'summary';

const LOAD_ERROR_MESSAGE = "Couldn't load the account";

type AccountDetailsProps = Readonly<{
  form: AccountDetailsForm;
  accountId: string | undefined;
  baseCurrency: string;
  dictionaries: AccountingDictionaries | undefined;
  readAdjustBalanceLink: (account: Readonly<Account>) => To;
  readTransactionsLink: (account: Readonly<Account>) => To;
  transactionsLinkId: string;
  isOnlyAccount: boolean;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  isKeptOpenOnDesktop: boolean;
  back: DetailsBack | undefined;
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
  dictionaries,
  readAdjustBalanceLink,
  readTransactionsLink,
  transactionsLinkId,
  isOnlyAccount,
  relatedQueryKeys,
  isShownByDefault,
  isKeptOpenOnDesktop,
  back,
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
  } = useQuery({
    ...accountQueries.detail(accountId ?? ''),
    enabled: accountId !== undefined,
    placeholderData: keepPreviousData,
  });

  const statusAction =
    account === undefined ? undefined : account.status === 'DELETED' ? (
      <RestoreAccount
        key={account.id}
        accountId={account.id}
        relatedQueryKeys={relatedQueryKeys}
        onRestored={onStatusChanged}
        onNameTaken={onRestoreNameTaken}
      />
    ) : (
      <DeleteAccount
        key={account.id}
        account={account}
        currency={account.currency ?? baseCurrency}
        isOnlyAccount={isOnlyAccount}
        relatedQueryKeys={relatedQueryKeys}
        onDeleted={isMoneyAccountKind(account.kind) ? onDeleted : onStatusChanged}
      />
    );
  if (form === 'summary') {
    if (account === undefined) {
      return isError && !isFetching ? (
        <LoadError
          message={LOAD_ERROR_MESSAGE}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : (
        <AccountSummarySkeleton />
      );
    }

    return (
      <div className={`${styles['summary'] ?? ''} ${styles['squareActions'] ?? ''}`}>
        <AccountBalance account={account} baseCurrency={baseCurrency} isInline />
        {account.description !== undefined &&
          account.description !== null &&
          account.description !== '' && (
            <p className={styles['description']}>{account.description}</p>
          )}
        <AccountActions
          account={account}
          adjustBalanceLink={readAdjustBalanceLink(account)}
          transactionsLink={readTransactionsLink(account)}
          transactionsLinkId={transactionsLinkId}
          statusAction={statusAction}
          onEdit={onEdit}
        />
      </div>
    );
  }

  return (
    <DetailsPanel
      label="Account details"
      isLoaded={account !== undefined && dictionaries !== undefined}
      isError={isError}
      isFetching={isFetching}
      isReplacing={isPlaceholderData}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={isKeptOpenOnDesktop}
      errorMessage={LOAD_ERROR_MESSAGE}
      returnFocusId={readAccountLinkId(accountId ?? '')}
      arrowKeyList={undefined}
      back={back}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      onChoose={onChoose}
      renderSkeleton={(closeButton) => (
        <AccountOverviewSkeleton
          isCompact={form === 'compact-panel'}
          isMoneyAccount={account === undefined || isMoneyAccountKind(account.kind)}
          closeButton={closeButton}
        />
      )}
      renderContent={(closeButton) =>
        account !== undefined &&
        dictionaries !== undefined && (
          <AccountOverview
            isCompact={form === 'compact-panel'}
            account={account}
            baseCurrency={baseCurrency}
            accountKinds={dictionaries.account_kinds}
            categoryTypes={dictionaries.category_types}
            adjustBalanceLink={readAdjustBalanceLink(account)}
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
