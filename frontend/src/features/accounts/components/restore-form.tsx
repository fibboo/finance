import { zodResolver } from '@hookform/resolvers/zod';
import type { QueryKey } from '@tanstack/react-query';
import { type FieldErrors, useForm } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import { useAccountRestore } from '../hooks/use-account-restore';
import {
  NAME_MAX_LENGTH,
  type RestoreFormOutput,
  restoreFormSchema,
  type RestoreFormValues,
} from '../schemas/account-form';

type Account = components['schemas']['Account'];

type RestoredEntityName = 'category' | 'income source';

type RestoreFormProps = Readonly<{
  account: Readonly<Account>;
  entityName: RestoredEntityName;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onBack: () => void;
}>;

const NAME_TAKEN_ERRORS_BY_ENTITY_NAME = {
  category: { name: { type: 'server', message: 'An active category already has this name' } },
  'income source': {
    name: { type: 'server', message: 'An active income source already has this name' },
  },
} as const satisfies Readonly<Record<RestoredEntityName, FieldErrors<RestoreFormValues>>>;

export function RestoreForm({
  account,
  entityName,
  relatedQueryKeys,
  onRestored,
  onBack,
}: RestoreFormProps) {
  const nameTakenErrors = NAME_TAKEN_ERRORS_BY_ENTITY_NAME[entityName];
  const { register, handleSubmit, setError, formState } = useForm<
    RestoreFormValues,
    unknown,
    RestoreFormOutput
  >({
    resolver: zodResolver(restoreFormSchema),
    defaultValues: { name: account.name },
    errors: nameTakenErrors,
  });
  const accountRestore = useAccountRestore({
    relatedQueryKeys,
    onRestored,
    onNameTaken: () => {
      setError('name', { message: nameTakenErrors.name.message });
    },
    onFieldError: ({ field, message }) => {
      setError(field === 'name' ? 'name' : 'root.server', { message });
    },
  });

  return (
    <EntityForm
      title={`Restore ${entityName}`}
      submitLabel={`Restore ${entityName}`}
      isSubmitDisabled={accountRestore.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name }) => {
          accountRestore.restore({ account_id: account.id, name });
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
