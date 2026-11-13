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
  DESCRIPTION_MAX_LENGTH,
  type LocationFormOutput,
  locationFormSchema,
  type LocationFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/location-form';

type Location = components['schemas']['Location'];

type LocationFormMode =
  | Readonly<{ kind: 'create'; name: string; onCreated: (id: string) => void }>
  | Readonly<{
      kind: 'edit';
      location: Readonly<Location>;
      relatedQueryKeys: readonly QueryKey[];
      onSaved: () => void;
    }>;

type LocationFormProps = Readonly<{
  mode: LocationFormMode;
  onBack: () => void;
}>;

const NAME_TAKEN_MESSAGE = 'An active location already has this name';

function readStartingValues(mode: LocationFormMode): LocationFormValues {
  const startingValues =
    mode.kind === 'create'
      ? { name: mode.name, description: '' }
      : { name: mode.location.name, description: mode.location.description ?? '' };
  return startingValues;
}

export function LocationForm({ mode, onBack }: LocationFormProps) {
  const startingValues = readStartingValues(mode);
  const { control, register, handleSubmit, setError, formState } = useForm<
    LocationFormValues,
    unknown,
    LocationFormOutput
  >({
    resolver: zodResolver(locationFormSchema),
    defaultValues: startingValues,
    ...(mode.kind === 'edit' && {
      values: startingValues,
      resetOptions: { keepDirtyValues: true },
    }),
  });
  const name = useWatch({ control, name: 'name' });
  const { isNameTaken, isLookupPending } = useLocationNameTaken({
    name,
    ownLocationId: mode.kind === 'edit' ? mode.location.id : undefined,
  });
  const create = useMutation(locationMutations.create());
  const update = useMutation(
    locationMutations.update(mode.kind === 'edit' ? mode.relatedQueryKeys : []),
  );

  function showFieldErrors(error: unknown) {
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
  }

  return (
    <EntityForm
      title={mode.kind === 'create' ? 'New location' : 'Edit location'}
      submitLabel={mode.kind === 'create' ? 'Create location' : 'Save changes'}
      isSubmitDisabled={isNameTaken || isLookupPending || create.isPending || update.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((location) => {
          if (mode.kind === 'create') {
            create.mutate(location, {
              onSuccess: (createdLocation) => {
                mode.onCreated(createdLocation.id);
              },
              onError: showFieldErrors,
            });
          } else {
            update.mutate(
              { location_id: mode.location.id, ...location },
              { onSuccess: mode.onSaved, onError: showFieldErrors },
            );
          }
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
