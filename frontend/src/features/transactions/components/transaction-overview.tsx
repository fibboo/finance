import { type ReactNode, useId } from 'react';
import { Link, type To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import type { AccountOptionChoices } from '@/lib/account-option-metadata';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { DeletedAccountName } from './deleted-account-name';
import {
  type ReadAccountLink,
  readTransactionEntryFrame,
  TransactionEntryBlock,
  type TransactionEntryFrame,
} from './transaction-entry-block';
import styles from './transaction-overview.module.css';
import { TransactionTextParts } from './transaction-text-parts';
import {
  readBaseAmount,
  readExchangeDifference,
  readTransactionRates,
  readTransactionEntries,
  readTransactionView,
  readTypeLabel,
  readWeekdayDateText,
} from './transaction-view';

type Transaction = components['schemas']['Transaction'];
type TransactionLocation = NonNullable<Transaction['location']>;
type DictionaryItem = components['schemas']['DictionaryItem'];
export type LocationLink = Readonly<{ to: To; id: string }>;

export type ReadLocationLink = (locationId: string) => LocationLink | undefined;

const EMPTY_FACT = '—';

type LocationNameProps = Readonly<{
  location: TransactionLocation;
  readLocationLink: ReadLocationLink;
}>;

function LocationName({ location, readLocationLink }: LocationNameProps) {
  if (location.status === 'DELETED') {
    return <DeletedAccountName name={location.name} />;
  }

  const locationLink = readLocationLink(location.id);
  if (locationLink === undefined) {
    return location.name;
  }

  return (
    <Link {...locationLink} preventScrollReset className={styles['locationLink']}>
      {location.name}
    </Link>
  );
}

export type TransactionFrame = Readonly<{
  hasBaseAmount: boolean;
  entryFrames: readonly TransactionEntryFrame[];
  hasExchangeDifference: boolean;
  rateLabels: readonly string[];
}>;

export const EXPENSE_FRAME: TransactionFrame = {
  hasBaseAmount: false,
  entryFrames: [
    { role: 'From', isMoneyAccount: true, hasBalance: true, hasBaseAmount: false },
    { role: 'To', isMoneyAccount: false, hasBalance: false, hasBaseAmount: false },
  ],
  hasExchangeDifference: false,
  rateLabels: [],
};

export function readTransactionFrame({
  transaction,
  baseCurrency,
  transactionTypes,
}: Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
}>): TransactionFrame {
  const view = readTransactionView({ transaction, transactionTypes });
  const baseAmount = readBaseAmount({ transaction, ...view });
  const referenceBaseAmount = view.currency === baseCurrency ? view.amount : baseAmount;
  const transactionFrame = {
    hasBaseAmount: view.currency !== baseCurrency && baseAmount !== undefined,
    entryFrames: readTransactionEntries(transaction).map((entry) =>
      readTransactionEntryFrame({ entry, baseCurrency, referenceBaseAmount }),
    ),
    hasExchangeDifference: readExchangeDifference(transaction) !== undefined,
    rateLabels: readTransactionRates({ transaction, baseCurrency, view, baseAmount }).map(
      (rate) => rate.label,
    ),
  };
  return transactionFrame;
}

type TransactionOverviewProps = Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountOptionChoices: AccountOptionChoices;
  readAccountLink: ReadAccountLink;
  readLocationLink: ReadLocationLink;
  closeButton: ReactNode;
  editAction: ReactNode;
  deleteAction: ReactNode;
}>;

export function TransactionOverview({
  transaction,
  baseCurrency,
  transactionTypes,
  accountOptionChoices,
  readAccountLink,
  readLocationLink,
  closeButton,
  editAction,
  deleteAction,
}: TransactionOverviewProps) {
  const titleId = useId();
  const view = readTransactionView({ transaction, transactionTypes });
  const baseAmount = readBaseAmount({ transaction, ...view });
  const exchangeDifference = readExchangeDifference(transaction);
  const rates = readTransactionRates({ transaction, baseCurrency, view, baseAmount });
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
            ≈{' '}
            {formatMoney({
              amount: baseAmount,
              currency: baseCurrency,
              signDisplay: view.signDisplay,
            })}
          </span>
        )}
      </div>
      {readTransactionEntries(transaction).map((entry) => (
        <TransactionEntryBlock
          key={entry.posting.id}
          entry={entry}
          baseCurrency={baseCurrency}
          referenceBaseAmount={view.currency === baseCurrency ? view.amount : baseAmount}
          accountOptionChoices={accountOptionChoices}
          readAccountLink={readAccountLink}
        />
      ))}
      {rates.length > 0 && (
        <section aria-label="Exchange rates" className={styles['rates']}>
          <dl className={styles['rateList']}>
            {rates.map((rate) => (
              <div key={`${rate.label}-${rate.equation}`} className={styles['rate']}>
                <dt className={styles['term']}>{rate.label}</dt>
                <dd className={styles['equation']}>{rate.equation}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <dl className={styles['facts']}>
        {exchangeDifference !== undefined && (
          <>
            <dt className={styles['term']}>Exchange difference</dt>
            <dd className={styles['value']}>
              ≈{' '}
              {formatMoney({
                amount: exchangeDifference,
                currency: baseCurrency,
                signDisplay: 'exceptZero',
              })}
            </dd>
          </>
        )}
        <dt className={styles['term']}>Location</dt>
        <dd className={styles['value']}>
          {transaction.location === null ? (
            EMPTY_FACT
          ) : (
            <LocationName location={transaction.location} readLocationLink={readLocationLink} />
          )}
        </dd>
        <dt className={styles['term']}>Comment</dt>
        <dd className={styles['value']}>{transaction.comment ?? EMPTY_FACT}</dd>
      </dl>
      <ActionBar>
        {editAction}
        {deleteAction}
      </ActionBar>
    </article>
  );
}
