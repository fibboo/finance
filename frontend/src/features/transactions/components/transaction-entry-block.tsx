import { useId } from 'react';
import { Link, type To } from 'react-router';

import { Skeleton, SkeletonLine } from '@/components/skeleton/skeleton';
import { readAccountColor } from '@/lib/account-colors';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { DeletedAccountName } from './deleted-account-name';
import styles from './transaction-entry-block.module.css';
import { isDeletedAccount, type TransactionEntry } from './transaction-view';

type Account = components['schemas']['Account'];
type Posting = components['schemas']['Posting'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type ReadAccountLink = (account: Readonly<Account>) => To | undefined;

function readLabel({
  items,
  key,
  name,
}: Readonly<{ items: readonly DictionaryItem[]; key: string; name: string }>): string {
  const item = items.find((dictionaryItem) => dictionaryItem.key === key);
  if (item === undefined) {
    throw new Error(`The ${name} ${key} has no label.`);
  }

  return item.label;
}

function readKindText({
  account,
  accountKinds,
  categoryTypes,
}: Readonly<{
  account: Account;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
}>): string {
  const kindLabel = readLabel({ items: accountKinds, key: account.kind, name: 'account kind' });
  const detail =
    account.category_type === null
      ? account.currency
      : readLabel({ items: categoryTypes, key: account.category_type, name: 'category type' });
  const kindText = detail === null ? kindLabel : `${kindLabel} · ${detail}`;
  return kindText;
}

function readBaseAmount(posting: Posting): number | undefined {
  const baseAmountText = posting.base_amount ?? posting.estimated_base_amount;
  const baseAmount =
    baseAmountText === null || baseAmountText === undefined ? undefined : Number(baseAmountText);
  return baseAmount;
}

function readBalanceText(account: Readonly<Account>): string | undefined {
  const balanceText =
    !isMoneyAccountKind(account.kind) || isDeletedAccount(account) || account.currency === null
      ? undefined
      : `Balance ${formatMoney({ amount: Number(account.balance), currency: account.currency })}`;
  return balanceText;
}

type EntryNameProps = Readonly<{
  account: Account;
  readAccountLink: ReadAccountLink;
}>;

function EntryName({ account, readAccountLink }: EntryNameProps) {
  if (isDeletedAccount(account)) {
    return <DeletedAccountName name={account.name} />;
  }

  const accountLink = readAccountLink(account);
  if (accountLink === undefined) {
    return account.name;
  }

  return (
    <Link to={accountLink} preventScrollReset className={styles['entryLink']}>
      {account.name}
    </Link>
  );
}

export type TransactionEntryFrame = Readonly<{
  role: TransactionEntry['role'];
  isMoneyAccount: boolean;
  hasBalance: boolean;
  hasBaseAmount: boolean;
}>;

export function readTransactionEntryFrame({
  entry,
  baseCurrency,
}: Readonly<{ entry: TransactionEntry; baseCurrency: string }>): TransactionEntryFrame {
  const { account } = entry.posting;
  const entryFrame = {
    role: entry.role,
    isMoneyAccount: isMoneyAccountKind(account.kind),
    hasBalance: readBalanceText(account) !== undefined,
    hasBaseAmount:
      entry.posting.currency !== baseCurrency && readBaseAmount(entry.posting) !== undefined,
  };
  return entryFrame;
}

type TransactionEntryBlockSkeletonProps = Readonly<{ entryFrame: TransactionEntryFrame }>;

export function TransactionEntryBlockSkeleton({ entryFrame }: TransactionEntryBlockSkeletonProps) {
  return (
    <div className={styles['transactionEntryBlock']} aria-hidden="true">
      <span className={styles['role']}>{entryFrame.role}</span>
      <div className={styles['entry']}>
        <Skeleton
          className={
            entryFrame.isMoneyAccount ? styles['moneyAccountMarkSkeleton'] : styles['markSkeleton']
          }
        />
        <span className={styles['identity']}>
          <SkeletonLine textClassName={styles['name']} className={styles['nameSkeleton']} />
          <SkeletonLine textClassName={styles['note']} className={styles['noteSkeleton']} />
          {entryFrame.hasBalance && (
            <SkeletonLine textClassName={styles['note']} className={styles['balanceSkeleton']} />
          )}
        </span>
        <span className={styles['amounts']}>
          <SkeletonLine textClassName={styles['amount']} className={styles['amountSkeleton']} />
          {entryFrame.hasBaseAmount && (
            <SkeletonLine textClassName={styles['note']} className={styles['baseAmountSkeleton']} />
          )}
        </span>
      </div>
    </div>
  );
}

type TransactionEntryBlockProps = Readonly<{
  entry: TransactionEntry;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  readAccountLink: ReadAccountLink;
}>;

export function TransactionEntryBlock({
  entry,
  baseCurrency,
  accountKinds,
  categoryTypes,
  readAccountLink,
}: TransactionEntryBlockProps) {
  const titleId = useId();
  const { account } = entry.posting;
  const isMoneyAccount = isMoneyAccountKind(account.kind);
  const baseAmount = readBaseAmount(entry.posting);
  const balanceText = readBalanceText(account);
  return (
    <section aria-labelledby={titleId} className={styles['transactionEntryBlock']}>
      <h3 id={titleId} className={styles['role']}>
        {entry.role}
      </h3>
      <div className={styles['entry']}>
        <span
          className={`${styles['mark'] ?? ''} ${isMoneyAccount ? (styles['moneyAccountMark'] ?? '') : ''} ${isDeletedAccount(account) ? (styles['deletedMark'] ?? '') : ''}`}
          style={isMoneyAccount ? { backgroundColor: readAccountColor(account) } : undefined}
          aria-hidden="true"
        >
          {account.name.slice(0, 1).toUpperCase()}
        </span>
        <span className={styles['identity']}>
          <span className={styles['name']}>
            <EntryName account={account} readAccountLink={readAccountLink} />
          </span>
          <span className={styles['note']}>
            {readKindText({ account, accountKinds, categoryTypes })}
          </span>
          {balanceText !== undefined && <span className={styles['note']}>{balanceText}</span>}
        </span>
        <span className={styles['amounts']}>
          <span className={styles['amount']}>
            {formatMoney({
              amount: Number(entry.posting.amount),
              currency: entry.posting.currency,
              signDisplay: 'exceptZero',
            })}
          </span>
          {entry.posting.currency !== baseCurrency && baseAmount !== undefined && (
            <span className={styles['note']}>
              ≈{' '}
              {formatMoney({
                amount: baseAmount,
                currency: baseCurrency,
                signDisplay: 'exceptZero',
              })}
            </span>
          )}
        </span>
      </div>
    </section>
  );
}
