import { useId } from 'react';
import { Link, type To } from 'react-router';

import { readAccountColor } from '@/lib/account-colors';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { type AccountOptionChoices, readAccountMetaText } from '@/lib/account-option-metadata';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { DeletedAccountName } from './deleted-account-name';
import styles from './transaction-entry-block.module.css';
import { isDeletedAccount, type TransactionEntry } from './transaction-view';

type Account = components['schemas']['Account'];
type Posting = components['schemas']['Posting'];

export type ReadAccountLink = (account: Readonly<Account>) => To | undefined;

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
  referenceBaseAmount,
}: Readonly<{
  entry: TransactionEntry;
  baseCurrency: string;
  referenceBaseAmount?: number | undefined;
}>): TransactionEntryFrame {
  const { account } = entry.posting;
  const baseAmount = readBaseAmount(entry.posting);
  const entryFrame = {
    role: entry.role,
    isMoneyAccount: isMoneyAccountKind(account.kind),
    hasBalance: readBalanceText(account) !== undefined,
    hasBaseAmount:
      entry.posting.currency !== baseCurrency &&
      baseAmount !== undefined &&
      (referenceBaseAmount === undefined || Math.abs(baseAmount) !== Math.abs(referenceBaseAmount)),
  };
  return entryFrame;
}

type TransactionEntryBlockProps = Readonly<{
  entry: TransactionEntry;
  baseCurrency: string;
  referenceBaseAmount?: number | undefined;
  accountOptionChoices: AccountOptionChoices;
  readAccountLink: ReadAccountLink;
}>;

export function TransactionEntryBlock({
  entry,
  baseCurrency,
  referenceBaseAmount,
  accountOptionChoices,
  readAccountLink,
}: TransactionEntryBlockProps) {
  const titleId = useId();
  const { account } = entry.posting;
  const isMoneyAccount = isMoneyAccountKind(account.kind);
  const baseAmount = readBaseAmount(entry.posting);
  const amount = Number(entry.posting.amount);
  const frame = readTransactionEntryFrame({ entry, baseCurrency, referenceBaseAmount });
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
          <span className={styles['metadata']}>
            <span className={styles['note']}>
              {readAccountMetaText({ account, choices: accountOptionChoices })}
            </span>
            {balanceText !== undefined && <span className={styles['note']}>{balanceText}</span>}
          </span>
        </span>
        <span className={styles['amounts']}>
          <span className={styles['amount']}>
            {formatMoney({
              amount,
              currency: entry.posting.currency,
              signDisplay: 'exceptZero',
            })}
          </span>
          {frame.hasBaseAmount && baseAmount !== undefined && (
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
