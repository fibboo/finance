import { type ReactNode, useId } from 'react';
import type { To } from 'react-router';

import { DetailDescription } from '@/components/details-panel/detail-description';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import { type AccountOptionChoices, readAccountMetaText } from '@/lib/account-option-metadata';
import type { components } from '@/lib/api-schema';

import { AccountActions } from './account-actions';
import { AccountBalance } from './account-balance';
import detailsStyles from './account-details.module.css';
import { AccountMark } from './account-mark';
import styles from './account-overview.module.css';

type Account = components['schemas']['Account'];

type AccountOverviewProps = Readonly<{
  isCompact: boolean;
  account: Readonly<Account>;
  baseCurrency: string;
  accountOptionChoices: AccountOptionChoices;
  adjustBalanceLink: To;
  transactionsLink: To;
  transactionsLinkId: string;
  closeButton: ReactNode;
  statusAction: ReactNode;
  onEdit: () => void;
}>;

export function AccountOverview({
  isCompact,
  account,
  baseCurrency,
  accountOptionChoices,
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
    <article
      aria-labelledby={titleId}
      className={`${styles['accountOverview'] ?? ''} ${isCompact ? `${styles['compact'] ?? ''} ${detailsStyles['squareActions'] ?? ''}` : ''}`}
    >
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
            {readAccountMetaText({ account, choices: accountOptionChoices })}
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
          <DetailDescription key={account.id} description={account.description} />
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
