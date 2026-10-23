import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney, LOCALE } from '@/lib/format-money';

import styles from './transaction-row.module.css';

type Transaction = components['schemas']['Transaction'];
type Account = components['schemas']['Account'];

type TransactionView = Readonly<{
  title: string;
  accountNames: string;
  markedAccount: Account;
  amount: string;
  isIncome: boolean;
}>;

const DAY_MILLISECONDS = 86_400_000;

function requireField<Field>({
  value,
  name,
}: Readonly<{ value: Field | null | undefined; name: string }>): Field {
  if (value === null || value === undefined) {
    throw new Error(`The transaction has no ${name}.`);
  }

  return value;
}

function readTransactionView(transaction: Readonly<Transaction>): TransactionView {
  const debit = requireField({ value: transaction.postings[0], name: 'debit' });
  const credit = requireField({ value: transaction.postings[1], name: 'credit' });
  switch (transaction.transaction_type) {
    case 'EXPENSE': {
      const view = {
        title: credit.account.name,
        accountNames: debit.account.name,
        markedAccount: debit.account,
        amount: formatMoney({
          amount: Number(debit.amount),
          currency: debit.currency,
          signDisplay: 'exceptZero',
        }),
        isIncome: false,
      };
      return view;
    }
    case 'INCOME': {
      const view = {
        title: debit.account.name,
        accountNames: credit.account.name,
        markedAccount: credit.account,
        amount: formatMoney({
          amount: Number(credit.amount),
          currency: credit.currency,
          signDisplay: 'exceptZero',
        }),
        isIncome: true,
      };
      return view;
    }
    case 'TRANSFER': {
      const view = {
        title: `Transfer to ${credit.account.name}`,
        accountNames: `${debit.account.name} → ${credit.account.name}`,
        markedAccount: credit.account,
        amount: formatMoney({ amount: -Number(debit.amount), currency: debit.currency }),
        isIncome: false,
      };
      return view;
    }
    case 'ADJUSTMENT': {
      const posting = credit.account.kind === 'EQUITY' ? debit : credit;
      const view = {
        title: 'Balance adjustment',
        accountNames: posting.account.name,
        markedAccount: posting.account,
        amount: formatMoney({
          amount: Number(posting.amount),
          currency: posting.currency,
          signDisplay: 'exceptZero',
        }),
        isIncome: false,
      };
      return view;
    }
  }
}

function readDateLabel({
  transactionDate,
  today,
}: Readonly<{ transactionDate: string; today: Date }>): string {
  const date = new Date(`${transactionDate}T00:00:00Z`);
  const daysAgo =
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - date.getTime()) /
    DAY_MILLISECONDS;
  const isThisYear = date.getUTCFullYear() === today.getFullYear();
  const dateLabel =
    daysAgo === 0
      ? 'Today'
      : daysAgo === 1
        ? 'Yesterday'
        : new Intl.DateTimeFormat(LOCALE, {
            month: 'short',
            day: 'numeric',
            ...(isThisYear ? {} : { year: 'numeric' }),
            timeZone: 'UTC',
          }).format(date);
  return dateLabel;
}

type TransactionRowProps = Readonly<{ transaction: Readonly<Transaction> }>;

export function TransactionRow({ transaction }: TransactionRowProps) {
  const view = readTransactionView(transaction);
  return (
    <li className={styles['transactionRow']}>
      <span
        className={styles['dot']}
        style={{ color: readAccountColor(view.markedAccount) }}
        aria-hidden="true"
      />
      <span className={styles['title']}>{view.title}</span>
      <span className={styles['meta']}>
        <span className={styles['accounts']}>{view.accountNames}</span>
        <span className={styles['date']}>
          {readDateLabel({ transactionDate: transaction.transaction_date, today: new Date() })}
        </span>
      </span>
      <span className={view.isIncome ? styles['incomeAmount'] : styles['amount']}>
        {view.amount}
      </span>
    </li>
  );
}
