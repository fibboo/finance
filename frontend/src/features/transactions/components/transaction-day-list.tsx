import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './transaction-day-list.module.css';
import { useToday } from '@/hooks/use-today';
import { TransactionRow } from './transaction-row';
import { readTransactionView, readWeekdayDateText } from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];

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
  const dayLabel =
    daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : readWeekdayDateText(transactionDate);
  return dayLabel;
}

function readDayTotal({
  transactions,
  transactionTypes,
}: Readonly<{
  transactions: readonly Transaction[];
  transactionTypes: readonly DictionaryItem[];
}>): number {
  const dayTotal = transactions.reduce(
    (total, transaction) =>
      transaction.transaction_type === 'TRANSFER'
        ? total
        : total + (readTransactionView({ transaction, transactionTypes }).baseAmount ?? 0),
    0,
  );
  return dayTotal;
}

type TransactionDayListProps = Readonly<{
  transactions: readonly Transaction[];
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  isGroupedByDay: boolean;
}>;

export function TransactionDayList({
  transactions,
  baseCurrency,
  transactionTypes,
  isGroupedByDay,
}: TransactionDayListProps) {
  const today = useToday();
  const topTransactionId = transactions[0]?.id;
  return (
    <div className={styles['transactionDayList']}>
      {isGroupedByDay ? (
        groupByDay(transactions).map((day) => (
          <div
            key={day.transactionDate}
            data-transaction-date={day.transactionDate}
            className={styles['day']}
          >
            <div className={styles['dayHeader']}>
              <h3 className={styles['dayLabel']}>
                {readDayLabel({ transactionDate: day.transactionDate, today })}
              </h3>
              {day.transactions.some(
                (transaction) => transaction.transaction_type !== 'TRANSFER',
              ) && (
                <span className={styles['dayTotal']}>
                  {formatMoney({
                    amount: readDayTotal({ transactions: day.transactions, transactionTypes }),
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
                  transactionTypes={transactionTypes}
                  isTop={transaction.id === topTransactionId}
                />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <ul className={styles['transactions']}>
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              baseCurrency={baseCurrency}
              transactionTypes={transactionTypes}
              isTop={transaction.id === topTransactionId}
              dateLabel={readDayLabel({ transactionDate: transaction.transaction_date, today })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
