import { useId } from 'react';

import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import styles from './transaction-postings.module.css';

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

type TransactionPostingsProps = Readonly<{
  postings: readonly Posting[];
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
}>;

export function TransactionPostings({
  postings,
  baseCurrency,
  accountKinds,
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
          return (
            <li key={posting.id} className={styles['posting']}>
              <span
                className={styles['dot']}
                style={{ color: readAccountColor(posting.account) }}
                aria-hidden="true"
              />
              <span className={styles['account']}>
                {posting.account.name}
                <span className={styles['note']}>{readKindLabel({ posting, accountKinds })}</span>
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
