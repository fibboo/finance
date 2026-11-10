import { useSearchParams } from 'react-router';

import {
  readSelectedAccountId,
  SELECTED_ACCOUNT_PARAM,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import {
  readSelectedTransactionId,
  SELECTED_TRANSACTION_PARAM,
} from '@/features/transactions/api/selected-transaction';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
import { SelectedTransactionDetails } from './selected-transaction-details';

type DetailsColumnProps = Readonly<{
  baseCurrency: string;
  defaultTransactionId: string | undefined;
  defaultAccountId: string | undefined;
  accountCount: number | undefined;
  isAccountFirst: boolean;
}>;

function readIsAccountOpenedLast(searchParams: URLSearchParams): boolean {
  const keys = [...searchParams.keys()];
  const isAccountOpenedLast =
    readSelectedAccountId(searchParams) !== undefined &&
    (readSelectedTransactionId(searchParams) === undefined ||
      keys.indexOf(SELECTED_ACCOUNT_PARAM) > keys.indexOf(SELECTED_TRANSACTION_PARAM));
  return isAccountOpenedLast;
}

export function DetailsColumn({
  baseCurrency,
  defaultTransactionId,
  defaultAccountId,
  accountCount,
  isAccountFirst,
}: DetailsColumnProps) {
  const [searchParams] = useSearchParams();
  const isAccountOpenedLast = readIsAccountOpenedLast(searchParams);
  const transactionDetails = (
    <div className={isAccountOpenedLast ? styles['earlierSelection'] : styles['selection']}>
      <SelectedTransactionDetails
        baseCurrency={baseCurrency}
        defaultTransactionId={defaultTransactionId}
        readAccountLink={(accountId) => ({
          search: writeSelectedAccount({ searchParams, accountId }).toString(),
        })}
      />
    </div>
  );
  const accountDetails = (
    <div className={isAccountOpenedLast ? styles['selection'] : styles['earlierSelection']}>
      <SelectedAccountDetails
        baseCurrency={baseCurrency}
        accountCount={accountCount}
        defaultAccountId={defaultAccountId}
        isKeptOpenOnDesktop
      />
    </div>
  );
  return (
    <div className={styles['detailsColumn']}>
      {isAccountFirst ? accountDetails : transactionDetails}
      {isAccountFirst ? transactionDetails : accountDetails}
    </div>
  );
}
