import type { components } from '@/lib/api-schema';
import { formatMoney, LOCALE } from '@/lib/format-money';

import styles from './transaction-day-list.module.css';
import { useToday } from '@/hooks/use-today';
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
}: Readonly<{ transactionDate: string; today: string }>): string {
  const date = new Date(`${transactionDate}T00:00:00Z`);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const daysAgo = (todayDate.getTime() - date.getTime()) / DAY_MILLISECONDS;
  const isThisYear = date.getUTCFullYear() === todayDate.getUTCFullYear();
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
    (total, transaction) =>
      transaction.transaction_type === 'TRANSFER'
        ? total
        : total + (readTransactionView(transaction).baseAmount ?? 0),
    0,
  );
  return dayTotal;
}

type TransactionDayListProps = Readonly<{
  transactions: readonly Transaction[];
  baseCurrency: string;
}>;

export function TransactionDayList({ transactions, baseCurrency }: TransactionDayListProps) {
  const today = useToday();
  return (
    <div className={styles['transactionDayList']}>
      <div className={styles['columns']} aria-hidden="true">
        <span />
        <span>Transaction</span>
        <span>Account</span>
        <span className={styles['amountColumn']}>Amount</span>
        <span className={styles['amountColumn']}>≈ {baseCurrency}</span>
      </div>
      {groupByDay(transactions).map((day) => (
        <div key={day.transactionDate} className={styles['day']}>
          <div className={styles['dayHeader']}>
            <h3 className={styles['dayLabel']}>
              {readDayLabel({ transactionDate: day.transactionDate, today })}
            </h3>
            {day.transactions.some(
              (transaction) => transaction.transaction_type !== 'TRANSFER',
            ) && (
              <span className={styles['dayTotal']}>
                {formatMoney({
                  amount: readDayTotal(day.transactions),
                  currency: baseCurrency,
                  signDisplay: 'exceptZero',
                })}
              </span>
            )}
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
