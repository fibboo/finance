import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney, LOCALE } from '@/lib/format-money';

import { transactionMutations } from '../api/transaction-mutations';
import { transactionQueries } from '../api/transaction-queries';
import styles from './delete-transaction.module.css';
import { readTransactionView } from './transaction-view';

type Transaction = components['schemas']['Transaction'];

const DELETE_ICON_PATH =
  'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';
const ACCOUNT_LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

function readConfirmationText(transaction: Readonly<Transaction>): string {
  const view = readTransactionView(transaction);
  const amount = formatMoney({
    amount: view.amount,
    currency: view.currency,
    signDisplay: view.signDisplay,
  });
  const accountNames = [
    ...new Map(
      transaction.postings
        .filter((posting) => posting.account.kind !== 'EQUITY')
        .map((posting) => [posting.account.id, posting.account.name]),
    ).values(),
  ];
  const balances =
    accountNames.length === 1
      ? `The balance of ${ACCOUNT_LIST_FORMAT.format(accountNames)} is`
      : `The balances of ${ACCOUNT_LIST_FORMAT.format(accountNames)} are`;
  const confirmationText = `${view.title}, ${amount} on ${toDateText(transaction.transaction_date)}. ${balances} recalculated. This can't be undone.`;
  return confirmationText;
}

type DeleteTransactionProps = Readonly<{
  transaction: Readonly<Transaction>;
  relatedQueryKeys: readonly QueryKey[];
  onDeleted: () => void;
}>;

export function DeleteTransaction({
  transaction,
  relatedQueryKeys,
  onDeleted,
}: DeleteTransactionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation(transactionMutations.delete(relatedQueryKeys));
  const buttonId = useId();

  function cancel() {
    setIsConfirming(false);
    document.getElementById(buttonId)?.focus();
  }

  return (
    <>
      <button
        id={buttonId}
        type="button"
        className={styles['deleteButton']}
        onClick={() => {
          setIsConfirming(true);
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={DELETE_ICON_PATH} />
        </svg>
        Delete transaction
      </button>
      {isConfirming && (
        <DeleteConfirmation
          title="Delete this transaction?"
          text={readConfirmationText(transaction)}
          isPending={isPending}
          onCancel={cancel}
          onConfirm={() => {
            mutate(transaction, {
              onSuccess: () => {
                onDeleted();
                queryClient.removeQueries({
                  queryKey: transactionQueries.detail(transaction.id).queryKey,
                });
              },
            });
          }}
        />
      )}
    </>
  );
}
