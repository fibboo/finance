import { type QueryKey, useQuery } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import { Skeleton } from '@/components/skeleton/skeleton';
import type { components } from '@/lib/api-schema';

import { readTransactionLinkId } from '../api/selected-transaction';
import { transactionQueries } from '../api/transaction-queries';
import { DeleteTransaction } from './delete-transaction';
import { LoadError } from './load-error';
import styles from './transaction-details.module.css';
import { TransactionOverview } from './transaction-overview';

type DictionaryItem = components['schemas']['DictionaryItem'];

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';

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
  const backdropId = useId();
  const panelId = useId();

  function close() {
    onClose();
    document.getElementById(readTransactionLinkId(transactionId))?.focus();
  }

  useEffect(() => {
    function closeDetails() {
      onClose();
      document.getElementById(readTransactionLinkId(transactionId))?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.target === document.getElementById(backdropId)) {
        closeDetails();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const { target } = event;
      const dialog = target instanceof Element ? target.closest('[role="dialog"]') : null;
      const isInOtherDialog = dialog !== null && dialog.id !== panelId;
      if (event.key === 'Escape' && !isInOtherDialog) {
        closeDetails();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, transactionId, backdropId, panelId]);

  const closeButton = (
    <button type="button" className={styles['close']} aria-label="Close details" onClick={close}>
      <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={CLOSE_ICON_PATH} />
      </svg>
    </button>
  );
  return (
    <>
      <div id={backdropId} className={styles['backdrop']} aria-hidden="true" />
      <section
        id={panelId}
        ref={(panel) => {
          panel?.focus({ preventScroll: true });
          panel?.scrollIntoView({ block: 'nearest' });
        }}
        role="dialog"
        aria-label="Transaction details"
        aria-busy={transaction === undefined && !isError}
        tabIndex={-1}
        className={styles['transactionDetails']}
      >
        <span className={styles['handle']} aria-hidden="true" />
        {transaction !== undefined ? (
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
        )}
      </section>
    </>
  );
}
