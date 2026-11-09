import { Link, useSearchParams } from 'react-router';

import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney, formatRate } from '@/lib/format-money';

import {
  readSelectedTransactionId,
  readTransactionLinkId,
  writeSelectedTransaction,
} from '../api/selected-transaction';
import styles from './transaction-row.module.css';
import { TransactionTextParts } from './transaction-text-parts';
import { readTransactionView } from './transaction-view';

type Transaction = components['schemas']['Transaction'];

type TransactionRowProps = Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  dateLabel?: string | undefined;
}>;

export function TransactionRow({ transaction, baseCurrency, dateLabel }: TransactionRowProps) {
  const [searchParams] = useSearchParams();
  const view = readTransactionView(transaction);
  const isSelected = readSelectedTransactionId(searchParams) === transaction.id;
  const titleLink = (
    <Link
      id={readTransactionLinkId(transaction.id)}
      to={{
        search: writeSelectedTransaction({
          searchParams,
          transactionId: transaction.id,
        }).toString(),
      }}
      preventScrollReset
      aria-current={isSelected ? 'true' : undefined}
      className={styles['link']}
    >
      <TransactionTextParts text={view.title} />
    </Link>
  );
  return (
    <li
      className={`${styles['transactionRow'] ?? ''} ${styles[transaction.transaction_type.toLowerCase()] ?? ''} ${isSelected ? (styles['selected'] ?? '') : ''}`}
    >
      <span
        className={styles['dot']}
        style={{ color: readAccountColor(view.markedAccount) }}
        aria-hidden="true"
      />
      {view.accountNames === null ? (
        <span className={styles['wideTitle']}>
          {titleLink}
          {dateLabel !== undefined && <span className={styles['date']}>{dateLabel}</span>}
        </span>
      ) : (
        <>
          <span className={styles['title']}>
            {titleLink}
            {dateLabel !== undefined && <span className={styles['date']}>{dateLabel}</span>}
          </span>
          <span className={styles['accounts']}>
            <TransactionTextParts text={view.accountNames} />
          </span>
        </>
      )}
      <span className={styles['originalAmount']}>
        {view.currency !== baseCurrency &&
          formatMoney({
            amount: view.amount,
            currency: view.currency,
            signDisplay: view.signDisplay,
          })}
      </span>
      <span className={view.isIncome ? styles['incomeAmount'] : styles['amount']}>
        {view.baseAmount === null ? (
          <>
            <span aria-hidden="true">—</span>
            <span className="visually-hidden">not valued yet</span>
          </>
        ) : (
          formatMoney({
            amount: view.baseAmount,
            currency: baseCurrency,
            signDisplay: view.signDisplay,
          })
        )}
      </span>
      <span className={styles['rate']}>
        {view.currency !== baseCurrency &&
          view.baseAmount !== null &&
          view.baseAmount !== 0 &&
          formatRate(Math.abs(view.amount / view.baseAmount))}
      </span>
    </li>
  );
}
