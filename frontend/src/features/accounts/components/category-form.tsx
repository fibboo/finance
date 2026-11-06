import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
import { EntityForm } from '@/components/entity-form/entity-form';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { SegmentedField } from '@/components/segmented-field/segmented-field';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import { useAccountCreate } from '../hooks/use-account-create';
import {
  type CategoryFormOutput,
  categoryFormSchema,
  type CategoryFormValues,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';

type CategoryType = components['schemas']['CategoryType'];
type DictionaryItem = components['schemas']['DictionaryItem'];

type CategoryFormProps = CreateFormProps &
  Readonly<{
    categoryTypes: readonly DictionaryItem[];
  }>;

const CATEGORY_COLOR_GROUP = ['EXPENSE'] as const;

const CATEGORY_TYPE_HINTS = {
  VARIABLE: 'Spending that changes from month to month, like groceries or taxis.',
  FIXED: 'The same amount every month, like rent or subscriptions.',
  PERIODIC: 'Comes a few times a year, like insurance or gifts.',
} satisfies Readonly<Record<CategoryType, string>>;

export function CategoryForm({ name, categoryTypes, onCreated, onBack }: CategoryFormProps) {
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    CategoryFormValues,
    unknown,
    CategoryFormOutput
  >({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name, description: '', color: '', category_type: 'VARIABLE' },
  });
  const [pickedColor, categoryType] = useWatch({ control, name: ['color', 'category_type'] });
  const accountCreate = useAccountCreate({
    colorGroup: CATEGORY_COLOR_GROUP,
    pickedColor,
    onCreated,
    onFieldError: ({ field, message }) => {
      setError(field, { message });
    },
  });

  return (
    <EntityForm
      title="New category"
      submitLabel="Create category"
      isSubmitDisabled={accountCreate.isSubmitDisabled}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((category) => {
          accountCreate.create({
            name: category.name,
            description: category.description,
            kind: 'EXPENSE',
            category_type: category.category_type,
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
      <SegmentedField
        legend="Type"
        registration={register('category_type')}
        options={categoryTypes}
        hint={CATEGORY_TYPE_HINTS[categoryType]}
      />
      <ColorField
        value={accountCreate.color}
        freeColors={accountCreate.freeColors}
        usedBy="categories"
        onChange={(nextColor) => {
          setValue('color', nextColor);
        }}
      />
      <TextField
        label="Description"
        registration={register('description')}
        placeholder="e.g. Cafés and coffee to go"
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
