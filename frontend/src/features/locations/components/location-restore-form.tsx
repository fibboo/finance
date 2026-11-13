import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { type FieldErrors, useForm } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { TextField } from '@/components/text-field/text-field';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';

import { locationMutations } from '../api/location-mutations';
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

const NAME_TAKEN_ERRORS = {
  name: { type: 'server', message: 'An active location already has this name' },
} as const satisfies FieldErrors<LocationRestoreFormValues>;

export function LocationRestoreForm({
  location,
  relatedQueryKeys,
  onRestored,
  onBack,
}: LocationRestoreFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<
    LocationRestoreFormValues,
    unknown,
    LocationRestoreFormOutput
  >({
    resolver: zodResolver(locationRestoreFormSchema),
    defaultValues: { name: location.name },
    errors: NAME_TAKEN_ERRORS,
  });
  const restore = useMutation(locationMutations.restore(relatedQueryKeys));

  return (
    <EntityForm
      title="Restore location"
      submitLabel="Restore location"
      isSubmitDisabled={restore.isPending}
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
                  setError('name', { message: NAME_TAKEN_ERRORS.name.message });
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
        error={formState.errors.name?.message}
      />
    </EntityForm>
  );
}
