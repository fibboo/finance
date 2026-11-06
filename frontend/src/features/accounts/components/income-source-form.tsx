import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { TextField } from '@/components/text-field/text-field';

import { useAccountCreate } from '../hooks/use-account-create';
import {
  type AccountFormOutput,
  accountFormSchema,
  type AccountFormValues,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';

export function IncomeSourceForm({ name, onCreated, onBack }: CreateFormProps) {
  const { register, handleSubmit, setError, formState } = useForm<
    AccountFormValues,
    unknown,
    AccountFormOutput
  >({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name, description: '' },
  });
  const accountCreate = useAccountCreate({
    onCreated,
    onFieldError: ({ field, message }) => {
      setError(field, { message });
    },
  });

  return (
    <EntityForm
      title="New income source"
      submitLabel="Create income source"
      isSubmitDisabled={accountCreate.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name: sourceName, description }) => {
          accountCreate.create({ name: sourceName, description, kind: 'INCOME' });
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
        placeholder="e.g. Monthly salary after tax"
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
