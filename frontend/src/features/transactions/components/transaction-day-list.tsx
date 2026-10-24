import type { components } from '@/lib/api-schema';
import { formatMoney, LOCALE } from '@/lib/format-money';

import styles from './transaction-day-list.module.css';
import { TransactionRow } from './transaction-row';
import { readTransactionView } from './transaction-view';

type Transaction = components['schemas']['Transaction'];

type TransactionDay = Readonly<{
  transactionDate: string;
  transactions: readonly Transaction[];
}>;

const DAY_MILLISECONDS = 86_400_000;

function groupByDay(transactions: readonly Transaction[]): readonly TransactionDay[] {
  const days: { transactionDate: string; transactions: Transaction[] }[] = [];
  for (const transaction of transactions) {
    const lastDay = days.at(-1);
    if (lastDay?.transactionDate === transaction.transaction_date) {
      lastDay.transactions.push(transaction);
    } else {
      days.push({ transactionDate: transaction.transaction_date, transactions: [transaction] });
    }
  }

  return days;
}

function readDayLabel({
  transactionDate,
  today,
}: Readonly<{ transactionDate: string; today: Date }>): string {
  const date = new Date(`${transactionDate}T00:00:00Z`);
  const daysAgo =
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - date.getTime()) /
    DAY_MILLISECONDS;
  const isThisYear = date.getUTCFullYear() === today.getFullYear();
  const dayLabel =
    daysAgo === 0
      ? 'Today'
      : daysAgo === 1
        ? 'Yesterday'
        : new Intl.DateTimeFormat(LOCALE, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            ...(isThisYear ? {} : { year: 'numeric' }),
            timeZone: 'UTC',
          }).format(date);
  return dayLabel;
}

function readDayTotal(transactions: readonly Transaction[]): number {
  const dayTotal = transactions.reduce(
    (total, transaction) => total + readTransactionView(transaction).dayTotalAmount,
    0,
  );
  return dayTotal;
}

type TransactionDayListProps = Readonly<{
  transactions: readonly Transaction[];
  baseCurrency: string;
}>;

export function TransactionDayList({ transactions, baseCurrency }: TransactionDayListProps) {
  const today = new Date();
  return (
    <div className={styles['transactionDayList']}>
      {groupByDay(transactions).map((day) => (
        <div key={day.transactionDate}>
          <div className={styles['dayHeader']}>
            <h3 className={styles['dayLabel']}>
              {readDayLabel({ transactionDate: day.transactionDate, today })}
            </h3>
            <span className={styles['dayTotal']}>
              {formatMoney({
                amount: readDayTotal(day.transactions),
                currency: baseCurrency,
                signDisplay: 'exceptZero',
              })}
            </span>
          </div>
          <ul className={styles['transactions']}>
            {day.transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                baseCurrency={baseCurrency}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
