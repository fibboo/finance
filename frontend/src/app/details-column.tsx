import { type To, useSearchParams } from 'react-router';

import { writeSelectedAccount } from '@/features/accounts/api/selected-account';
import {
  readLocationLinkId,
  writeSelectedLocation,
} from '@/features/locations/api/selected-location';
import type { components } from '@/lib/api-schema';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
import { SelectedLocationDetails } from './selected-location-details';
import { SelectedTransactionDetails } from './selected-transaction-details';
import type { ShownAccount } from './use-shown-account';

type Account = components['schemas']['Account'];

const ACCOUNT_SECTION_PATHNAMES = {
  ASSET: '/accounts',
  LIABILITY: '/accounts',
  EXPENSE: '/categories',
  INCOME: '/income-sources',
  EQUITY: '/accounts',
} as const satisfies Readonly<Record<Account['kind'], string>>;

function readAccountSectionLink(account: Readonly<Account>): To {
  const accountSectionLink = {
    pathname: ACCOUNT_SECTION_PATHNAMES[account.kind],
    search: writeSelectedAccount({
      searchParams: new URLSearchParams(),
      accountId: account.id,
    }).toString(),
  };
  return accountSectionLink;
}

type DetailsColumnProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  shownAccount: ShownAccount;
  accountCount: number | undefined;
  isAccountFirst: boolean;
  isEntryParamOwnedByPage: boolean;
}>;

export function DetailsColumn({
  baseCurrency,
  defaultTransactionId,
  shownAccount,
  accountCount,
  isAccountFirst,
  isEntryParamOwnedByPage,
}: DetailsColumnProps) {
  const [searchParams] = useSearchParams();
  const shownLocationId = isEntryParamOwnedByPage ? undefined : shownAccount.shownLocationId;
  const isEntryOpenedLast =
    !isEntryParamOwnedByPage &&
    (shownLocationId === undefined
      ? shownAccount.isAccountOpenedLast
      : shownAccount.isLocationOpenedLast);
  const transactionDetails = (
    <div className={isEntryOpenedLast ? styles['earlierSelection'] : styles['selection']}>
      <SelectedTransactionDetails
        baseCurrency={baseCurrency}
        defaultTransactionId={defaultTransactionId}
        readAccountLink={(account) =>
          isEntryParamOwnedByPage
            ? readAccountSectionLink(account)
            : { search: writeSelectedAccount({ searchParams, accountId: account.id }).toString() }
        }
        readLocationLink={(locationId) => ({
          to: isEntryParamOwnedByPage
            ? {
                pathname: '/locations',
                search: writeSelectedLocation({
                  searchParams: new URLSearchParams(),
                  locationId,
                }).toString(),
              }
            : { search: writeSelectedLocation({ searchParams, locationId }).toString() },
          id: readLocationLinkId(locationId),
        })}
      />
    </div>
  );
  const entryDetails = (
    <div className={isEntryOpenedLast ? styles['selection'] : styles['earlierSelection']}>
      {shownLocationId === undefined ? (
        <SelectedAccountDetails
          baseCurrency={baseCurrency}
          accountCount={accountCount}
          defaultAccountId={shownAccount.defaultAccountId}
          isKeptOpenOnDesktop
          isParamIgnored={shownAccount.isAccountParamStale}
          isParamOwnedByPage={isEntryParamOwnedByPage}
          isMoneyAccountOnly={false}
        />
      ) : (
        <SelectedLocationDetails locationId={shownLocationId} />
      )}
    </div>
  );
  return (
    <div className={styles['detailsColumn']}>
      {isAccountFirst ? entryDetails : transactionDetails}
      {isAccountFirst ? transactionDetails : entryDetails}
    </div>
  );
}
