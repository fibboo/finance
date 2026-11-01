import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { LOCALE } from '@/lib/format-money';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];

type TransactionView = Readonly<{
  title: string;
  accountNames: string | null;
  markedAccount: Account;
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

function requireField<Field>({
  value,
  name,
}: Readonly<{ value: Field | null | undefined; name: string }>): Field {
  if (value === null || value === undefined) {
    throw new Error(`The transaction has no ${name}.`);
  }

  return value;
}

export function readTransactionView(transaction: Readonly<Transaction>): TransactionView {
  const debit = requireField({ value: transaction.postings[0], name: 'debit' });
  const credit = requireField({ value: transaction.postings[1], name: 'credit' });
  switch (transaction.transaction_type) {
    case 'EXPENSE': {
      const view = {
        title: credit.account.name,
        accountNames: debit.account.name,
        markedAccount: debit.account,
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
        title: debit.account.name,
        accountNames: credit.account.name,
        markedAccount: credit.account,
        amount: Number(credit.amount),
        baseAmount: credit.base_amount === null ? null : Number(credit.base_amount),
        currency: credit.currency,
        signDisplay: 'exceptZero',
        isIncome: true,
      } satisfies TransactionView;
      return view;
    }
    case 'TRANSFER': {
      const view = {
        title: `Transfer ${debit.account.name} → ${credit.account.name}`,
        accountNames: null,
        markedAccount: credit.account,
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
      const view = {
        title: `Balance adjustment · ${posting.account.name}`,
        accountNames: null,
        markedAccount: posting.account,
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
