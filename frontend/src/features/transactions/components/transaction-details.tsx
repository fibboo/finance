import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import type { components } from '@/lib/api-schema';

import { readTransactionLinkId } from '../api/selected-transaction';
import { transactionQueries } from '../api/transaction-queries';
import { DeleteTransaction } from './delete-transaction';
import { EditTransaction } from './edit-transaction';
import { type ReadLocationLink, TransactionOverview } from './transaction-overview';
import type { ReadAccountLink } from './transaction-postings';

type DictionaryItem = components['schemas']['DictionaryItem'];

type TransactionDetailsProps = Readonly<{
  transactionId: string;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  readAccountLink: ReadAccountLink;
  readLocationLink: ReadLocationLink;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  editButtonId: string;
  onEdit: () => void;
  onClose: () => void;
  onChoose: () => void;
}>;

export function TransactionDetails({
  transactionId,
  baseCurrency,
  transactionTypes,
  accountKinds,
  readAccountLink,
  readLocationLink,
  relatedQueryKeys,
  isShownByDefault,
  editButtonId,
  onEdit,
  onClose,
  onChoose,
}: TransactionDetailsProps) {
  const {
    data: transaction,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useQuery({ ...transactionQueries.detail(transactionId), placeholderData: keepPreviousData });
  return (
    <DetailsPanel
      label="Transaction details"
      isLoaded={transaction !== undefined}
      isError={isError}
      isFetching={isFetching}
      isReplacing={isPlaceholderData}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop
      errorMessage="Couldn't load the transaction"
      returnFocusId={readTransactionLinkId(transactionId)}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      onChoose={onChoose}
      renderContent={(closeButton) =>
        transaction !== undefined && (
          <TransactionOverview
            transaction={transaction}
            baseCurrency={baseCurrency}
            transactionTypes={transactionTypes}
            accountKinds={accountKinds}
            readAccountLink={readAccountLink}
            readLocationLink={readLocationLink}
            closeButton={closeButton}
            editAction={
              <EditTransaction id={editButtonId} transaction={transaction} onEdit={onEdit} />
            }
            deleteAction={
              <DeleteTransaction
                key={transactionId}
                transaction={transaction}
                transactionTypes={transactionTypes}
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
