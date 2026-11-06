import { type QueryKey, useQuery } from '@tanstack/react-query';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import { LoadError } from '@/components/load-error/load-error';
import { Skeleton } from '@/components/skeleton/skeleton';
import type { components } from '@/lib/api-schema';

import { readTransactionLinkId } from '../api/selected-transaction';
import { transactionQueries } from '../api/transaction-queries';
import { DeleteTransaction } from './delete-transaction';
import styles from './transaction-details.module.css';
import { TransactionOverview } from './transaction-overview';

type DictionaryItem = components['schemas']['DictionaryItem'];

type TransactionDetailsProps = Readonly<{
  transactionId: string;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  relatedQueryKeys: readonly QueryKey[];
  onClose: () => void;
}>;

export function TransactionDetails({
  transactionId,
  baseCurrency,
  transactionTypes,
  accountKinds,
  relatedQueryKeys,
  onClose,
}: TransactionDetailsProps) {
  const {
    data: transaction,
    isError,
    refetch,
  } = useQuery(transactionQueries.detail(transactionId));
  return (
    <DetailsPanel
      label="Transaction details"
      isBusy={transaction === undefined && !isError}
      returnFocusId={readTransactionLinkId(transactionId)}
      onClose={onClose}
      renderContent={(closeButton) =>
        transaction !== undefined ? (
          <TransactionOverview
            transaction={transaction}
            baseCurrency={baseCurrency}
            transactionTypes={transactionTypes}
            accountKinds={accountKinds}
            closeButton={closeButton}
            deleteAction={
              <DeleteTransaction
                transaction={transaction}
                relatedQueryKeys={relatedQueryKeys}
                onDeleted={onClose}
              />
            }
          />
        ) : (
          <div className={styles['placeholder']}>
            {isError ? (
              <LoadError
                message="Couldn't load the transaction"
                onRetry={() => {
                  void refetch();
                }}
              />
            ) : (
              <div className={styles['skeleton']}>
                <Skeleton className={styles['metaSkeleton']} />
                <Skeleton className={styles['titleSkeleton']} />
                <Skeleton className={styles['amountSkeleton']} />
              </div>
            )}
            {closeButton}
          </div>
        )
      }
    />
  );
}
