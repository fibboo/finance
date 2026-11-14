import { type ReactNode, useId } from 'react';
import type { To } from 'react-router';

import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import { AccountActions } from './account-actions';
import { AccountBalance } from './account-balance';
import { AccountMark } from './account-mark';
import styles from './account-overview.module.css';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

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
        <AccountBalance account={account} baseCurrency={baseCurrency} isInline={false} />
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
      <AccountActions
        account={account}
        adjustBalanceLink={adjustBalanceLink}
        transactionsLink={transactionsLink}
        transactionsLinkId={transactionsLinkId}
        statusAction={statusAction}
        onEdit={onEdit}
      />
    </article>
  );
}
