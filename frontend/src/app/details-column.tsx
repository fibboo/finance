import { useSearchParams } from 'react-router';

import { writeSelectedAccount } from '@/features/accounts/api/selected-account';

import styles from './details-column.module.css';
import { SelectedAccountDetails } from './selected-account-details';
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
  const { isAccountOpenedLast } = shownAccount;
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
        defaultAccountId={shownAccount.defaultAccountId}
        isKeptOpenOnDesktop
        isParamIgnored={shownAccount.isAccountParamStale}
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
