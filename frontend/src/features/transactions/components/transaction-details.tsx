import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';

import { DetailsPanel } from '@/components/details-panel/details-panel';
import type { components } from '@/lib/api-schema';

import { readTransactionLinkId } from '../api/selected-transaction';
import { transactionQueries } from '../api/transaction-queries';
import { DeleteTransaction } from './delete-transaction';
import { EditTransaction } from './edit-transaction';
import { TRANSACTION_ARROW_KEY_LIST } from './transaction-arrow-keys';
import {
  EXPENSE_FRAME,
  readTransactionFrame,
  type ReadLocationLink,
  TransactionOverview,
} from './transaction-overview';
import { TransactionOverviewEmpty } from './transaction-overview-empty';
import { TransactionOverviewSkeleton } from './transaction-overview-skeleton';
import type { ReadAccountLink } from './transaction-entry-block';

type AccountingDictionaries = components['schemas']['AccountingDictionaries'];

type TransactionDetailsProps = Readonly<{
  transactionId: string | undefined;
  isTransactionPending: boolean;
  baseCurrency: string;
  dictionaries: AccountingDictionaries | undefined;
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
  isTransactionPending,
  baseCurrency,
  dictionaries,
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
  } = useQuery({
    ...transactionQueries.detail(transactionId ?? ''),
    enabled: transactionId !== undefined,
    placeholderData: keepPreviousData,
  });
  const isEmpty = transactionId === undefined && !isTransactionPending;
  return (
    <DetailsPanel
      label="Transaction details"
      isLoaded={isEmpty || (transaction !== undefined && dictionaries !== undefined)}
      isError={isError}
      isFetching={isFetching}
      isReplacing={isPlaceholderData && !isEmpty}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop
      errorMessage="Couldn't load the transaction"
      returnFocusId={readTransactionLinkId(transactionId ?? '')}
      back={undefined}
      arrowKeyList={TRANSACTION_ARROW_KEY_LIST}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      onChoose={onChoose}
      renderSkeleton={(closeButton) => (
        <TransactionOverviewSkeleton
          transactionFrame={
            transaction === undefined || dictionaries === undefined
              ? EXPENSE_FRAME
              : readTransactionFrame({
                  transaction,
                  baseCurrency,
                  transactionTypes: dictionaries.transaction_types,
                })
          }
          closeButton={closeButton}
        />
      )}
      renderContent={(closeButton) =>
        isEmpty ? (
          <TransactionOverviewEmpty closeButton={closeButton} />
        ) : (
          transaction !== undefined &&
          dictionaries !== undefined && (
            <TransactionOverview
              transaction={transaction}
              baseCurrency={baseCurrency}
              transactionTypes={dictionaries.transaction_types}
              accountKinds={dictionaries.account_kinds}
              categoryTypes={dictionaries.category_types}
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
                  transactionTypes={dictionaries.transaction_types}
                  relatedQueryKeys={relatedQueryKeys}
                  onDeleted={onClose}
                />
              }
            />
          )
        )
      }
    />
  );
}
