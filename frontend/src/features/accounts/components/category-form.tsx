import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { EntityForm } from '@/components/entity-form/entity-form';
import { SegmentedField } from '@/components/segmented-field/segmented-field';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import type { AccountFieldError } from '../api/account-field-errors';
import { classificationQueries, readStartingClassificationId } from '../api/classification-queries';
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

import { ClassificationChoice } from './classification-choice';
import styles from './category-form.module.css';

type Account = components['schemas']['Account'];
type CategoryPurpose = components['schemas']['CategoryPurpose'];
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
  categoryPurposes: readonly DictionaryItem[];
  onBack: () => void;
}>;

const CATEGORY_PURPOSE_HINTS = {
  PERSONAL: 'Everyday spending. Deducted after net income.',
  INCOME_COST: 'Fees, work subscriptions and taxes. Reduce net income.',
} satisfies Readonly<Record<CategoryPurpose, string>>;

function readStartingValues({
  mode,
  classificationId,
}: Readonly<{ mode: CategoryFormMode; classificationId: string }>): CategoryFormValues {
  if (mode.kind === 'create') {
    const createValues = {
      name: mode.name,
      description: '',
      classification_id: classificationId,
      category_purpose: 'PERSONAL',
    } satisfies CategoryFormValues;
    return createValues;
  }

  const { category } = mode;
  const editValues = {
    name: category.name,
    description: category.description ?? '',
    classification_id: classificationId,
    category_purpose: category.category_purpose ?? 'PERSONAL',
  } satisfies CategoryFormValues;
  return editValues;
}

export function CategoryForm({ mode, categoryPurposes, onBack }: CategoryFormProps) {
  const classifications = useQuery(classificationQueries.list('EXPENSE_CATEGORY'));
  const classificationId = readStartingClassificationId({
    classifications: classifications.data,
    classificationId: mode.kind === 'edit' ? mode.category.classification_id : undefined,
  });
  const startingValues = readStartingValues({ mode, classificationId });
  const { control, register, handleSubmit, setError, formState } = useForm<
    CategoryFormValues,
    unknown,
    CategoryFormOutput
  >({
    resolver: zodResolver(categoryFormSchema),
    values: startingValues,
    resetOptions: { keepDirtyValues: true },
  });
  const [chosenType, name, categoryPurpose] = useWatch({
    control,
    name: ['classification_id', 'name', 'category_purpose'],
  });
  const selectedType = classifications.data?.length === 1 ? classificationId : chosenType;
  const isTypeAvailable = classifications.data?.some(({ id }) => id === selectedType) === true;
  const { isNameTaken, isLookupPending, nameTakenMessage } = useAccountNameTaken({
    name,
    kind: 'EXPENSE',
    ownAccountId: mode.kind === 'edit' ? mode.category.id : undefined,
    unchangedName: mode.kind === 'edit' ? mode.category.name : undefined,
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
        !isTypeAvailable ||
        isNameTaken ||
        isLookupPending ||
        accountCreate.isPending ||
        accountUpdate.isPending
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
              classification_id:
                classifications.data?.length === 1 ? classificationId : category.classification_id,
              category_purpose: category.category_purpose,
            });
          } else {
            accountUpdate.update({
              account_id: mode.category.id,
              name: category.name,
              description: category.description,
              classification_id:
                classifications.data?.length === 1 ? classificationId : category.classification_id,
              category_purpose: category.category_purpose,
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
        error={formState.errors.name?.message ?? (isNameTaken ? nameTakenMessage : undefined)}
      />
      <SegmentedField
        legend="Purpose"
        registration={register('category_purpose')}
        options={categoryPurposes}
        hint={CATEGORY_PURPOSE_HINTS[categoryPurpose]}
      />
      <ClassificationChoice
        classifications={classifications.data}
        isError={classifications.isError}
        registration={register('classification_id')}
        onRetry={() => {
          void classifications.refetch();
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
      {mode.kind === 'edit' && categoryPurpose !== startingValues.category_purpose && (
        <p className={styles['historyNote']}>
          Applies to all past transactions in this category. Net income will be recalculated;
          account balances stay the same.
        </p>
      )}
    </EntityForm>
  );
}
