import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH } from '@/components/action-button/action-icons';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import { transactionMutations } from '../api/transaction-mutations';
import { transactionQueries } from '../api/transaction-queries';
import {
  formatAccountList,
  readAccountNames,
  readPlainText,
  readTransactionView,
} from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];

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
  const accountNames = readAccountNames(
    transaction.postings.filter((posting) => posting.account.kind !== 'EQUITY'),
  );
  const balances =
    accountNames.length === 1
      ? `The balance of ${formatAccountList(accountNames)} is`
      : `The balances of ${formatAccountList(accountNames)} are`;
  const confirmationText = `${readPlainText(view.title)}, ${amount} on ${toDateText(transaction.transaction_date)}. ${balances} recalculated. This can't be undone.`;
  return confirmationText;
}

function readBlockingHint(transaction: Readonly<Transaction>): string | undefined {
  const deletedAccountNames = readAccountNames(
    transaction.postings.filter(
      (posting) => isMoneyAccountKind(posting.account.kind) && posting.account.status === 'DELETED',
    ),
  );
  const blockingHint =
    deletedAccountNames.length === 0
      ? undefined
      : `${formatAccountList(deletedAccountNames)} ${deletedAccountNames.length === 1 ? 'is' : 'are'} deleted.`;
  return blockingHint;
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
      <ActionButton
        id={buttonId}
        label="Delete transaction"
        iconPath={DELETE_ICON_PATH}
        isDanger
        action={{
          kind: 'button',
          blockingHint: readBlockingHint(transaction),
          onClick: () => {
            setIsConfirming(true);
          },
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
