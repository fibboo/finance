import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';

import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import {
  readLocationLinkId,
  readSelectedLocationId,
} from '@/features/locations/api/selected-location';
import {
  readSelectedTransactionId,
  readTransactionLinkId,
} from '@/features/transactions/api/selected-transaction';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
import { readSelectedEntry, type SelectedEntry, writeSelectedEntry } from './selected-entry';
import { SelectedLocationDetails } from './selected-location-details';
import { SelectedTransactionDetails } from './selected-transaction-details';
import type { ShownAccount } from './use-shown-account';

const BACK_LABEL = 'Transaction';

type EntryOwner = Readonly<{
  transactionId: string | undefined;
  accountId: string | undefined;
  locationId: string | undefined;
}>;

type OpenedEntry = Readonly<{ entry: SelectedEntry; owner: EntryOwner }>;

function readEntryOwner(searchParams: URLSearchParams): EntryOwner {
  const entryOwner = {
    transactionId: readSelectedTransactionId(searchParams),
    accountId: readSelectedAccountId(searchParams),
    locationId: readSelectedLocationId(searchParams),
  };
  return entryOwner;
}

function isOtherOwner({
  owner,
  openedOwner,
  defaultAccountId,
}: Readonly<{
  owner: EntryOwner;
  openedOwner: EntryOwner;
  defaultAccountId: string | undefined;
}>): boolean {
  const isOther =
    owner.transactionId !== openedOwner.transactionId ||
    owner.locationId !== openedOwner.locationId ||
    (owner.accountId !== openedOwner.accountId && owner.accountId !== defaultAccountId);
  return isOther;
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
  defaultAccountId: string | undefined;
  accountCount: number | undefined;
}>;

function TransactionOrEntry({
  baseCurrency,
  defaultTransactionId,
  omittedAccountIds,
  omittedLocationIds,
  defaultAccountId,
  accountCount,
}: TransactionOrEntryProps) {
  const [searchParams] = useSearchParams();
  const locationState: unknown = useLocation().state;
  const entry = readSelectedEntry(searchParams);
  const owner = readEntryOwner(searchParams);
  const [openedEntry, setOpenedEntry] = useState<OpenedEntry | undefined>(undefined);
  if (!isSameEntry({ entry, otherEntry: openedEntry?.entry })) {
    setOpenedEntry(entry === undefined ? undefined : { entry, owner });
  }

  const isEntryOfOtherOwner =
    openedEntry !== undefined &&
    isSameEntry({ entry, otherEntry: openedEntry.entry }) &&
    isOtherOwner({ owner, openedOwner: openedEntry.owner, defaultAccountId });
  const shownEntry = isEntryOfOtherOwner ? undefined : entry;
  const transactionId = owner.transactionId ?? defaultTransactionId;
  const back = {
    to: { search: writeSelectedEntry({ searchParams, entry: undefined }).toString() },
    label: BACK_LABEL,
    returnFocusId: transactionId === undefined ? '' : readTransactionLinkId(transactionId),
  };
  if (shownEntry === undefined) {
    return (
      <>
        {isEntryOfOtherOwner && <Navigate to={back.to} replace state={locationState} />}
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
  const [searchParams] = useSearchParams();
  const { data: moneyAccountPage } = useQuery({
    ...accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: [...MONEY_ACCOUNT_KINDS],
      order: 'recent_use',
    }),
    enabled: shownAccount !== undefined || readSelectedEntry(searchParams)?.kind === 'account',
  });
  const accountCount = moneyAccountPage?.total;
  const transactionOrEntry = (
    <TransactionOrEntry
      baseCurrency={baseCurrency}
      defaultTransactionId={defaultTransactionId}
      omittedAccountIds={omittedAccountIds}
      omittedLocationIds={omittedLocationIds}
      defaultAccountId={shownAccount?.defaultAccountId}
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
