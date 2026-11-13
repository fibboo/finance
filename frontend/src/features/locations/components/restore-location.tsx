import { type QueryKey, useMutation } from '@tanstack/react-query';

import { ActionButton } from '@/components/action-button/action-button';
import { RESTORE_ICON_PATH } from '@/components/action-button/action-icons';
import { ApiError } from '@/lib/api-error';

import { locationMutations } from '../api/location-mutations';

type RestoreLocationProps = Readonly<{
  locationId: string;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onNameTaken: () => void;
}>;

export function RestoreLocation({
  locationId,
  relatedQueryKeys,
  onRestored,
  onNameTaken,
}: RestoreLocationProps) {
  const restoreOptions = locationMutations.restore(relatedQueryKeys);
  const { mutate, isPending } = useMutation({
    ...restoreOptions,
    onSuccess: async (location, restore, onMutateResult, context) => {
      await restoreOptions.onSuccess?.(location, restore, onMutateResult, context);
      onRestored();
    },
  });
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
            { location_id: locationId },
            {
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
