import { type ReactNode, useId } from 'react';
import { Link, type To } from 'react-router';

import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { AccountMark } from './account-mark';
import styles from './account-overview.module.css';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const ADJUST_ICON_PATH = 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4';
const EDIT_ICON_PATH = 'M4 20h4L19 9l-4-4L4 16z';
const TRANSACTIONS_ICON_PATH = 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01';

function readBaseBalanceText({
  account,
  baseCurrency,
}: Readonly<{ account: Readonly<Account>; baseCurrency: string }>): string {
  const baseBalance = formatMoney({
    amount: Number(account.base_currency_balance),
    currency: baseCurrency,
  });
  const rateText = readAccountRateText({ account, baseCurrency });
  const baseBalanceText =
    rateText === undefined ? baseBalance : `${baseBalance} · rate ${rateText}`;
  return baseBalanceText;
}

type AccountOverviewProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  closeButton: ReactNode;
  deleteAction: ReactNode;
  onEdit: () => void;
}>;

export function AccountOverview({
  account,
  baseCurrency,
  accountKinds,
  adjustBalanceLink,
  transactionsLink,
  closeButton,
  deleteAction,
  onEdit,
}: AccountOverviewProps) {
  const titleId = useId();
  const currency = account.currency ?? baseCurrency;
  const kindLabel = accountKinds.find((kind) => kind.key === account.kind)?.label;
  return (
    <article aria-labelledby={titleId} className={styles['accountOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        <AccountMark account={account} isLarge />
        <div className={styles['heading']}>
          <span className={styles['meta']}>
            {kindLabel === undefined ? currency : `${kindLabel} · ${currency}`}
          </span>
          <h2 id={titleId} className={styles['title']}>
            {account.name}
          </h2>
        </div>
        {closeButton}
      </div>
      <div className={styles['amounts']}>
        <span
          className={`${styles['balance'] ?? ''} ${Number(account.balance) < 0 ? (styles['debt'] ?? '') : ''}`}
        >
          {formatMoney({ amount: Number(account.balance), currency })}
        </span>
        <span className={styles['baseBalance']}>
          {readBaseBalanceText({ account, baseCurrency })}
        </span>
      </div>
      {account.description !== undefined &&
        account.description !== null &&
        account.description !== '' && (
          <p className={styles['description']}>{account.description}</p>
        )}
      <div className={styles['actions']}>
        <Link to={adjustBalanceLink} preventScrollReset className={styles['action']}>
          <svg className={styles['actionIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={ADJUST_ICON_PATH} />
          </svg>
          Adjust balance
        </Link>
        <button type="button" className={styles['action']} onClick={onEdit}>
          <svg className={styles['actionIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={EDIT_ICON_PATH} />
          </svg>
          Edit
        </button>
        <Link to={transactionsLink} className={styles['action']}>
          <svg className={styles['actionIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={TRANSACTIONS_ICON_PATH} />
          </svg>
          Transactions
        </Link>
      </div>
      {deleteAction}
    </article>
  );
}
