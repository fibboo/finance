import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';

import { ColorField } from '@/components/color-field/color-field';
import { EntityForm } from '@/components/entity-form/entity-form';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { SegmentedField } from '@/components/segmented-field/segmented-field';
import { SelectField } from '@/components/select-field/select-field';
import { TextField } from '@/components/text-field/text-field';
import type { components } from '@/lib/api-schema';

import { MONEY_ACCOUNT_KINDS } from '../api/account-queries';
import { useAccountCreate } from '../hooks/use-account-create';
import {
  DESCRIPTION_MAX_LENGTH,
  type MoneyAccountFormOutput,
  moneyAccountFormSchema,
  type MoneyAccountFormValues,
  NAME_MAX_LENGTH,
} from '../schemas/account-form';

type DictionaryItem = components['schemas']['DictionaryItem'];
type MoneyAccountKind = (typeof MONEY_ACCOUNT_KINDS)[number];

type MoneyAccountFormProps = CreateFormProps &
  Readonly<{
    accountKinds: readonly DictionaryItem[];
    currencies: readonly DictionaryItem[];
    baseCurrency: string;
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

export function MoneyAccountForm({
  name,
  accountKinds,
  currencies,
  baseCurrency,
  onCreated,
  onBack,
}: MoneyAccountFormProps) {
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    MoneyAccountFormValues,
    unknown,
    MoneyAccountFormOutput
  >({
    resolver: zodResolver(moneyAccountFormSchema),
    defaultValues: { name, description: '', color: '', kind: 'ASSET', currency: baseCurrency },
  });
  const [pickedColor, kind] = useWatch({ control, name: ['color', 'kind'] });
  const accountCreate = useAccountCreate({
    colorGroup: MONEY_ACCOUNT_KINDS,
    pickedColor,
    onCreated,
    onFieldError: ({ field, message }) => {
      setError(field, { message });
    },
  });
  const kindCopy = MONEY_ACCOUNT_KIND_COPY[kind];

  return (
    <EntityForm
      title="New account"
      submitLabel="Create account"
      isSubmitDisabled={accountCreate.isSubmitDisabled}
      error={formState.errors.root?.['server']?.message}
      onBack={onBack}
      onSubmit={(event) => {
        void handleSubmit((account) => {
          accountCreate.create({
            name: account.name,
            description: account.description,
            kind: account.kind,
            currency: account.currency,
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
        legend="Kind"
        registration={register('kind')}
        options={accountKinds.filter((accountKind) =>
          MONEY_ACCOUNT_KINDS.some((moneyKind) => moneyKind === accountKind.key),
        )}
        hint={kindCopy.hint}
      />
      <SelectField
        label="Currency"
        registration={register('currency')}
        options={currencies.map((currency) => ({
          value: currency.key,
          label: `${currency.key} · ${currency.label}`,
        }))}
      />
      <ColorField
        value={accountCreate.color}
        freeColors={accountCreate.freeColors}
        usedBy="accounts"
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
