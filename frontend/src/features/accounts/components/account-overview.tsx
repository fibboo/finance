import { type ReactNode, useId } from 'react';
import type { To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import {
  ADJUST_ICON_PATH,
  EDIT_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import { isMoneyAccountKind } from '@/lib/account-kinds';
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

function readMetaText({
  account,
  baseCurrency,
  accountKinds,
  categoryTypes,
}: Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
}>): string {
  const kindLabel = accountKinds.find((kind) => kind.key === account.kind)?.label;
  const detail = isMoneyAccountKind(account.kind)
    ? (account.currency ?? baseCurrency)
    : categoryTypes.find((categoryType) => categoryType.key === account.category_type)?.label;
  const metaText = [kindLabel, detail].filter((part) => part !== undefined).join(' · ');
  return metaText;
}

type AccountOverviewProps = Readonly<{
  account: Readonly<Account>;
  baseCurrency: string;
  accountKinds: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  adjustBalanceLink: To;
  transactionsLink: To;
  transactionsLinkId: string;
  closeButton: ReactNode;
  statusAction: ReactNode;
  onEdit: () => void;
}>;

export function AccountOverview({
  account,
  baseCurrency,
  accountKinds,
  categoryTypes,
  adjustBalanceLink,
  transactionsLink,
  transactionsLinkId,
  closeButton,
  statusAction,
  onEdit,
}: AccountOverviewProps) {
  const titleId = useId();
  const isMoneyAccount = isMoneyAccountKind(account.kind);
  const isDeleted = account.status === 'DELETED';
  const currency = account.currency ?? baseCurrency;
  return (
    <article aria-labelledby={titleId} className={styles['accountOverview']}>
      <div className={styles['header']} data-sheet-drag-area>
        {isMoneyAccount ? (
          <AccountMark account={account} isLarge />
        ) : (
          <span
            className={`${styles['catalogMark'] ?? ''} ${isDeleted ? (styles['deletedMark'] ?? '') : ''}`}
            aria-hidden="true"
          >
            {account.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className={styles['heading']}>
          <span className={styles['meta']}>
            {readMetaText({ account, baseCurrency, accountKinds, categoryTypes })}
            {isDeleted && <span className={styles['badge']}>Deleted</span>}
          </span>
          <h2 id={titleId} className={styles['title']}>
            {isDeleted ? <s className={styles['deletedTitle']}>{account.name}</s> : account.name}
          </h2>
        </div>
        {closeButton}
      </div>
      {isMoneyAccount && (
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
      )}
      {account.description !== undefined &&
        account.description !== null &&
        account.description !== '' && (
          <p className={styles['description']}>
            <span className={styles['descriptionText']}>{account.description}</span>
            <span className={styles['descriptionLine']} aria-hidden="true">
              {account.description}
            </span>
          </p>
        )}
      <ActionBar>
        {isMoneyAccount && (
          <ActionButton
            label="Adjust balance"
            iconPath={ADJUST_ICON_PATH}
            isDanger={false}
            action={{ kind: 'link', to: adjustBalanceLink, isScrollKept: true }}
          />
        )}
        <ActionButton
          id={transactionsLinkId}
          label="Transactions"
          iconPath={TRANSACTIONS_ICON_PATH}
          isDanger={false}
          action={{ kind: 'link', to: transactionsLink, isScrollKept: false }}
        />
        {!isDeleted && (
          <ActionButton
            label="Edit"
            iconPath={EDIT_ICON_PATH}
            isDanger={false}
            action={{ kind: 'button', blockingHint: undefined, onClick: onEdit }}
          />
        )}
        {statusAction}
      </ActionBar>
    </article>
  );
}
