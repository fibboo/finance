import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { ActionButton } from '@/components/action-button/action-button';
import { DELETE_ICON_PATH } from '@/components/action-button/action-icons';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';

import { locationMutations } from '../api/location-mutations';
import { LOCATION_DELETE_TITLE, readLocationDeleteText } from './location-delete-copy';

type Location = components['schemas']['Location'];

type DeleteLocationProps = Readonly<{
  locationId: string;
  location: Readonly<Location>;
  relatedQueryKeys: readonly QueryKey[];
  onDeleted: () => void;
}>;

export function DeleteLocation({
  locationId,
  location,
  relatedQueryKeys,
  onDeleted,
}: DeleteLocationProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const buttonId = useId();
  const deleteOptions = locationMutations.delete(relatedQueryKeys);
  const { mutate, isPending } = useMutation({
    ...deleteOptions,
    onSuccess: async (deletedLocation, deletedLocationId, onMutateResult, context) => {
      await deleteOptions.onSuccess?.(deletedLocation, deletedLocationId, onMutateResult, context);
      onDeleted();
    },
  });

  function closeConfirmation() {
    setIsConfirming(false);
    document.getElementById(buttonId)?.focus();
  }

  return (
    <>
      <ActionButton
        id={buttonId}
        label="Delete location"
        iconPath={DELETE_ICON_PATH}
        isDanger
        action={{
          kind: 'button',
          blockingHint: undefined,
          onClick: () => {
            setIsConfirming(true);
          },
        }}
      />
      {isConfirming && (
        <DeleteConfirmation
          title={LOCATION_DELETE_TITLE}
          text={readLocationDeleteText(location.name)}
          isPending={isPending}
          onCancel={closeConfirmation}
          onConfirm={() => {
            mutate(locationId, {
              onSuccess: () => {
                setIsConfirming(false);
              },
              onError: closeConfirmation,
            });
          }}
        />
      )}
    </>
  );
}
