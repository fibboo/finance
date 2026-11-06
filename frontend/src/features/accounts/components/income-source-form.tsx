import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
import { EntityForm } from '@/components/entity-form/entity-form';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { TextField } from '@/components/text-field/text-field';
import { readFreeAccountColors } from '@/lib/account-colors';
import { ApiError } from '@/lib/api-error';

import { accountMutations } from '../api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';
import {
  DESCRIPTION_MAX_LENGTH,
  type IncomeSourceFormOutput,
  incomeSourceFormSchema,
  type IncomeSourceFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/income-source-form';

export function IncomeSourceForm({ name, onCreated, onBack }: CreateFormProps) {
  const { data: incomeSources } = useQuery(
    accountQueries.list({ kinds: ['INCOME'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
  );
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    IncomeSourceFormValues,
    unknown,
    IncomeSourceFormOutput
  >({
    resolver: zodResolver(incomeSourceFormSchema),
    defaultValues: { name, description: '', color: '' },
  });
  const pickedColor = useWatch({ control, name: 'color' });
  const create = useMutation(accountMutations.create());
  const freeColors =
    incomeSources === undefined ? undefined : readFreeAccountColors(incomeSources.items);
  const color =
    freeColors?.find((freeColor) => freeColor.value === pickedColor)?.value ??
    freeColors?.[0]?.value;

  return (
    <EntityForm
      title="New income source"
      submitLabel="Create income source"
      isSubmitDisabled={color === undefined || create.isPending}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit(({ name: sourceName, description }) => {
          if (color === undefined) {
            throw new Error('An income source needs a free color.');
          }

          create.mutate(
            { name: sourceName, description, kind: 'INCOME', color },
            {
              onSuccess: (account) => {
                onCreated(account.id);
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
      <ColorField
        value={color}
        freeColors={freeColors}
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
