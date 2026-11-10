import { ActionButton } from '@/components/action-button/action-button';
import { EDIT_ICON_PATH } from '@/components/action-button/action-icons';
import type { components } from '@/lib/api-schema';

import { formatAccountList, isDeletedAccount, readAccountNames } from './transaction-view';

type Transaction = components['schemas']['Transaction'];

function readBlockingHint(transaction: Readonly<Transaction>): string | undefined {
  const deletedAccountNames = readAccountNames(
    transaction.postings.filter((posting) => isDeletedAccount(posting.account)),
  );
  const blockingHint =
    deletedAccountNames.length === 0
      ? undefined
      : `${formatAccountList(deletedAccountNames)} ${deletedAccountNames.length === 1 ? 'is' : 'are'} deleted, so this transaction can't be edited.`;
  return blockingHint;
}

type EditTransactionProps = Readonly<{
  id: string;
  transaction: Readonly<Transaction>;
  onEdit: () => void;
}>;

export function EditTransaction({ id, transaction, onEdit }: EditTransactionProps) {
  return (
    <ActionButton
      id={id}
      label="Edit transaction"
      iconPath={EDIT_ICON_PATH}
      isDanger={false}
      action={{ kind: 'button', blockingHint: readBlockingHint(transaction), onClick: onEdit }}
    />
  );
}
