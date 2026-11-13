import { zodResolver } from '@hookform/resolvers/zod';
import type { QueryKey } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { SegmentedField } from '@/components/segmented-field/segmented-field';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import type { AccountFieldError } from '../api/account-field-errors';
import { useAccountCreate } from '../hooks/use-account-create';
import { useAccountNameTaken } from '../hooks/use-account-name-taken';
import { useAccountUpdate } from '../hooks/use-account-update';
import {
  type CategoryFormOutput,
  categoryFormSchema,
  type CategoryFormValues,
  DESCRIPTION_MAX_LENGTH,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';

type Account = components['schemas']['Account'];
type CategoryType = components['schemas']['CategoryType'];
type DictionaryItem = components['schemas']['DictionaryItem'];

type CategoryFormMode =
  | Readonly<{ kind: 'create'; name: string; onCreated: (id: string) => void }>
  | Readonly<{
      kind: 'edit';
      category: Readonly<Account>;
      relatedQueryKeys: readonly QueryKey[];
      onSaved: () => void;
    }>;

type CategoryFormProps = Readonly<{
  mode: CategoryFormMode;
  categoryTypes: readonly DictionaryItem[];
  onBack: () => void;
}>;

const NAME_TAKEN_MESSAGE = 'An active category already has this name';

const CATEGORY_TYPE_HINTS = {
  VARIABLE: 'Spending that changes from month to month, like groceries or taxis.',
  FIXED: 'The same amount every month, like rent or subscriptions.',
  PERIODIC: 'Comes a few times a year, like insurance or gifts.',
} satisfies Readonly<Record<CategoryType, string>>;

function readStartingValues(mode: CategoryFormMode): CategoryFormValues {
  if (mode.kind === 'create') {
    const createValues = {
      name: mode.name,
      description: '',
      category_type: 'VARIABLE',
    } satisfies CategoryFormValues;
    return createValues;
  }

  const { category } = mode;
  if (category.category_type === null) {
    throw new Error('Only a category can be edited in the category form.');
  }

  const editValues = {
    name: category.name,
    description: category.description ?? '',
    category_type: category.category_type,
  } satisfies CategoryFormValues;
  return editValues;
}

export function CategoryForm({ mode, categoryTypes, onBack }: CategoryFormProps) {
  const startingValues = readStartingValues(mode);
  const { control, register, handleSubmit, setError, formState } = useForm<
    CategoryFormValues,
    unknown,
    CategoryFormOutput
  >({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: startingValues,
    ...(mode.kind === 'edit' && {
      values: startingValues,
      resetOptions: { keepDirtyValues: true },
    }),
  });
  const [categoryType, name] = useWatch({ control, name: ['category_type', 'name'] });
  const { isNameTaken, isLookupPending } = useAccountNameTaken({
    name,
    kind: 'EXPENSE',
    ownAccountId: mode.kind === 'edit' ? mode.category.id : undefined,
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
      title={mode.kind === 'create' ? 'New category' : 'Edit category'}
      submitLabel={mode.kind === 'create' ? 'Create category' : 'Save changes'}
      isSubmitDisabled={
        isNameTaken || isLookupPending || accountCreate.isPending || accountUpdate.isPending
      }
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((category) => {
          if (mode.kind === 'create') {
            accountCreate.create({
              name: category.name,
              description: category.description,
              kind: 'EXPENSE',
              category_type: category.category_type,
            });
          } else {
            accountUpdate.update({
              account_id: mode.category.id,
              name: category.name,
              description: category.description,
              category_type: category.category_type,
            });
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
      <SegmentedField
        legend="Type"
        registration={register('category_type')}
        options={categoryTypes}
        hint={CATEGORY_TYPE_HINTS[categoryType]}
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
