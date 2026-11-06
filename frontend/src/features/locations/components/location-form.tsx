import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { TextField } from '@/components/text-field/text-field';
import { ApiError } from '@/lib/api-error';

import { locationMutations } from '../api/location-mutations';
import {
  DESCRIPTION_MAX_LENGTH,
  type LocationFormOutput,
  locationFormSchema,
  type LocationFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/location-form';

export function LocationForm({ name, onCreated, onBack }: CreateFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<
    LocationFormValues,
    unknown,
    LocationFormOutput
  >({
    resolver: zodResolver(locationFormSchema),
    defaultValues: { name, description: '' },
  });
  const create = useMutation(locationMutations.create());

  return (
    <EntityForm
      title="New location"
      submitLabel="Create location"
      isSubmitDisabled={create.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((location) => {
          create.mutate(location, {
            onSuccess: (createdLocation) => {
              onCreated(createdLocation.id);
            },
            onError: (error) => {
              if (error instanceof ApiError) {
                error.fieldErrors.forEach((fieldError) => {
                  setError(
                    fieldError.field === 'name' || fieldError.field === 'description'
                      ? fieldError.field
                      : 'root.server',
                    { message: fieldError.message },
                  );
                });
              }
            },
          });
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
      <TextField
        label="Description"
        registration={register('description')}
        placeholder="e.g. Supermarket next to home"
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
