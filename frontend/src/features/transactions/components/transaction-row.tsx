import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './transaction-row.module.css';
import { readTransactionView } from './transaction-view';

type Transaction = components['schemas']['Transaction'];

const UNVALUED_AMOUNT = '—';

type TransactionRowProps = Readonly<{ transaction: Readonly<Transaction>; baseCurrency: string }>;

export function TransactionRow({ transaction, baseCurrency }: TransactionRowProps) {
  const view = readTransactionView(transaction);
  return (
    <li className={styles['transactionRow']}>
      <span
        className={styles['dot']}
        style={{ color: readAccountColor(view.markedAccount) }}
        aria-hidden="true"
      />
      <span className={styles['title']}>{view.title}</span>
      <span className={styles['accounts']}>{view.accountNames}</span>
      <span className={view.isIncome ? styles['incomeAmount'] : styles['amount']}>
        {formatMoney({
          amount: view.amount,
          currency: view.currency,
          signDisplay: view.signDisplay,
        })}
      </span>
      <span className={styles['baseAmount']}>
        {view.baseAmount === null
          ? UNVALUED_AMOUNT
          : formatMoney({
              amount: view.baseAmount,
              currency: baseCurrency,
              signDisplay: view.signDisplay,
            })}
      </span>
    </li>
  );
}
