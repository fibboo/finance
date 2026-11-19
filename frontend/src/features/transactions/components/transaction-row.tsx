import { Link, useSearchParams } from 'react-router';

import { EstimatedAmount } from '@/components/estimated-amount/estimated-amount';
import type { ArrowKeySelectionProps } from '@/hooks/use-arrow-key-selection';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import {
  readSelectedTransactionId,
  readTransactionLinkId,
  writeSelectedTransaction,
} from '../api/selected-transaction';
import styles from './transaction-row.module.css';
import { TransactionTextParts } from './transaction-text-parts';
import {
  readForeignAmountsText,
  readMoneyEntryView,
  readRateText,
  readTransactionView,
} from './transaction-view';

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
  const transactionView = readTransactionView({ transaction, transactionTypes });
  const moneyEntryView = readMoneyEntryView({
    view: transactionView,
    transaction,
    transactionTypes,
    omittedAccountIds,
  });
  const view = moneyEntryView ?? transactionView;
  const isMoneyEntryOmitted = moneyEntryView !== undefined;
  const selectedTransactionId = readSelectedTransactionId(searchParams);
  const isSelected = arrowKeySelection !== undefined && selectedTransactionId === transaction.id;
  const isShownByDefault = selectedTransactionId === undefined && isTop;
  const isForeign = view.currency !== baseCurrency;
  const rateText = isForeign
    ? readRateText({
        amount: view.amount,
        referenceAmount: view.baseAmount ?? view.estimatedBaseAmount,
      })
    : undefined;
  const originalAmount = formatMoney({
    amount: view.amount,
    currency: view.currency,
    signDisplay: view.signDisplay,
  });
  const foreignAmounts = readForeignAmountsText({
    view,
    transactionView,
    baseCurrency,
    isTransfer: transaction.transaction_type === 'TRANSFER',
  });
  const isEntryInTitle = view.rowTitle.some(
    (part) => typeof part !== 'string' && omittedAccountIds.includes(part.id),
  );
  const rowTitle = isEntryInTitle ? view.accountNames : view.rowTitle;
  const accountNames = isEntryInTitle ? [] : view.accountNames;
  const currency = isMoneyEntryOmitted ? undefined : view.currency;
  const locationName =
    isMoneyEntryOmitted || isEntryInTitle ? transaction.location?.name : undefined;
  const rates = [rateText, view.currencyRate]
    .filter((rate) => rate !== undefined)
    .join(DETAILS_SEPARATOR);
  const hasPostingDetails = currency !== undefined || locationName !== undefined || rates !== '';
  const hasDetails = dateLabel !== undefined || accountNames.length > 0 || hasPostingDetails;
  const hasComment = transaction.comment !== null && transaction.comment !== '';
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
          <span className={styles['detailsText']}>
            {dateLabel !== undefined && <span>{dateLabel}</span>}
            {dateLabel !== undefined &&
              (accountNames.length > 0 || hasPostingDetails) &&
              DETAILS_SEPARATOR}
            {accountNames.length > 0 && (
              <>
                <TransactionTextParts text={accountNames} />
                {hasPostingDetails && DETAILS_SEPARATOR}
              </>
            )}
            {currency ?? locationName}
            {rates !== '' && (
              <span className={styles['rates']}>
                {(currency !== undefined || locationName !== undefined) && DETAILS_SEPARATOR}
                {rates}
              </span>
            )}
            {currency !== undefined &&
              locationName !== undefined &&
              `${DETAILS_SEPARATOR}${locationName}`}
          </span>
          {hasComment && (
            <span className={styles['comment']}>
              {hasDetails && (
                <span className={styles['commentSeparator']}>{DETAILS_SEPARATOR}</span>
              )}
              {transaction.comment}
            </span>
          )}
        </span>
      </span>
      <span className={styles['amounts']}>
        <span className={view.isIncome ? styles['incomeAmount'] : styles['amount']}>
          {view.baseAmount !== null ? (
            formatMoney({
              amount: view.baseAmount,
              currency: baseCurrency,
              signDisplay: view.signDisplay,
            })
          ) : view.estimatedBaseAmount !== null ? (
            <EstimatedAmount
              amount={view.estimatedBaseAmount}
              currency={baseCurrency}
              signDisplay={view.signDisplay}
            />
          ) : (
            <>
              {originalAmount}
              <span className="visually-hidden">, not valued yet</span>
            </>
          )}
        </span>
        {foreignAmounts !== '' && (
          <span className={styles['originalAmount']}>{foreignAmounts}</span>
        )}
      </span>
    </li>
  );
}
