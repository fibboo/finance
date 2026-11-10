import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { LOCALE } from '@/lib/format-money';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type TransactionText = readonly (string | Readonly<Account>)[];

type TransactionView = Readonly<{
  title: TransactionText;
  rowTitle: TransactionText;
  accountNames: TransactionText;
  markedAccount: Account;
  titleMarkedAccount: Account | null;
  amount: number;
  baseAmount: number | null;
  currency: string;
  signDisplay: Intl.NumberFormatOptions['signDisplay'];
  isIncome: boolean;
}>;

const WEEKDAY_FORMAT = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', timeZone: 'UTC' });

export function readWeekdayDateText(isoDate: string): string {
  const weekdayDateText = `${WEEKDAY_FORMAT.format(new Date(`${isoDate}T00:00:00Z`))}, ${toDateText(isoDate)}`;
  return weekdayDateText;
}

export function isDeletedAccount(account: Readonly<Account>): boolean {
  const isDeleted = account.status === 'DELETED';
  return isDeleted;
}

export function readPlainText(text: TransactionText): string {
  const plainText = text.map((part) => (typeof part === 'string' ? part : part.name)).join('');
  return plainText;
}

function requireField<Field>({
  value,
  name,
}: Readonly<{ value: Field | null | undefined; name: string }>): Field {
  if (value === null || value === undefined) {
    throw new Error(`The transaction has no ${name}.`);
  }

  return value;
}

export function readTypeLabel({
  transaction,
  transactionTypes,
}: Readonly<{
  transaction: Readonly<Transaction>;
  transactionTypes: readonly DictionaryItem[];
}>): string {
  const type = transactionTypes.find(
    (transactionType) => transactionType.key === transaction.transaction_type,
  );
  if (type === undefined) {
    throw new Error(`The transaction type ${transaction.transaction_type} has no label.`);
  }

  return type.label;
}

export function readTransactionView({
  transaction,
  transactionTypes,
}: Readonly<{
  transaction: Readonly<Transaction>;
  transactionTypes: readonly DictionaryItem[];
}>): TransactionView {
  const debit = requireField({ value: transaction.postings[0], name: 'debit' });
  const credit = requireField({ value: transaction.postings[1], name: 'credit' });
  switch (transaction.transaction_type) {
    case 'EXPENSE': {
      const view = {
        title: [credit.account],
        rowTitle: [credit.account],
        accountNames: [debit.account],
        markedAccount: debit.account,
        titleMarkedAccount: null,
        amount: Number(debit.amount),
        baseAmount: debit.base_amount === null ? null : Number(debit.base_amount),
        currency: debit.currency,
        signDisplay: 'exceptZero',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
    case 'INCOME': {
      const view = {
        title: [debit.account],
        rowTitle: [debit.account],
        accountNames: [credit.account],
        markedAccount: credit.account,
        titleMarkedAccount: null,
        amount: Number(credit.amount),
        baseAmount: credit.base_amount === null ? null : Number(credit.base_amount),
        currency: credit.currency,
        signDisplay: 'exceptZero',
        isIncome: true,
      } satisfies TransactionView;
      return view;
    }
    case 'TRANSFER': {
      const typeLabel = readTypeLabel({ transaction, transactionTypes });
      const view = {
        title: [`${typeLabel} `, debit.account, ' → ', credit.account],
        rowTitle: [debit.account, ' → '],
        accountNames: [],
        markedAccount: debit.account,
        titleMarkedAccount: credit.account,
        amount: -Number(debit.amount),
        baseAmount: debit.base_amount === null ? null : -Number(debit.base_amount),
        currency: debit.currency,
        signDisplay: 'auto',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
    case 'ADJUSTMENT': {
      const posting = credit.account.kind === 'EQUITY' ? debit : credit;
      const typeLabel = readTypeLabel({ transaction, transactionTypes });
      const view = {
        title: [typeLabel],
        rowTitle: [typeLabel],
        accountNames: [posting.account],
        markedAccount: posting.account,
        titleMarkedAccount: null,
        amount: Number(posting.amount),
        baseAmount: posting.base_amount === null ? null : Number(posting.base_amount),
        currency: posting.currency,
        signDisplay: 'exceptZero',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
  }
}
