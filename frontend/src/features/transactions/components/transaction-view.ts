import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney, formatRate, LOCALE } from '@/lib/format-money';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];
type Posting = components['schemas']['Posting'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type TransactionText = readonly (string | Readonly<Account>)[];

type CurrencyAmount = Readonly<{ amount: number; currency: string }>;

type TransactionView = Readonly<{
  title: TransactionText;
  rowTitle: TransactionText;
  accountNames: TransactionText;
  markedAccount: Account;
  titleMarkedAccount: Account | null;
  amount: number;
  baseAmount: number | null;
  estimatedBaseAmount: number | null;
  currency: string;
  signDisplay: Intl.NumberFormatOptions['signDisplay'];
  isIncome: boolean;
  otherAmount?: CurrencyAmount | undefined;
  currencyRate?: string | undefined;
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

function readOptionalAmount(amount: string | null | undefined): number | null {
  const optionalAmount = amount === null || amount === undefined ? null : Number(amount);
  return optionalAmount;
}

function readNegatedAmount(amount: string | null | undefined): number | null {
  const optionalAmount = readOptionalAmount(amount);
  const negatedAmount = optionalAmount === null ? null : 0 - optionalAmount;
  return negatedAmount;
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

export function readRateText({
  amount,
  referenceAmount,
}: Readonly<{ amount: number; referenceAmount: number | null }>): string | undefined {
  const rate = referenceAmount === null ? NaN : Math.abs(amount / referenceAmount);
  const rateText = Number.isFinite(rate) && rate > 0 ? formatRate(rate) : undefined;
  return rateText;
}

function readOtherAmount({
  reference,
  other,
}: Readonly<{ reference: Posting; other: Posting }>): Pick<
  TransactionView,
  'otherAmount' | 'currencyRate'
> {
  if (reference.currency === other.currency) {
    return {};
  }

  const otherAmount = { amount: Math.abs(Number(other.amount)), currency: other.currency };
  const rate = readRateText({
    amount: otherAmount.amount,
    referenceAmount: Number(reference.amount),
  });
  const currencyRate = rate === undefined ? undefined : `${otherAmount.currency} ${rate}`;
  return { otherAmount, currencyRate };
}

export function readForeignAmountsText({
  view,
  transactionView,
  baseCurrency,
  isTransfer,
}: Readonly<{
  view: TransactionView;
  transactionView: TransactionView;
  baseCurrency: string;
  isTransfer: boolean;
}>): string {
  const other = transactionView.otherAmount;
  const hasBaseAmount = view.baseAmount !== null || view.estimatedBaseAmount !== null;
  if (
    isTransfer &&
    hasBaseAmount &&
    transactionView.currency !== baseCurrency &&
    other !== undefined &&
    other.currency !== baseCurrency
  ) {
    const sent = formatMoney({
      amount: transactionView.amount,
      currency: transactionView.currency,
    });
    const received = formatMoney(other);
    return `${sent} → ${received}`;
  }

  const otherCurrencyAmount = other?.currency === view.currency ? transactionView : other;
  const amounts = [
    hasBaseAmount && view.currency !== baseCurrency
      ? formatMoney({ amount: view.amount, currency: view.currency, signDisplay: view.signDisplay })
      : undefined,
    otherCurrencyAmount !== undefined &&
    otherCurrencyAmount.currency !== baseCurrency &&
    otherCurrencyAmount.currency !== view.currency
      ? formatMoney({
          amount:
            view.amount < 0
              ? -Math.abs(otherCurrencyAmount.amount)
              : Math.abs(otherCurrencyAmount.amount),
          currency: otherCurrencyAmount.currency,
          signDisplay: view.signDisplay,
        })
      : undefined,
  ]
    .filter((amount) => amount !== undefined)
    .join(' → ');
  return amounts;
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
        ...readOtherAmount({ reference: debit, other: credit }),
        title: [credit.account],
        rowTitle: [credit.account],
        accountNames: [debit.account],
        markedAccount: debit.account,
        titleMarkedAccount: null,
        amount: Number(debit.amount),
        baseAmount: readOptionalAmount(debit.base_amount),
        estimatedBaseAmount: readOptionalAmount(debit.estimated_base_amount),
        currency: debit.currency,
        signDisplay: 'exceptZero',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
    case 'INCOME': {
      const view = {
        ...readOtherAmount({ reference: credit, other: debit }),
        title: [debit.account],
        rowTitle: [debit.account],
        accountNames: [credit.account],
        markedAccount: credit.account,
        titleMarkedAccount: null,
        amount: Number(credit.amount),
        baseAmount: readOptionalAmount(credit.base_amount),
        estimatedBaseAmount: readOptionalAmount(credit.estimated_base_amount),
        currency: credit.currency,
        signDisplay: 'exceptZero',
        isIncome: true,
      } satisfies TransactionView;
      return view;
    }
    case 'TRANSFER': {
      const typeLabel = readTypeLabel({ transaction, transactionTypes });
      const view = {
        ...readOtherAmount({ reference: debit, other: credit }),
        title: [`${typeLabel} `, debit.account, ' → ', credit.account],
        rowTitle: [debit.account, ' → '],
        accountNames: [],
        markedAccount: debit.account,
        titleMarkedAccount: credit.account,
        amount: -Number(debit.amount),
        baseAmount: readNegatedAmount(debit.base_amount),
        estimatedBaseAmount: readNegatedAmount(debit.estimated_base_amount),
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
        baseAmount: readOptionalAmount(posting.base_amount),
        estimatedBaseAmount: readOptionalAmount(posting.estimated_base_amount),
        currency: posting.currency,
        signDisplay: 'exceptZero',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
  }
}

export function readMoneyEntryView({
  view,
  transaction,
  transactionTypes,
  omittedAccountIds,
}: Readonly<{
  view: TransactionView;
  transaction: Readonly<Transaction>;
  transactionTypes: readonly DictionaryItem[];
  omittedAccountIds: readonly string[];
}>): TransactionView | undefined {
  const entryPosting = transaction.postings.find(
    (posting) =>
      omittedAccountIds.includes(posting.account.id) && isMoneyAccountKind(posting.account.kind),
  );
  if (entryPosting === undefined) {
    return undefined;
  }

  if (transaction.transaction_type !== 'TRANSFER') {
    const entryView = { ...view, accountNames: [] };
    return entryView;
  }

  const otherPosting = requireField({
    value: transaction.postings.find((posting) => posting.account.id !== entryPosting.account.id),
    name: 'other account',
  });
  const amount = Number(entryPosting.amount);
  const arrow = amount < 0 ? '→' : '←';
  const entryView = {
    ...view,
    rowTitle: [
      `${readTypeLabel({ transaction, transactionTypes })} ${arrow} `,
      otherPosting.account,
    ],
    accountNames: [],
    markedAccount: entryPosting.account,
    titleMarkedAccount: null,
    amount,
    baseAmount: readOptionalAmount(entryPosting.base_amount),
    estimatedBaseAmount: readOptionalAmount(entryPosting.estimated_base_amount),
    currency: entryPosting.currency,
    signDisplay: 'exceptZero',
  } satisfies TransactionView;
  return entryView;
}
