import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { DeleteButton } from '@/components/delete-button/delete-button';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import { accountMutations } from '../api/account-mutations';
import { ACCOUNT_SEARCH_FIELD_ID } from '../api/account-search';
import { readNeighbourAccountLinkId } from '../api/selected-account';

type Account = components['schemas']['Account'];

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
  const { mutate, isPending } = useMutation(accountMutations.delete(relatedQueryKeys));
  const buttonId = useId();
  const blockingHint = readBlockingHint({ account, isOnlyAccount });

  function closeConfirmation() {
    setIsConfirming(false);
    document.getElementById(buttonId)?.focus();
  }

  return (
    <>
      <DeleteButton
        id={buttonId}
        label="Delete account"
        blockingHint={blockingHint}
        onClick={() => {
          setIsConfirming(true);
        }}
      />
      {isConfirming && (
        <DeleteConfirmation
          title="Delete this account?"
          text={`${account.name}, ${formatMoney({ amount: Number(account.balance), currency })}. It leaves your accounts and the pickers, and its past transactions keep showing it.`}
          isPending={isPending}
          onCancel={closeConfirmation}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourAccountLinkId(account.id);
            mutate(account.id, {
              onSuccess: () => {
                onDeleted();
                document.getElementById(neighbourLinkId ?? ACCOUNT_SEARCH_FIELD_ID)?.focus();
              },
              onError: closeConfirmation,
            });
          }}
        />
      )}
    </>
  );
}
