import { isMoneyAccountKind } from '@/lib/account-kinds';
import { formatAmountText } from '@/lib/amount-input';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';

import type { AdjustmentFormValues } from '../schemas/transaction-form';
import { readAmountFieldText } from './movement-values';

type Transaction = components['schemas']['Transaction'];
type Posting = components['schemas']['Posting'];

export function readAdjustmentPosting(transaction: Readonly<Transaction>): Posting {
  const posting = transaction.postings.find((candidate) =>
    isMoneyAccountKind(candidate.account.kind),
  );
  if (posting === undefined) {
    throw new Error(`The adjustment ${transaction.id} has no posting of a money account.`);
  }

  return posting;
}

export function readAdjustmentValues(transaction: Readonly<Transaction>): AdjustmentFormValues {
  const posting = readAdjustmentPosting(transaction);
  const adjustmentValues = {
    account_id: posting.account.id,
    amount: formatAmountText(posting.amount),
    base_currency_amount:
      transaction.base_currency_amount === null
        ? ''
        : readAmountFieldText(transaction.base_currency_amount),
    transaction_date: toDateText(transaction.transaction_date),
    comment: transaction.comment ?? '',
  } satisfies AdjustmentFormValues;
  return adjustmentValues;
}
