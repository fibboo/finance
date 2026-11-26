import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
import { EntityForm } from '@/components/entity-form/entity-form';
import { SelectField } from '@/components/select-field/select-field';
import { TextField } from '@/components/text-field/text-field';
import { readAccountColor, readFreeAccountColors } from '@/lib/account-colors';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import type { AccountFieldError } from '../api/account-field-errors';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';
import { classificationQueries, readStartingClassificationId } from '../api/classification-queries';
import { useAccountCreate } from '../hooks/use-account-create';
import { useAccountNameTaken } from '../hooks/use-account-name-taken';
import { useAccountUpdate } from '../hooks/use-account-update';
import {
  DESCRIPTION_MAX_LENGTH,
  type MoneyAccountFormOutput,
  moneyAccountFormSchema,
  type MoneyAccountFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';
import { ClassificationChoice } from './classification-choice';
import styles from './money-account-form.module.css';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];

type MoneyAccountFormMode =
  | Readonly<{ kind: 'create'; name: string; onCreated: (id: string) => void }>
  | Readonly<{
      kind: 'edit';
      account: Readonly<Account>;
      relatedQueryKeys: readonly QueryKey[];
      onSaved: () => void;
    }>;

type MoneyAccountFormProps = Readonly<{
  mode: MoneyAccountFormMode;
  currencies: readonly DictionaryItem[];
  baseCurrency: string;
  onBack: () => void;
}>;

function readStartingValues({
  mode,
  baseCurrency,
  classificationId,
}: Readonly<{
  mode: MoneyAccountFormMode;
  baseCurrency: string;
  classificationId: string;
}>): MoneyAccountFormValues {
  if (mode.kind === 'create') {
    return {
      name: mode.name,
      description: '',
      color: '',
      currency: baseCurrency,
      classification_id: classificationId,
    };
  }

  const { account } = mode;
  if (account.currency === null) {
    throw new Error('Only a money account can be edited in the money account form.');
  }

  return {
    name: account.name,
    description: account.description ?? '',
    color: readAccountColor(account),
    currency: account.currency,
    classification_id: classificationId,
  };
}

export function MoneyAccountForm({
  mode,
  currencies,
  baseCurrency,
  onBack,
}: MoneyAccountFormProps) {
  const classifications = useQuery(classificationQueries.list('MONEY_ACCOUNT'));
  const classificationId = readStartingClassificationId({
    classifications: classifications.data,
    classificationId: mode.kind === 'edit' ? mode.account.classification_id : undefined,
  });
  const startingValues = readStartingValues({ mode, baseCurrency, classificationId });
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    MoneyAccountFormValues,
    unknown,
    MoneyAccountFormOutput
  >({
    resolver: zodResolver(moneyAccountFormSchema),
    values: startingValues,
    resetOptions: { keepDirtyValues: true },
  });
  const [pickedColor, name, chosenType] = useWatch({
    control,
    name: ['color', 'name', 'classification_id'],
  });
  const selectedType = classifications.data?.length === 1 ? classificationId : chosenType;
  const isTypeAvailable = classifications.data?.some(({ id }) => id === selectedType) === true;
  const kind = mode.kind === 'edit' ? mode.account.kind : 'ASSET';
  const { isNameTaken, isLookupPending, nameTakenMessage } = useAccountNameTaken({
    name,
    kind,
    ownAccountId: mode.kind === 'edit' ? mode.account.id : undefined,
    unchangedName: mode.kind === 'edit' ? mode.account.name : undefined,
  });
  const { data: moneyAccounts } = useQuery(
    accountQueries.list({
      kinds: [...MONEY_ACCOUNT_KINDS],
      size: ACCOUNT_PAGE_SIZE,
      order: 'recent_use',
    }),
  );
  const ownColor = mode.kind === 'edit' ? startingValues.color : undefined;
  const freeColors =
    moneyAccounts === undefined
      ? undefined
      : readFreeAccountColors(
          moneyAccounts.items.filter((account) => readAccountColor(account) !== ownColor),
        );
  const color =
    pickedColor === ownColor
      ? ownColor
      : (freeColors?.find((freeColor) => freeColor.value === pickedColor)?.value ??
        freeColors?.[0]?.value);

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
      title={mode.kind === 'create' ? 'New account' : 'Edit account'}
      submitLabel={mode.kind === 'create' ? 'Create account' : 'Save changes'}
      isSubmitDisabled={
        !isTypeAvailable ||
        color === undefined ||
        isNameTaken ||
        isLookupPending ||
        accountCreate.isPending ||
        accountUpdate.isPending
      }
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((account) => {
          if (color === undefined) {
            throw new Error('An account needs a free color.');
          }

          if (mode.kind === 'create') {
            accountCreate.create({
              name: account.name,
              description: account.description,
              kind,
              classification_id:
                classifications.data?.length === 1 ? classificationId : account.classification_id,
              currency: account.currency,
              color,
            });
          } else {
            accountUpdate.update({
              account_id: mode.account.id,
              classification_id:
                classifications.data?.length === 1 ? classificationId : account.classification_id,
              name: account.name,
              description: account.description,
              color,
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
      <ClassificationChoice
        classifications={classifications.data}
        isError={classifications.isError}
        registration={register('classification_id')}
        onRetry={() => {
          void classifications.refetch();
        }}
      />
      {mode.kind === 'create' ? (
        <SelectField
          label="Currency"
          registration={register('currency')}
          options={currencies.map((currencyItem) => ({
            value: currencyItem.key,
            label: `${currencyItem.key} · ${currencyItem.label}`,
          }))}
        />
      ) : (
        <div className={styles['fixedField']}>
          <span className={styles['label']}>Currency</span>
          <span className={styles['fixedValue']}>{startingValues.currency}</span>
          <p className={styles['hint']}>Currency is fixed after creation.</p>
        </div>
      )}
      <ColorField
        value={color}
        freeColors={freeColors}
        onChange={(nextColor) => {
          setValue('color', nextColor, { shouldDirty: true });
        }}
      />
      <TextField
        label="Description"
        registration={register('description')}
        placeholder="e.g. Debit card for everyday spending"
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
