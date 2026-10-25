import type { components } from '@/lib/api-schema';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];

type TransactionView = Readonly<{
  title: string;
  accountNames: string;
  markedAccount: Account;
  amount: number;
  baseAmount: number;
  currency: string;
  signDisplay: Intl.NumberFormatOptions['signDisplay'];
  isIncome: boolean;
}>;

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
        baseAmount: Number(debit.base_amount),
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
        baseAmount: Number(credit.base_amount),
        currency: credit.currency,
        signDisplay: 'exceptZero',
        isIncome: true,
      } satisfies TransactionView;
      return view;
    }
    case 'TRANSFER': {
      const view = {
        title: `Transfer to ${credit.account.name}`,
        accountNames: `${debit.account.name} → ${credit.account.name}`,
        markedAccount: credit.account,
        amount: -Number(debit.amount),
        baseAmount: -Number(debit.base_amount),
        currency: debit.currency,
        signDisplay: 'auto',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
    case 'ADJUSTMENT': {
      const posting = credit.account.kind === 'EQUITY' ? debit : credit;
      const view = {
        title: 'Balance adjustment',
        accountNames: posting.account.name,
        markedAccount: posting.account,
        amount: Number(posting.amount),
        baseAmount: Number(posting.base_amount),
        currency: posting.currency,
        signDisplay: 'exceptZero',
        isIncome: false,
      } satisfies TransactionView;
      return view;
    }
  }
}
