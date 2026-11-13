import { type QueryKey, useMutation } from '@tanstack/react-query';

import { ActionButton } from '@/components/action-button/action-button';
import { RESTORE_ICON_PATH } from '@/components/action-button/action-icons';
import { ApiError } from '@/lib/api-error';

import { accountMutations } from '../api/account-mutations';

type RestoreAccountProps = Readonly<{
  accountId: string;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onNameTaken: () => void;
}>;

export function RestoreAccount({
  accountId,
  relatedQueryKeys,
  onRestored,
  onNameTaken,
}: RestoreAccountProps) {
  const { mutate, isPending } = useMutation(accountMutations.restore(relatedQueryKeys));
  return (
    <ActionButton
      label="Restore"
      iconPath={RESTORE_ICON_PATH}
      isDanger={false}
      action={{
        kind: 'button',
        blockingHint: undefined,
        onClick: () => {
          if (isPending) {
            return;
          }

          mutate(
            { account_id: accountId },
            {
              onSuccess: onRestored,
              onError: (error) => {
                if (error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS') {
                  onNameTaken();
                }
              },
            },
          );
        },
      }}
    />
  );
}
