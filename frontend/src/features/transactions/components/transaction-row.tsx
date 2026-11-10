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
type DictionaryItem = components['schemas']['DictionaryItem'];

const DETAILS_SEPARATOR = ' · ';

type TransactionRowProps = Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  isTop: boolean;
  dateLabel?: string | undefined;
}>;

function readRateText({
  amount,
  baseAmount,
}: Readonly<{ amount: number; baseAmount: number | null }>): string | undefined {
  const rateText =
    baseAmount === null || baseAmount === 0 ? undefined : formatRate(Math.abs(amount / baseAmount));
  return rateText;
}

export function TransactionRow({
  transaction,
  baseCurrency,
  transactionTypes,
  isTop,
  dateLabel,
}: TransactionRowProps) {
  const [searchParams] = useSearchParams();
  const view = readTransactionView({ transaction, transactionTypes });
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const isSelected = selectedTransactionId === transaction.id;
  const isShownByDefault = selectedTransactionId === undefined && isTop;
  const isForeign = view.currency !== baseCurrency;
  const rateText = isForeign
    ? readRateText({ amount: view.amount, baseAmount: view.baseAmount })
    : undefined;
  return (
    <li
      className={`${styles['transactionRow'] ?? ''} ${styles[transaction.transaction_type.toLowerCase()] ?? ''} ${isSelected ? (styles['selected'] ?? '') : ''} ${isShownByDefault ? (styles['shownByDefault'] ?? '') : ''}`}
    >
      <span
        className={styles['dot']}
        style={{ color: readAccountColor(view.markedAccount) }}
        aria-hidden="true"
      />
      <span className={styles['text']}>
        <span className={styles['title']}>
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
            <TransactionTextParts text={view.rowTitle} />
            {view.titleMarkedAccount !== null && (
              <>
                <span
                  className={styles['titleDot']}
                  style={{ color: readAccountColor(view.titleMarkedAccount) }}
                  aria-hidden="true"
                />
                <TransactionTextParts text={[view.titleMarkedAccount]} />
              </>
            )}
          </Link>
        </span>
        <span className={styles['details']}>
          {dateLabel !== undefined && (
            <>
              <span>{dateLabel}</span>
              {DETAILS_SEPARATOR}
            </>
          )}
          {view.accountNames.length > 0 && (
            <>
              <TransactionTextParts text={view.accountNames} />
              {DETAILS_SEPARATOR}
            </>
          )}
          {view.currency}
          {rateText !== undefined && `${DETAILS_SEPARATOR}${rateText}`}
        </span>
      </span>
      <span className={styles['amounts']}>
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
        {isForeign && (
          <span className={styles['originalAmount']}>
            {formatMoney({
              amount: view.amount,
              currency: view.currency,
              signDisplay: view.signDisplay,
            })}
          </span>
        )}
      </span>
    </li>
  );
}
