import { type ReactNode, useId } from 'react';
import { Link, type To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './transaction-overview.module.css';
import { type ReadAccountLink, TransactionPostings } from './transaction-postings';
import { TransactionTextParts } from './transaction-text-parts';
import { readTransactionView, readTypeLabel, readWeekdayDateText } from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type DictionaryItem = components['schemas']['DictionaryItem'];
export type LocationLink = Readonly<{ to: To; id: string }>;

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
  readAccountLink: ReadAccountLink;
  readLocationLink: (locationId: string) => LocationLink;
  closeButton: ReactNode;
  editAction: ReactNode;
  deleteAction: ReactNode;
}>;

export function TransactionOverview({
  transaction,
  baseCurrency,
  transactionTypes,
  accountKinds,
  readAccountLink,
  readLocationLink,
  closeButton,
  editAction,
  deleteAction,
}: TransactionOverviewProps) {
  const titleId = useId();
  const view = readTransactionView({ transaction, transactionTypes });
  const baseAmount = readBaseAmount({ transaction, baseAmount: view.baseAmount });
  return (
    <article aria-labelledby={titleId} className={styles['transactionOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <div className={styles['heading']}>
          <span className={styles['meta']}>
            {readTypeLabel({ transaction, transactionTypes })} ·{' '}
            {readWeekdayDateText(transaction.transaction_date)}
          </span>
          <h2 id={titleId} className={styles['title']}>
            <TransactionTextParts text={view.title} />
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
        readAccountLink={readAccountLink}
      />
      {(transaction.location !== null || transaction.comment !== null) && (
        <dl className={styles['facts']}>
          {transaction.location !== null && (
            <>
              <dt className={styles['term']}>Location</dt>
              <dd className={styles['value']}>
                <Link
                  {...readLocationLink(transaction.location.id)}
                  preventScrollReset
                  className={styles['locationLink']}
                >
                  {transaction.location.name}
                </Link>
              </dd>
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
      <ActionBar>
        {editAction}
        {deleteAction}
      </ActionBar>
    </article>
  );
}
