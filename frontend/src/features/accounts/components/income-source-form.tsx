import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
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

const INCOME_SOURCE_COLOR_GROUP = ['INCOME'] as const;

export function IncomeSourceForm({ name, onCreated, onBack }: CreateFormProps) {
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    AccountFormValues,
    unknown,
    AccountFormOutput
  >({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { name, description: '', color: '' },
  });
  const pickedColor = useWatch({ control, name: 'color' });
  const accountCreate = useAccountCreate({
    colorGroup: INCOME_SOURCE_COLOR_GROUP,
    pickedColor,
    onCreated,
    onFieldError: ({ field, message }) => {
      setError(field, { message });
    },
  });

  return (
    <EntityForm
      title="New income source"
      submitLabel="Create income source"
      isSubmitDisabled={accountCreate.isSubmitDisabled}
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
      <ColorField
        value={accountCreate.color}
        freeColors={accountCreate.freeColors}
        usedBy="income sources"
        onChange={(nextColor) => {
          setValue('color', nextColor);
        }}
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
