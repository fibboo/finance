import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import {
  ADJUST_ICON_PATH,
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';

type AccountActionsSkeletonProps = Readonly<{ isMoneyAccount: boolean }>;

export function AccountActionsSkeleton({ isMoneyAccount }: AccountActionsSkeletonProps) {
  return (
    <ActionBar>
      {isMoneyAccount && (
        <ActionButton
          label="Adjust balance"
          iconPath={ADJUST_ICON_PATH}
          isDanger={false}
          action={{ kind: 'disabled' }}
        />
      )}
      <ActionButton
        label="Transactions"
        iconPath={TRANSACTIONS_ICON_PATH}
        isDanger={false}
        action={{ kind: 'disabled' }}
      />
      <ActionButton
        label="Edit"
        iconPath={EDIT_ICON_PATH}
        isDanger={false}
        action={{ kind: 'disabled' }}
      />
      <ActionButton
        label="Delete"
        iconPath={DELETE_ICON_PATH}
        isDanger
        action={{ kind: 'disabled' }}
      />
    </ActionBar>
  );
}
