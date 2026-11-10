import { formatAmountText } from '@/lib/amount-input';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';

import type { MovementTransactionType } from '../api/new-transaction';
import type { MovementFormValues } from '../schemas/transaction-form';

type Transaction = components['schemas']['Transaction'];
type Posting = components['schemas']['Posting'];

function readAmountFieldText(amount: string): string {
  const amountText = formatAmountText(amount.startsWith('-') ? amount.slice(1) : amount);
  return amountText;
}

function readMovementPosting({
  postings,
  isFrom,
}: Readonly<{ postings: readonly Posting[]; isFrom: boolean }>): Posting {
  const posting = postings.find((candidate) =>
    isFrom ? Number(candidate.amount) < 0 : Number(candidate.amount) > 0,
  );
  if (posting === undefined) {
    throw new Error(`A movement has no ${isFrom ? 'From' : 'To'} posting.`);
  }

  return posting;
}

export function readMovementValues({
  transaction,
  transactionType,
  baseCurrency,
}: Readonly<{
  transaction: Readonly<Transaction>;
  transactionType: MovementTransactionType;
  baseCurrency: string;
}>): MovementFormValues {
  const fromPosting = readMovementPosting({ postings: transaction.postings, isFrom: true });
  const toPosting = readMovementPosting({ postings: transaction.postings, isFrom: false });
  const isIncome = transactionType === 'INCOME';
  const isCurrencyChanged = fromPosting.currency !== toPosting.currency;
  const isBaseCurrencyAmountAsked =
    isIncome && fromPosting.currency !== baseCurrency && toPosting.currency !== baseCurrency;
  const movementValues = {
    from_account_id: fromPosting.account.id,
    to_account_id: toPosting.account.id,
    location_id: transaction.location?.id ?? '',
    source_amount: !isIncome || isCurrencyChanged ? readAmountFieldText(fromPosting.amount) : '',
    source_currency: isIncome && isCurrencyChanged ? fromPosting.currency : '',
    is_paid_in_another_currency: transactionType !== 'TRANSFER' && isCurrencyChanged,
    destination_amount: isIncome || isCurrencyChanged ? readAmountFieldText(toPosting.amount) : '',
    destination_currency:
      transactionType === 'EXPENSE' && isCurrencyChanged ? toPosting.currency : '',
    base_currency_amount:
      isBaseCurrencyAmountAsked && transaction.base_currency_amount !== null
        ? readAmountFieldText(transaction.base_currency_amount)
        : '',
    income_period: transaction.income_period ?? '',
    transaction_date: toDateText(transaction.transaction_date),
    comment: transaction.comment ?? '',
  } satisfies MovementFormValues;
  return movementValues;
}
