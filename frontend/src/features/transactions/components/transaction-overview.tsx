import { type ReactNode, useId } from 'react';

import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './transaction-overview.module.css';
import { TransactionPostings } from './transaction-postings';
import { readTransactionView, readWeekdayDateText } from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];

function readTypeLabel({
  transaction,
  transactionTypes,
}: Readonly<{ transaction: Transaction; transactionTypes: readonly DictionaryItem[] }>): string {
  const type = transactionTypes.find(
    (transactionType) => transactionType.key === transaction.transaction_type,
  );
  if (type === undefined) {
    throw new Error(`The transaction type ${transaction.transaction_type} has no label.`);
  }

  return type.label;
}

function readBaseAmount({
  transaction,
  baseAmount,
}: Readonly<{ transaction: Transaction; baseAmount: number | null }>): number | undefined {
  const estimatedAmount = transaction.estimated_base_currency_amount;
  const amount =
    baseAmount ??
    (estimatedAmount === null || estimatedAmount === undefined
      ? undefined
      : Number(estimatedAmount));
  return amount;
}

type TransactionOverviewProps = Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  closeButton: ReactNode;
  deleteAction: ReactNode;
}>;

export function TransactionOverview({
  transaction,
  baseCurrency,
  transactionTypes,
  accountKinds,
  closeButton,
  deleteAction,
}: TransactionOverviewProps) {
  const titleId = useId();
  const view = readTransactionView(transaction);
  const baseAmount = readBaseAmount({ transaction, baseAmount: view.baseAmount });
  return (
    <article aria-labelledby={titleId} className={styles['transactionOverview']}>
      <div className={styles['header']}>
        <div className={styles['heading']}>
          <span className={styles['meta']}>
            {readTypeLabel({ transaction, transactionTypes })} ·{' '}
            {readWeekdayDateText(transaction.transaction_date)}
          </span>
          <h2 id={titleId} className={styles['title']}>
            {view.title}
          </h2>
        </div>
        {closeButton}
      </div>
      <div className={styles['amounts']}>
        <span className={styles['amount']}>
          {formatMoney({
            amount: view.amount,
            currency: view.currency,
            signDisplay: view.signDisplay,
          })}
        </span>
        {view.currency !== baseCurrency && baseAmount !== undefined && (
          <span className={styles['baseAmount']}>
            ≈ {formatMoney({ amount: baseAmount, currency: baseCurrency, signDisplay: 'never' })}
          </span>
        )}
      </div>
      <TransactionPostings
        postings={transaction.postings}
        baseCurrency={baseCurrency}
        accountKinds={accountKinds}
      />
      {(transaction.location !== null || transaction.comment !== null) && (
        <dl className={styles['facts']}>
          {transaction.location !== null && (
            <>
              <dt className={styles['term']}>Location</dt>
              <dd className={styles['value']}>{transaction.location.name}</dd>
            </>
          )}
          {transaction.comment !== null && (
            <>
              <dt className={styles['term']}>Comment</dt>
              <dd className={styles['value']}>{transaction.comment}</dd>
            </>
          )}
        </dl>
      )}
      {deleteAction}
    </article>
  );
}
