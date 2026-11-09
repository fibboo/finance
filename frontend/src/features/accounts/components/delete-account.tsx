import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { accountMutations } from '../api/account-mutations';
import { accountQueries } from '../api/account-queries';
import { readNeighbourAccountLinkId } from '../api/selected-account';
import styles from './delete-account.module.css';

type Account = components['schemas']['Account'];

const DELETE_ICON_PATH =
  'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3';

function readBlockingHint({
  account,
  isOnlyAccount,
}: Readonly<{ account: Readonly<Account>; isOnlyAccount: boolean }>): string | undefined {
  const blockingHint =
    Number(account.balance) !== 0
      ? 'Bring the balance to zero to delete the account.'
      : isOnlyAccount
        ? "Your only money account can't be deleted."
        : undefined;
  return blockingHint;
}

type DeleteAccountProps = Readonly<{
  account: Readonly<Account>;
  currency: string;
  isOnlyAccount: boolean;
  relatedQueryKeys: readonly QueryKey[];
  onDeleted: () => void;
}>;

export function DeleteAccount({
  account,
  currency,
  isOnlyAccount,
  relatedQueryKeys,
  onDeleted,
}: DeleteAccountProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation(accountMutations.delete(relatedQueryKeys));
  const buttonId = useId();
  const hintId = useId();
  const blockingHint = readBlockingHint({ account, isOnlyAccount });

  function cancel() {
    setIsConfirming(false);
    document.getElementById(buttonId)?.focus();
  }

  return (
    <div className={styles['deleteAccount']}>
      <button
        id={buttonId}
        type="button"
        className={styles['deleteButton']}
        disabled={blockingHint !== undefined}
        aria-describedby={blockingHint === undefined ? undefined : hintId}
        onClick={() => {
          setIsConfirming(true);
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={DELETE_ICON_PATH} />
        </svg>
        Delete account
      </button>
      {blockingHint !== undefined && (
        <span id={hintId} className={styles['hint']}>
          {blockingHint}
        </span>
      )}
      {isConfirming && (
        <DeleteConfirmation
          title="Delete this account?"
          text={`${account.name}, ${formatMoney({ amount: Number(account.balance), currency })}. It leaves your accounts and the pickers, and its past transactions keep showing it.`}
          isPending={isPending}
          onCancel={cancel}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourAccountLinkId(account.id);
            mutate(account.id, {
              onSuccess: () => {
                onDeleted();
                queryClient.removeQueries({
                  queryKey: accountQueries.detail(account.id).queryKey,
                });
                if (neighbourLinkId !== undefined) {
                  document.getElementById(neighbourLinkId)?.focus();
                }
              },
              onError: () => {
                setIsConfirming(false);
              },
            });
          }}
        />
      )}
    </div>
  );
}
