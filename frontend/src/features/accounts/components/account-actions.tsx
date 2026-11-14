import type { ReactNode } from 'react';
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

type Account = components['schemas']['Account'];

type AccountActionsProps = Readonly<{
  account: Readonly<Account>;
  adjustBalanceLink: To;
  transactionsLink: To;
  transactionsLinkId: string;
  statusAction: ReactNode;
  onEdit: () => void;
}>;

export function AccountActions({
  account,
  adjustBalanceLink,
  transactionsLink,
  transactionsLinkId,
  statusAction,
  onEdit,
}: AccountActionsProps) {
  return (
    <ActionBar>
      {isMoneyAccountKind(account.kind) && (
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
      {account.status !== 'DELETED' && (
        <ActionButton
          label="Edit"
          iconPath={EDIT_ICON_PATH}
          isDanger={false}
          action={{ kind: 'button', blockingHint: undefined, onClick: onEdit }}
        />
      )}
      {statusAction}
    </ActionBar>
  );
}
