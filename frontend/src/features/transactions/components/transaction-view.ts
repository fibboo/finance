import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { LOCALE } from '@/lib/format-money';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];
type Posting = components['schemas']['Posting'];
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

export function readFirstMoneyAccountId(transaction: Readonly<Transaction>): string | undefined {
  const firstMoneyAccountId = transaction.postings.find(
    (posting) => isMoneyAccountKind(posting.account.kind) && !isDeletedAccount(posting.account),
  )?.account.id;
  return firstMoneyAccountId;
}

export function readAccountNames(postings: readonly Posting[]): string[] {
  const accountNames = [
    ...new Map(postings.map((posting) => [posting.account.id, posting.account.name])).values(),
  ];
  return accountNames;
}

const ACCOUNT_LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' });

export function formatAccountList(accountNames: readonly string[]): string {
  const accountList = ACCOUNT_LIST_FORMAT.format(accountNames);
  return accountList;
}

export function isDeletedAccount(account: Readonly<Account>): boolean {
  const isDeleted = account.status === 'DELETED';
  return isDeleted;
}

export function readDeletedMoneyAccountNames(transaction: Readonly<Transaction>): string[] {
  const deletedAccountNames = readAccountNames(
    transaction.postings.filter(
      (posting) => isMoneyAccountKind(posting.account.kind) && isDeletedAccount(posting.account),
    ),
  );
  return deletedAccountNames;
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

function readAdjustmentPosting({
  debit,
  credit,
}: Readonly<{ debit: Posting; credit: Posting }>): Posting {
  const posting = debit.account.kind === 'EQUITY' ? credit : debit;
  return posting;
}

export type TransactionEntry = Readonly<{ role: 'From' | 'To'; posting: Posting }>;

export function readTransactionEntries(transaction: Readonly<Transaction>): TransactionEntry[] {
  const debit = requireField({ value: transaction.postings[0], name: 'debit' });
  const credit = requireField({ value: transaction.postings[1], name: 'credit' });
  if (transaction.transaction_type !== 'ADJUSTMENT') {
    const entries = [
      { role: 'From', posting: debit },
      { role: 'To', posting: credit },
    ] satisfies TransactionEntry[];
    return entries;
  }

  const posting = readAdjustmentPosting({ debit, credit });
  const entries = [
    { role: Number(posting.amount) < 0 ? 'From' : 'To', posting },
  ] satisfies TransactionEntry[];
  return entries;
}

export function readExchangeDifference(transaction: Readonly<Transaction>): number | undefined {
  const valuationPostings = transaction.postings.filter(
    (posting) =>
      Number(posting.amount) === 0 &&
      isMoneyAccountKind(posting.account.kind) &&
      posting.base_amount !== null,
  );
  const exchangeDifference =
    valuationPostings.length === 0
      ? undefined
      : valuationPostings.reduce((sum, posting) => sum + Number(posting.base_amount), 0);
  return exchangeDifference;
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
      const posting = readAdjustmentPosting({ debit, credit });
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
