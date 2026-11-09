import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useQuery } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
import { EntityForm } from '@/components/entity-form/entity-form';
import { SegmentedField } from '@/components/segmented-field/segmented-field';
import { SelectField } from '@/components/select-field/select-field';
import { TextField } from '@/components/text-field/text-field';
import { readAccountColor, readFreeAccountColors } from '@/lib/account-colors';
import { isMoneyAccountKind, MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';

import type { AccountFieldError } from '../api/account-field-errors';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '../api/account-queries';
import { useAccountCreate } from '../hooks/use-account-create';
import { useAccountUpdate } from '../hooks/use-account-update';
import {
  DESCRIPTION_MAX_LENGTH,
  type MoneyAccountFormOutput,
  moneyAccountFormSchema,
  type MoneyAccountFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';
import styles from './money-account-form.module.css';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];

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
  accountKinds: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
  baseCurrency: string;
  onBack: () => void;
}>;

const MONEY_ACCOUNT_KIND_COPY = {
  ASSET: {
    hint: 'Money you have: a card, cash or savings.',
    descriptionPlaceholder: 'e.g. Debit card for everyday spending',
  },
  LIABILITY: {
    hint: 'Money you owe: a credit card or a loan.',
    descriptionPlaceholder: 'e.g. Credit card, repaid every month',
  },
} satisfies Readonly<
  Record<MoneyAccountKind, Readonly<{ hint: string; descriptionPlaceholder: string }>>
>;

function readStartingValues({
  mode,
  baseCurrency,
}: Readonly<{ mode: MoneyAccountFormMode; baseCurrency: string }>): MoneyAccountFormValues {
  if (mode.kind === 'create') {
    const createValues = {
      name: mode.name,
      description: '',
      color: '',
      kind: 'ASSET',
      currency: baseCurrency,
    } satisfies MoneyAccountFormValues;
    return createValues;
  }

  const { account } = mode;
  if (!isMoneyAccountKind(account.kind) || account.currency === null) {
    throw new Error('Only a money account can be edited in the money account form.');
  }

  const editValues = {
    name: account.name,
    description: account.description ?? '',
    color: readAccountColor(account).toUpperCase(),
    kind: account.kind,
    currency: account.currency,
  } satisfies MoneyAccountFormValues;
  return editValues;
}

function readKindAndCurrency({
  account,
  accountKinds,
}: Readonly<{ account: Readonly<Account>; accountKinds: readonly DictionaryItem[] }>): string {
  const kindLabel =
    accountKinds.find((accountKind) => accountKind.key === account.kind)?.label ?? account.kind;
  const kindAndCurrency = `${kindLabel} · ${account.currency ?? ''}`;
  return kindAndCurrency;
}

export function MoneyAccountForm({
  mode,
  accountKinds,
  currencies,
  baseCurrency,
  onBack,
}: MoneyAccountFormProps) {
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    MoneyAccountFormValues,
    unknown,
    MoneyAccountFormOutput
  >({
    resolver: zodResolver(moneyAccountFormSchema),
    defaultValues: readStartingValues({ mode, baseCurrency }),
  });
  const [pickedColor, kind] = useWatch({ control, name: ['color', 'kind'] });
  const { data: moneyAccounts } = useQuery(
    accountQueries.list({
      kinds: [...MONEY_ACCOUNT_KINDS],
      size: ACCOUNT_PAGE_SIZE,
      order: 'recent_use',
    }),
  );
  const editedAccountId = mode.kind === 'edit' ? mode.account.id : undefined;
  const freeColors =
    moneyAccounts === undefined
      ? undefined
      : readFreeAccountColors(
          moneyAccounts.items.filter((account) => account.id !== editedAccountId),
        );
  const ownColor = mode.kind === 'edit' ? readAccountColor(mode.account).toUpperCase() : undefined;
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
  const kindCopy = MONEY_ACCOUNT_KIND_COPY[kind];

  return (
    <EntityForm
      title={mode.kind === 'create' ? 'New account' : 'Edit account'}
      submitLabel={mode.kind === 'create' ? 'Create account' : 'Save changes'}
      isSubmitDisabled={color === undefined || accountCreate.isPending || accountUpdate.isPending}
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
              kind: account.kind,
              currency: account.currency,
              color,
            });
          } else {
            accountUpdate.update({
              account_id: mode.account.id,
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
        error={formState.errors.name?.message}
      />
      {mode.kind === 'create' ? (
        <>
          <SegmentedField
            legend="Kind"
            registration={register('kind')}
            options={accountKinds.filter((accountKind) => isMoneyAccountKind(accountKind.key))}
            hint={kindCopy.hint}
          />
          <SelectField
            label="Currency"
            registration={register('currency')}
            options={currencies.map((currencyItem) => ({
              value: currencyItem.key,
              label: `${currencyItem.key} · ${currencyItem.label}`,
            }))}
          />
        </>
      ) : (
        <div className={styles['fixedField']}>
          <span className={styles['label']}>Kind and currency</span>
          <span className={styles['fixedValue']}>
            {readKindAndCurrency({ account: mode.account, accountKinds })}
          </span>
          <p className={styles['hint']}>They can&apos;t be changed once the account exists.</p>
        </div>
      )}
      <ColorField
        value={color}
        freeColors={freeColors}
        onChange={(nextColor) => {
          setValue('color', nextColor);
        }}
      />
      <TextField
        label="Description"
        registration={register('description')}
        placeholder={kindCopy.descriptionPlaceholder}
        maxLength={DESCRIPTION_MAX_LENGTH}
        isOptional
        isMultiline
        error={formState.errors.description?.message}
      />
    </EntityForm>
  );
}
