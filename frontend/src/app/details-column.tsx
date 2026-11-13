import { useSearchParams } from 'react-router';

import { writeSelectedAccount } from '@/features/accounts/api/selected-account';
import {
  readLocationLinkId,
  writeSelectedLocation,
} from '@/features/locations/api/selected-location';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
import { SelectedLocationDetails } from './selected-location-details';
import { SelectedTransactionDetails } from './selected-transaction-details';
import type { ShownAccount } from './use-shown-account';

type DetailsColumnProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  shownAccount: ShownAccount;
  accountCount: number | undefined;
  isAccountFirst: boolean;
}>;

export function DetailsColumn({
  baseCurrency,
  defaultTransactionId,
  shownAccount,
  accountCount,
  isAccountFirst,
}: DetailsColumnProps) {
  const [searchParams] = useSearchParams();
  const { shownLocationId } = shownAccount;
  const isEntryOpenedLast =
    shownLocationId === undefined
      ? shownAccount.isAccountOpenedLast
      : shownAccount.isLocationOpenedLast;
  const transactionDetails = (
    <div className={isEntryOpenedLast ? styles['earlierSelection'] : styles['selection']}>
      <SelectedTransactionDetails
        baseCurrency={baseCurrency}
        defaultTransactionId={defaultTransactionId}
        readAccountLink={(accountId) => ({
          search: writeSelectedAccount({ searchParams, accountId }).toString(),
        })}
        readLocationLink={(locationId) => ({
          to: { search: writeSelectedLocation({ searchParams, locationId }).toString() },
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
