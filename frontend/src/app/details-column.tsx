import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import {
  readLocationLinkId,
  readSelectedLocationId,
} from '@/features/locations/api/selected-location';
import { readSelectedTransactionId } from '@/features/transactions/api/selected-transaction';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
import { readSelectedEntry, type SelectedEntry, writeSelectedEntry } from './selected-entry';
import { SelectedLocationDetails } from './selected-location-details';
import { SelectedTransactionDetails } from './selected-transaction-details';
import type { ShownAccount } from './use-shown-account';

const BACK_LABEL = 'Transaction';

type OpenedEntry = Readonly<{ entry: SelectedEntry; ownerKey: string }>;

function readOwnerKey({
  searchParams,
  defaultTransactionId,
}: Readonly<{
  searchParams: URLSearchParams;
  defaultTransactionId: string | undefined;
}>): string {
  const ownerKey = [
    readSelectedTransactionId(searchParams) ?? defaultTransactionId,
    readSelectedAccountId(searchParams),
    readSelectedLocationId(searchParams),
  ].join(' ');
  return ownerKey;
}

function isSameEntry({
  entry,
  otherEntry,
}: Readonly<{ entry: SelectedEntry | undefined; otherEntry: SelectedEntry | undefined }>): boolean {
  const isSame = entry?.kind === otherEntry?.kind && entry?.id === otherEntry?.id;
  return isSame;
}

type TransactionOrEntryProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  omittedAccountIds: readonly string[] | undefined;
  omittedLocationIds: readonly string[] | undefined;
  accountCount: number | undefined;
}>;

function TransactionOrEntry({
  baseCurrency,
  defaultTransactionId,
  omittedAccountIds,
  omittedLocationIds,
  accountCount,
}: TransactionOrEntryProps) {
  const [searchParams] = useSearchParams();
  const entry = readSelectedEntry(searchParams);
  const ownerKey = readOwnerKey({ searchParams, defaultTransactionId });
  const [openedEntry, setOpenedEntry] = useState<OpenedEntry | undefined>(undefined);
  if (!isSameEntry({ entry, otherEntry: openedEntry?.entry })) {
    setOpenedEntry(entry === undefined ? undefined : { entry, ownerKey });
  }

  const isEntryOfOtherOwner =
    openedEntry !== undefined &&
    isSameEntry({ entry, otherEntry: openedEntry.entry }) &&
    openedEntry.ownerKey !== ownerKey;
  const shownEntry = isEntryOfOtherOwner ? undefined : entry;
  const back = {
    to: { search: writeSelectedEntry({ searchParams, entry: undefined }).toString() },
    label: BACK_LABEL,
  };
  if (shownEntry === undefined) {
    return (
      <>
        {isEntryOfOtherOwner && <Navigate to={back.to} replace />}
        <SelectedTransactionDetails
          baseCurrency={baseCurrency}
          defaultTransactionId={defaultTransactionId}
          readAccountLink={(account) =>
            omittedAccountIds?.includes(account.id) === true
              ? undefined
              : {
                  search: writeSelectedEntry({
                    searchParams,
                    entry: { kind: 'account', id: account.id },
                  }).toString(),
                }
          }
          readLocationLink={(locationId) =>
            omittedLocationIds?.includes(locationId) === true
              ? undefined
              : {
                  to: {
                    search: writeSelectedEntry({
                      searchParams,
                      entry: { kind: 'location', id: locationId },
                    }).toString(),
                  },
                  id: readLocationLinkId(locationId),
                }
          }
        />
      </>
    );
  }

  if (shownEntry.kind === 'location') {
    return <SelectedLocationDetails locationId={shownEntry.id} back={back} />;
  }

  return (
    <SelectedAccountDetails
      form="panel"
      baseCurrency={baseCurrency}
      accountCount={accountCount}
      shownAccount={{ kind: 'opened', accountId: shownEntry.id, back }}
      isKeptOpenOnDesktop={false}
      isMoneyAccountOnly={false}
    />
  );
}

type DetailsColumnProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  omittedAccountIds: readonly string[] | undefined;
  omittedLocationIds: readonly string[] | undefined;
  shownAccount: ShownAccount | undefined;
}>;

export function DetailsColumn({
  baseCurrency,
  defaultTransactionId,
  omittedAccountIds,
  omittedLocationIds,
  shownAccount,
}: DetailsColumnProps) {
  const { data: moneyAccountPage } = useQuery(
    accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: [...MONEY_ACCOUNT_KINDS],
      order: 'recent_use',
    }),
  );
  const accountCount = moneyAccountPage?.total;
  const transactionOrEntry = (
    <TransactionOrEntry
      baseCurrency={baseCurrency}
      defaultTransactionId={defaultTransactionId}
      omittedAccountIds={omittedAccountIds}
      omittedLocationIds={omittedLocationIds}
      accountCount={accountCount}
    />
  );
  if (shownAccount === undefined) {
    return <div className={styles['detailsColumn']}>{transactionOrEntry}</div>;
  }

  const { isAccountOpenedLast } = shownAccount;
  return (
    <div className={styles['detailsColumn']}>
      <div className={isAccountOpenedLast ? styles['selection'] : styles['earlierSelection']}>
        <SelectedAccountDetails
          form="panel"
          baseCurrency={baseCurrency}
          accountCount={accountCount}
          shownAccount={{
            kind: 'selected',
            defaultAccountId: shownAccount.defaultAccountId,
            isParamIgnored: false,
          }}
          isKeptOpenOnDesktop
          isMoneyAccountOnly={false}
        />
      </div>
      <div className={isAccountOpenedLast ? styles['earlierSelection'] : styles['selection']}>
        {transactionOrEntry}
      </div>
    </div>
  );
}
