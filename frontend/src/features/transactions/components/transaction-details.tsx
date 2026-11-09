import { type QueryKey, useQuery } from '@tanstack/react-query';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import type { components } from '@/lib/api-schema';

import { readTransactionLinkId } from '../api/selected-transaction';
import { transactionQueries } from '../api/transaction-queries';
import { DeleteTransaction } from './delete-transaction';
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
  const { data: transaction, status, refetch } = useQuery(transactionQueries.detail(transactionId));
  return (
    <DetailsPanel
      label="Transaction details"
      status={status}
      errorMessage="Couldn't load the transaction"
      returnFocusId={readTransactionLinkId(transactionId)}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      renderContent={(closeButton) =>
        transaction !== undefined && (
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
        )
      }
    />
  );
}
