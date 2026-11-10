import { formatAmountText } from '@/lib/amount-input';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';

import type { MovementTransactionType } from '../api/new-transaction';
import type { MovementFormValues } from '../schemas/transaction-form';
import { isDeletedAccount } from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type Posting = components['schemas']['Posting'];
type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type OwnChoices = Readonly<{
  fromAccount: Account | undefined;
  toAccount: Account | undefined;
  location: Location | undefined;
}>;

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

export function readOwnChoices(transaction: Readonly<Transaction>): OwnChoices {
  const fromAccount = readMovementPosting({ postings: transaction.postings, isFrom: true }).account;
  const toAccount = readMovementPosting({ postings: transaction.postings, isFrom: false }).account;
  const ownChoices = {
    fromAccount: isDeletedAccount(fromAccount) ? undefined : fromAccount,
    toAccount: isDeletedAccount(toAccount) ? undefined : toAccount,
    location:
      transaction.location === null || transaction.location.status === 'DELETED'
        ? undefined
        : transaction.location,
  };
  return ownChoices;
}

export function addOwnChoices<Choice extends Readonly<{ id: string }>>({
  choices,
  ownChoices,
}: Readonly<{
  choices: readonly Choice[] | undefined;
  ownChoices: readonly (Choice | undefined)[];
}>): readonly Choice[] | undefined {
  const ownedChoices =
    choices === undefined
      ? undefined
      : [
          ...choices,
          ...ownChoices.flatMap((ownChoice) =>
            ownChoice === undefined || choices.some((choice) => choice.id === ownChoice.id)
              ? []
              : [ownChoice],
          ),
        ];
  return ownedChoices;
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
  const isDestinationAmountShown =
    isIncome ||
    (isCurrencyChanged && (transactionType === 'EXPENSE' || toPosting.currency !== baseCurrency));
  const ownChoices = readOwnChoices(transaction);
  const isBaseCurrencyAmountAsked =
    isIncome && fromPosting.currency !== baseCurrency && toPosting.currency !== baseCurrency;
  const movementValues = {
    from_account_id: ownChoices.fromAccount?.id ?? '',
    to_account_id: ownChoices.toAccount?.id ?? '',
    location_id: ownChoices.location?.id ?? '',
    source_amount: !isIncome || isCurrencyChanged ? readAmountFieldText(fromPosting.amount) : '',
    source_currency: isIncome && isCurrencyChanged ? fromPosting.currency : '',
    is_paid_in_another_currency: transactionType !== 'TRANSFER' && isCurrencyChanged,
    destination_amount: isDestinationAmountShown ? readAmountFieldText(toPosting.amount) : '',
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
