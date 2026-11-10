import { type ReactNode, useId } from 'react';
import type { To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import {
  ADJUST_ICON_PATH,
  EDIT_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { AccountMark } from './account-mark';
import styles from './account-overview.module.css';
import { readAccountRateText } from './account-rate';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

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
      <ActionBar>
        <ActionButton
          label="Adjust balance"
          iconPath={ADJUST_ICON_PATH}
          isDanger={false}
          action={{ kind: 'link', to: adjustBalanceLink, isScrollKept: true }}
        />
        <ActionButton
          label="Transactions"
          iconPath={TRANSACTIONS_ICON_PATH}
          isDanger={false}
          action={{ kind: 'link', to: transactionsLink, isScrollKept: false }}
        />
        <ActionButton
          label="Edit"
          iconPath={EDIT_ICON_PATH}
          isDanger={false}
          action={{ kind: 'button', blockingHint: undefined, onClick: onEdit }}
        />
        {deleteAction}
      </ActionBar>
    </article>
  );
}
