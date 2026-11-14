import { type ReactNode, useId } from 'react';
import { Link, type To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH, EDIT_ICON_PATH } from '@/components/action-button/action-icons';
import { Skeleton, SkeletonLine } from '@/components/skeleton/skeleton';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { DeletedAccountName } from './deleted-account-name';
import {
  type ReadAccountLink,
  readTransactionEntryFrame,
  TransactionEntryBlock,
  TransactionEntryBlockSkeleton,
  type TransactionEntryFrame,
} from './transaction-entry-block';
import styles from './transaction-overview.module.css';
import { TransactionTextParts } from './transaction-text-parts';
import {
  readExchangeDifference,
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
}>;

export const EXPENSE_FRAME: TransactionFrame = {
  hasBaseAmount: true,
  entryFrames: [
    { role: 'From', isMoneyAccount: true, hasBalance: true, hasBaseAmount: true },
    { role: 'To', isMoneyAccount: false, hasBalance: false, hasBaseAmount: true },
  ],
  hasExchangeDifference: false,
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
  const transactionFrame = {
    hasBaseAmount:
      view.currency !== baseCurrency &&
      readBaseAmount({ transaction, baseAmount: view.baseAmount }) !== undefined,
    entryFrames: readTransactionEntries(transaction).map((entry) =>
      readTransactionEntryFrame({ entry, baseCurrency }),
    ),
    hasExchangeDifference: readExchangeDifference(transaction) !== undefined,
  };
  return transactionFrame;
}

type TransactionOverviewSkeletonProps = Readonly<{
  transactionFrame: TransactionFrame;
  closeButton: ReactNode;
}>;

export function TransactionOverviewSkeleton({
  transactionFrame,
  closeButton,
}: TransactionOverviewSkeletonProps) {
  return (
    <div className={styles['transactionOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <div className={styles['heading']} aria-hidden="true">
          <SkeletonLine textClassName={styles['meta']} className={styles['metaSkeleton']} />
          <SkeletonLine textClassName={styles['title']} className={styles['titleSkeleton']} />
        </div>
        {closeButton}
      </div>
      <div className={styles['amounts']} aria-hidden="true">
        <SkeletonLine textClassName={styles['amount']} className={styles['amountSkeleton']} />
        {transactionFrame.hasBaseAmount && (
          <SkeletonLine
            textClassName={styles['baseAmount']}
            className={styles['baseAmountSkeleton']}
          />
        )}
      </div>
      {transactionFrame.entryFrames.map((entryFrame) => (
        <TransactionEntryBlockSkeleton key={entryFrame.role} entryFrame={entryFrame} />
      ))}
      <dl className={styles['facts']} aria-hidden="true">
        {transactionFrame.hasExchangeDifference && (
          <>
            <dt className={styles['term']}>Exchange difference</dt>
            <dd className={styles['skeletonValue']}>
              <Skeleton className={styles['factSkeleton']} />
            </dd>
          </>
        )}
        <dt className={styles['term']}>Location</dt>
        <dd className={styles['skeletonValue']}>
          <Skeleton className={styles['factSkeleton']} />
        </dd>
        <dt className={styles['term']}>Comment</dt>
        <dd className={styles['skeletonValue']}>
          <Skeleton className={styles['commentSkeleton']} />
        </dd>
      </dl>
      <ActionBar>
        <ActionButton
          label="Edit transaction"
          iconPath={EDIT_ICON_PATH}
          isDanger={false}
          action={{ kind: 'disabled' }}
        />
        <ActionButton
          label="Delete transaction"
          iconPath={DELETE_ICON_PATH}
          isDanger
          action={{ kind: 'disabled' }}
        />
      </ActionBar>
    </div>
  );
}

type TransactionOverviewProps = Readonly<{
  transaction: Readonly<Transaction>;
  baseCurrency: string;
  transactionTypes: readonly DictionaryItem[];
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
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
  accountKinds,
  categoryTypes,
  readAccountLink,
  readLocationLink,
  closeButton,
  editAction,
  deleteAction,
}: TransactionOverviewProps) {
  const titleId = useId();
  const view = readTransactionView({ transaction, transactionTypes });
  const baseAmount = readBaseAmount({ transaction, baseAmount: view.baseAmount });
  const exchangeDifference = readExchangeDifference(transaction);
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
      {readTransactionEntries(transaction).map((entry) => (
        <TransactionEntryBlock
          key={entry.posting.id}
          entry={entry}
          baseCurrency={baseCurrency}
          accountKinds={accountKinds}
          categoryTypes={categoryTypes}
          readAccountLink={readAccountLink}
        />
      ))}
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
