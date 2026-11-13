import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { TextField } from '@/components/text-field/text-field';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { locationMutations } from '../api/location-mutations';
import { useLocationNameTaken } from '../hooks/use-location-name-taken';
import {
  type LocationRestoreFormOutput,
  locationRestoreFormSchema,
  type LocationRestoreFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/location-form';

type Location = components['schemas']['Location'];

type LocationRestoreFormProps = Readonly<{
  location: Readonly<Location>;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onBack: () => void;
}>;

const NAME_TAKEN_MESSAGE = 'An active location already has this name';

export function LocationRestoreForm({
  location,
  relatedQueryKeys,
  onRestored,
  onBack,
}: LocationRestoreFormProps) {
  const { control, register, handleSubmit, setError, formState } = useForm<
    LocationRestoreFormValues,
    unknown,
    LocationRestoreFormOutput
  >({
    resolver: zodResolver(locationRestoreFormSchema),
    defaultValues: { name: location.name },
  });
  const name = useWatch({ control, name: 'name' });
  const { isNameTaken, isLookupPending } = useLocationNameTaken({
    name,
    ownLocationId: location.id,
  });
  const restore = useMutation(locationMutations.restore(relatedQueryKeys));

  return (
    <EntityForm
      title="Restore location"
      submitLabel="Restore location"
      isSubmitDisabled={isNameTaken || isLookupPending || restore.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name }) => {
          restore.mutate(
            { location_id: location.id, name },
            {
              onSuccess: onRestored,
              onError: (error) => {
                if (error instanceof ApiError && error.error_code === 'NAME_ALREADY_EXISTS') {
                  setError('name', { message: NAME_TAKEN_MESSAGE });
                } else if (error instanceof ApiError) {
                  error.fieldErrors.forEach((fieldError) => {
                    setError(fieldError.field === 'name' ? 'name' : 'root.server', {
                      message: fieldError.message,
                    });
                  });
                }
              },
            },
          );
        })(event);
      }}
    >
      <TextField
        label="Name"
        registration={register('name')}
        placeholder={undefined}
        maxLength={NAME_MAX_LENGTH}
        isOptional={false}
        isMultiline={false}
        error={formState.errors.name?.message ?? (isNameTaken ? NAME_TAKEN_MESSAGE : undefined)}
      />
    </EntityForm>
  );
}
