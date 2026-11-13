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

type RestoreFormProps = Readonly<{
  category: Readonly<Account>;
  relatedQueryKeys: readonly QueryKey[];
  onRestored: () => void;
  onBack: () => void;
}>;

const NAME_TAKEN_MESSAGE = 'An active category already has this name';
const NAME_TAKEN_ERRORS: FieldErrors<RestoreFormValues> = {
  name: { type: 'server', message: NAME_TAKEN_MESSAGE },
};

export function RestoreForm({ category, relatedQueryKeys, onRestored, onBack }: RestoreFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<
    RestoreFormValues,
    unknown,
    RestoreFormOutput
  >({
    resolver: zodResolver(restoreFormSchema),
    defaultValues: { name: category.name },
    errors: NAME_TAKEN_ERRORS,
  });
  const accountRestore = useAccountRestore({
    relatedQueryKeys,
    onRestored,
    onNameTaken: () => {
      setError('name', { message: NAME_TAKEN_MESSAGE });
    },
    onFieldError: ({ field, message }) => {
      setError(field === 'name' ? 'name' : 'root.server', { message });
    },
  });

  return (
    <EntityForm
      title="Restore category"
      submitLabel="Restore category"
      isSubmitDisabled={accountRestore.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name }) => {
          accountRestore.restore({ account_id: category.id, name });
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
