import { Link, useSearchParams } from 'react-router';

import type { ArrowKeySelectionProps } from '@/hooks/use-arrow-key-selection';
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
  arrowKeySelection: ArrowKeySelectionProps | undefined;
  omittedAccountIds?: readonly string[] | undefined;
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
  arrowKeySelection,
  omittedAccountIds = [],
  dateLabel,
}: TransactionRowProps) {
  const [searchParams] = useSearchParams();
  const view = readTransactionView({ transaction, transactionTypes });
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const isSelected = arrowKeySelection !== undefined && selectedTransactionId === transaction.id;
  const isShownByDefault = selectedTransactionId === undefined && isTop;
  const isForeign = view.currency !== baseCurrency;
  const rateText = isForeign
    ? readRateText({ amount: view.amount, baseAmount: view.baseAmount })
    : undefined;
  const isEntryInTitle = view.rowTitle.some(
    (part) => typeof part !== 'string' && omittedAccountIds.includes(part.id),
  );
  const rowTitle = isEntryInTitle ? view.accountNames : view.rowTitle;
  const accountNames = isEntryInTitle ? [] : view.accountNames;
  const locationName = isEntryInTitle ? transaction.location?.name : undefined;
  const title = (
    <>
      <TransactionTextParts text={rowTitle} />
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
    </>
  );
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
          {arrowKeySelection === undefined ? (
            title
          ) : (
            <Link
              {...arrowKeySelection}
              data-shown-by-default={isShownByDefault ? '' : undefined}
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
              {title}
            </Link>
          )}
        </span>
        <span className={styles['details']}>
          {dateLabel !== undefined && (
            <>
              <span>{dateLabel}</span>
              {DETAILS_SEPARATOR}
            </>
          )}
          {accountNames.length > 0 && (
            <>
              <TransactionTextParts text={accountNames} />
              {DETAILS_SEPARATOR}
            </>
          )}
          {view.currency}
          {rateText !== undefined && `${DETAILS_SEPARATOR}${rateText}`}
          {locationName !== undefined && `${DETAILS_SEPARATOR}${locationName}`}
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
