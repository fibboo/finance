import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { DeleteButton } from '@/components/delete-button/delete-button';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney, LOCALE } from '@/lib/format-money';

import { transactionMutations } from '../api/transaction-mutations';
import { transactionQueries } from '../api/transaction-queries';
import { readPlainText, readTransactionView } from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const ACCOUNT_LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

function readConfirmationText({
  transaction,
  transactionTypes,
}: Readonly<{
  transaction: Readonly<Transaction>;
  transactionTypes: readonly DictionaryItem[];
}>): string {
  const view = readTransactionView({ transaction, transactionTypes });
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
  const confirmationText = `${readPlainText(view.title)}, ${amount} on ${toDateText(transaction.transaction_date)}. ${balances} recalculated. This can't be undone.`;
  return confirmationText;
}

type DeleteTransactionProps = Readonly<{
  transaction: Readonly<Transaction>;
  transactionTypes: readonly DictionaryItem[];
  relatedQueryKeys: readonly QueryKey[];
  onDeleted: () => void;
}>;

export function DeleteTransaction({
  transaction,
  transactionTypes,
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
      <DeleteButton
        id={buttonId}
        label="Delete transaction"
        blockingHint={undefined}
        onClick={() => {
          setIsConfirming(true);
        }}
      />
      {isConfirming && (
        <DeleteConfirmation
          title="Delete this transaction?"
          text={readConfirmationText({ transaction, transactionTypes })}
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
