import { zodResolver } from '@hookform/resolvers/zod';
import type { QueryKey } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import type { AccountFieldError } from '../api/account-field-errors';
import { useAccountCreate } from '../hooks/use-account-create';
import { useAccountNameTaken } from '../hooks/use-account-name-taken';
import { useAccountUpdate } from '../hooks/use-account-update';
import {
  type AccountFormOutput,
  accountFormSchema,
  type AccountFormValues,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';

type Account = components['schemas']['Account'];

type IncomeSourceFormMode =
  | Readonly<{ kind: 'create'; name: string; onCreated: (id: string) => void }>
  | Readonly<{
      kind: 'edit';
      incomeSource: Readonly<Account>;
      relatedQueryKeys: readonly QueryKey[];
      onSaved: () => void;
    }>;

type IncomeSourceFormProps = Readonly<{
  mode: IncomeSourceFormMode;
  onBack: () => void;
}>;

function readStartingValues(mode: IncomeSourceFormMode): AccountFormValues {
  const startingValues =
    mode.kind === 'create'
      ? { name: mode.name, description: '' }
      : { name: mode.incomeSource.name, description: mode.incomeSource.description ?? '' };
  return startingValues;
}

export function IncomeSourceForm({ mode, onBack }: IncomeSourceFormProps) {
  const startingValues = readStartingValues(mode);
  const { control, register, handleSubmit, setError, formState } = useForm<
    AccountFormValues,
    unknown,
    AccountFormOutput
  >({
    resolver: zodResolver(accountFormSchema),
    defaultValues: startingValues,
    ...(mode.kind === 'edit' && {
      values: startingValues,
      resetOptions: { keepDirtyValues: true },
    }),
  });

  const name = useWatch({ control, name: 'name' });
  const { isNameTaken, isLookupPending, nameTakenMessage } = useAccountNameTaken({
    name,
    kind: 'INCOME',
    ownAccountId: mode.kind === 'edit' ? mode.incomeSource.id : undefined,
    unchangedName: mode.kind === 'edit' ? mode.incomeSource.name : undefined,
  });

  function showFieldError({ field, message }: AccountFieldError) {
    setError(field, { message });
  }

  const accountCreate = useAccountCreate({
    onCreated: (id) => {
      if (mode.kind === 'create') {
        mode.onCreated(id);
      }
    },
    onFieldError: showFieldError,
  });
  const accountUpdate = useAccountUpdate({
    relatedQueryKeys: mode.kind === 'edit' ? mode.relatedQueryKeys : [],
    onSaved: () => {
      if (mode.kind === 'edit') {
        mode.onSaved();
      }
    },
    onFieldError: showFieldError,
  });

  return (
    <EntityForm
      title={mode.kind === 'create' ? 'New income source' : 'Edit income source'}
      submitLabel={mode.kind === 'create' ? 'Create income source' : 'Save changes'}
      isSubmitDisabled={
        isNameTaken || isLookupPending || accountCreate.isPending || accountUpdate.isPending
      }
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name, description }) => {
          if (mode.kind === 'create') {
            accountCreate.create({ name, description, kind: 'INCOME' });
          } else {
            accountUpdate.update({ account_id: mode.incomeSource.id, name, description });
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
        error={formState.errors.name?.message ?? (isNameTaken ? nameTakenMessage : undefined)}
      />
      <TextField
        label="Description"
        registration={register('description')}
        placeholder="e.g. Monthly salary after tax"
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
