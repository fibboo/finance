import { useId } from 'react';
import { Link, type To } from 'react-router';

import { readMoneyAccountColor } from '@/lib/account-colors';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { DeletedAccountName } from './deleted-account-name';
import styles from './transaction-postings.module.css';
import { isDeletedAccount } from './transaction-view';

type Posting = components['schemas']['Posting'];
type DictionaryItem = components['schemas']['DictionaryItem'];

function readKindLabel({
  posting,
  accountKinds,
}: Readonly<{ posting: Posting; accountKinds: readonly DictionaryItem[] }>): string {
  const kind = accountKinds.find((accountKind) => accountKind.key === posting.account.kind);
  if (kind === undefined) {
    throw new Error(`The account kind ${posting.account.kind} has no label.`);
  }

  const kindLabel =
    posting.account.currency === null ? kind.label : `${kind.label} · ${posting.account.currency}`;
  return kindLabel;
}

function readBaseAmount(posting: Posting): number | undefined {
  const baseAmountText = posting.base_amount ?? posting.estimated_base_amount;
  const baseAmount =
    baseAmountText === null || baseAmountText === undefined ? undefined : Number(baseAmountText);
  return baseAmount;
}

type PostingAccountProps = Readonly<{
  account: Posting['account'];
  readAccountLink: (accountId: string) => To;
}>;

function PostingAccount({ account, readAccountLink }: PostingAccountProps) {
  const isCatalogAccount = account.kind === 'EXPENSE' || account.kind === 'INCOME';
  const name = isDeletedAccount(account) ? (
    <DeletedAccountName name={account.name} />
  ) : (
    account.name
  );
  if (isCatalogAccount || (isMoneyAccountKind(account.kind) && !isDeletedAccount(account))) {
    return (
      <Link to={readAccountLink(account.id)} preventScrollReset className={styles['accountLink']}>
        {name}
      </Link>
    );
  }

  return name;
}

type TransactionPostingsProps = Readonly<{
  postings: readonly Posting[];
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  readAccountLink: (accountId: string) => To;
}>;

export function TransactionPostings({
  postings,
  baseCurrency,
  accountKinds,
  readAccountLink,
}: TransactionPostingsProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={styles['transactionPostings']}>
      <h3 id={titleId} className={styles['title']}>
        Postings
      </h3>
      <ul className={styles['postings']}>
        {postings.map((posting) => {
          const baseAmount = readBaseAmount(posting);
          const color = readMoneyAccountColor(posting.account);
          return (
            <li key={posting.id} className={styles['posting']}>
              {color !== undefined && (
                <span className={styles['dot']} style={{ color }} aria-hidden="true" />
              )}
              <span className={styles['accountName']}>
                <PostingAccount account={posting.account} readAccountLink={readAccountLink} />
              </span>
              <span className={`${styles['note'] ?? ''} ${styles['accountNote'] ?? ''}`}>
                {readKindLabel({ posting, accountKinds })}
              </span>
              <span className={styles['amounts']}>
                {formatMoney({
                  amount: Number(posting.amount),
                  currency: posting.currency,
                  signDisplay: 'exceptZero',
                })}
                {posting.currency !== baseCurrency && baseAmount !== undefined && (
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
