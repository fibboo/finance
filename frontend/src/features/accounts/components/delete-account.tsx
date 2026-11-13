import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH } from '@/components/action-button/action-icons';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { focusReturnTarget } from '@/components/details-panel/focus-return';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { accountMutations } from '../api/account-mutations';
import { accountQueries } from '../api/account-queries';
import { ACCOUNT_SEARCH_FIELD_ID } from '../api/account-search';
import { readNeighbourAccountLinkId } from '../api/selected-account';
import { type DeleteCopy, readCatalogDeleteCopy } from './catalog-delete-copy';

type Account = components['schemas']['Account'];

function readDeleteCopy({
  account,
  currency,
}: Readonly<{ account: Readonly<Account>; currency: string }>): DeleteCopy {
  const deleteCopy = isMoneyAccountKind(account.kind)
    ? {
        label: 'Delete account',
        title: 'Delete this account?',
        text: `${account.name}, ${formatMoney({ amount: Number(account.balance), currency })}. It leaves your accounts and the pickers, and its past transactions keep showing it.`,
      }
    : readCatalogDeleteCopy(account);
  return deleteCopy;
}

function readBlockingHint({
  account,
  isOnlyAccount,
}: Readonly<{ account: Readonly<Account>; isOnlyAccount: boolean }>): string | undefined {
  const blockingHint = !isMoneyAccountKind(account.kind)
    ? undefined
    : Number(account.balance) !== 0
      ? 'Bring the balance to zero to delete.'
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
  const blockingHint = readBlockingHint({ account, isOnlyAccount });
  const deleteCopy = readDeleteCopy({ account, currency });

  function closeConfirmation() {
    setIsConfirming(false);
    document.getElementById(buttonId)?.focus();
  }

  return (
    <>
      <ActionButton
        id={buttonId}
        label={deleteCopy.label}
        iconPath={DELETE_ICON_PATH}
        isDanger
        action={{
          kind: 'button',
          blockingHint,
          onClick: () => {
            setIsConfirming(true);
          },
        }}
      />
      {isConfirming && (
        <DeleteConfirmation
          title={deleteCopy.title}
          text={deleteCopy.text}
          isPending={isPending}
          onCancel={closeConfirmation}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourAccountLinkId(account.id);
            mutate(account.id, {
              onSuccess: () => {
                setIsConfirming(false);
                onDeleted();
                if (!isMoneyAccountKind(account.kind)) {
                  return;
                }

                queryClient.removeQueries({
                  queryKey: accountQueries.detail(account.id).queryKey,
                  exact: true,
                });
                focusReturnTarget(neighbourLinkId ?? ACCOUNT_SEARCH_FIELD_ID);
              },
              onError: closeConfirmation,
            });
          }}
        />
      )}
    </>
  );
}
