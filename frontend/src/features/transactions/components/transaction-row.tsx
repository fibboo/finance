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
  const sourceAmount = Number(transaction.source_amount);
  switch (transaction.transaction_type) {
    case 'EXPENSE': {
      const account = requireField({ value: transaction.from_account, name: 'account' });
      const view = {
        title: requireField({ value: transaction.category, name: 'category' }).name,
        accountNames: account.name,
        markedAccount: account,
        amount: formatMoney({
          amount: -sourceAmount,
          currency: transaction.source_currency,
          signDisplay: 'exceptZero',
        }),
        isIncome: false,
      };
      return view;
    }
    case 'INCOME': {
      const account = requireField({ value: transaction.to_account, name: 'account' });
      const view = {
        title: requireField({ value: transaction.income_source, name: 'income source' }).name,
        accountNames: account.name,
        markedAccount: account,
        amount: formatMoney({
          amount: Number(transaction.destination_amount),
          currency: transaction.destination_currency,
          signDisplay: 'exceptZero',
        }),
        isIncome: true,
      };
      return view;
    }
    case 'TRANSFER': {
      const fromAccount = requireField({ value: transaction.from_account, name: 'source account' });
      const toAccount = requireField({ value: transaction.to_account, name: 'target account' });
      const view = {
        title: `Transfer to ${toAccount.name}`,
        accountNames: `${fromAccount.name} → ${toAccount.name}`,
        markedAccount: toAccount,
        amount: formatMoney({ amount: sourceAmount, currency: transaction.source_currency }),
        isIncome: false,
      };
      return view;
    }
    case 'ADJUSTMENT': {
      const isIncrease = transaction.to_account !== null && transaction.to_account !== undefined;
      const account = requireField({
        value: isIncrease ? transaction.to_account : transaction.from_account,
        name: 'account',
      });
      const view = {
        title: 'Balance adjustment',
        accountNames: account.name,
        markedAccount: account,
        amount: formatMoney({
          amount: isIncrease ? sourceAmount : -sourceAmount,
          currency: transaction.source_currency,
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
