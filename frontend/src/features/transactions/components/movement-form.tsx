import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Resolver, useForm, useWatch } from 'react-hook-form';

import { EntityPicker } from '@/components/entity-picker/entity-picker';
import { useToday } from '@/hooks/use-today';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { readIsoDate, toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import type { EntryTransactionType, MovementTransactionType } from '../api/new-transaction';
import { transactionMutations } from '../api/transaction-mutations';
import {
  COMMENT_MAX_LENGTH,
  createExpenseFormSchema,
  createIncomeFormSchema,
  createTransferFormSchema,
  type MovementFormValues,
  readAccountCurrency,
  readAmountText,
} from '../schemas/transaction-form';
import { AmountField } from './amount-field';
import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { ForeignAmountRow } from './foreign-amount-row';
import { FormHeader } from './form-header';
import { readIncomeMonths } from './income-months';
import { InputRow } from './input-row';
import { readMoneyAccountNote, toMoneyAccountItem } from './money-account-item';
import { PickerRow } from './picker-row';
import { readSaveErrors } from './save-errors';
import { SelectRow } from './select-row';
import styles from './transaction-form.module.css';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];
type PickerField = 'from_account_id' | 'to_account_id' | 'location_id';
type FormField = (typeof FORM_FIELDS)[number];
type PickerCopy = Readonly<{
  title: string;
  placeholder: string;
  searchLabel: string;
  emptyText: string;
}>;

const FORM_FIELDS = [
  'from_account_id',
  'to_account_id',
  'location_id',
  'source_amount',
  'source_currency',
  'destination_amount',
  'destination_currency',
  'base_currency_amount',
  'income_period',
  'transaction_date',
  'comment',
] as const;
const MONEY_ACCOUNT_COPY = {
  searchLabel: 'Search accounts',
  emptyText: 'There are no accounts yet.',
  placeholder: 'Choose an account',
};
const MOVEMENT_COPY = {
  EXPENSE: {
    amountLabel: 'Amount',
    submitLabel: 'Add expense',
    saveError: "Couldn't save the expense. Please try again.",
    from: { ...MONEY_ACCOUNT_COPY, title: 'From' },
    to: {
      title: 'Category',
      placeholder: 'Choose a category',
      searchLabel: 'Search categories',
      emptyText: 'There are no categories yet.',
    },
  },
  INCOME: {
    amountLabel: 'Amount received',
    submitLabel: 'Add income',
    saveError: "Couldn't save the income. Please try again.",
    from: {
      title: 'Source',
      placeholder: 'Choose a source',
      searchLabel: 'Search income sources',
      emptyText: 'There are no income sources yet.',
    },
    to: { ...MONEY_ACCOUNT_COPY, title: 'To' },
  },
  TRANSFER: {
    amountLabel: 'Amount sent',
    submitLabel: 'Add transfer',
    saveError: "Couldn't save the transfer. Please try again.",
    from: { ...MONEY_ACCOUNT_COPY, title: 'From' },
    to: { ...MONEY_ACCOUNT_COPY, title: 'To' },
  },
} satisfies Record<
  MovementTransactionType,
  Readonly<{
    amountLabel: string;
    submitLabel: string;
    saveError: string;
    from: PickerCopy;
    to: PickerCopy;
  }>
>;
const HIDDEN_FIELD_TARGETS: Readonly<
  Record<MovementTransactionType, Partial<Record<FormField, FormField>>>
> = {
  EXPENSE: { destination_amount: 'source_amount', destination_currency: 'from_account_id' },
  INCOME: { source_amount: 'destination_amount', source_currency: 'to_account_id' },
  TRANSFER: { destination_amount: 'source_amount' },
};

function readBaseCurrencyHint({
  account,
  amountText,
  baseCurrency,
}: Readonly<{
  account: Readonly<Account> | undefined;
  amountText: string;
  baseCurrency: string;
}>): string | undefined {
  const amount = readAmountText(amountText);
  const rate = Number(account?.base_currency_rate);
  const hint =
    account === undefined ||
    amount === undefined ||
    Number(amount) <= 0 ||
    readAccountCurrency(account) === baseCurrency ||
    rate <= 0
      ? undefined
      : `≈ ${formatMoney({ amount: Number(amount) / rate, currency: baseCurrency })}`;
  return hint;
}

function toAccountItem({ account, note }: Readonly<{ account: Readonly<Account>; note: string }>) {
  const item = { id: account.id, name: account.name, color: readAccountColor(account), note };
  return item;
}

type MovementFormProps = Readonly<{
  transactionType: MovementTransactionType;
  transactionTypes: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
  moneyAccounts: readonly Account[] | undefined;
  categories: readonly Account[] | undefined;
  incomeSources: readonly Account[] | undefined;
  locations: readonly Location[] | undefined;
  baseCurrency: string;
  relatedQueryKeys: readonly QueryKey[];
  onTypeChange: (transactionType: EntryTransactionType) => void;
  onClose: () => void;
}>;

export function MovementForm({
  transactionType,
  transactionTypes,
  categoryTypes,
  currencies,
  moneyAccounts,
  categories,
  incomeSources,
  locations,
  baseCurrency,
  relatedQueryKeys,
  onTypeChange,
  onClose,
}: MovementFormProps) {
  const today = useToday();
  const [pickerField, setPickerField] = useState<PickerField | undefined>(undefined);
  const rowIdPrefix = useId();
  const copy = MOVEMENT_COPY[transactionType];
  const fromAccounts = transactionType === 'INCOME' ? incomeSources : moneyAccounts;
  const toAccounts = transactionType === 'EXPENSE' ? categories : moneyAccounts;
  const isIncome = transactionType === 'INCOME';
  const isTransfer = transactionType === 'TRANSFER';

  function readMoneyCurrencies(
    values: Readonly<
      Pick<
        MovementFormValues,
        'from_account_id' | 'to_account_id' | 'is_paid_in_another_currency' | 'source_currency'
      >
    >,
  ) {
    const fromAccount = fromAccounts?.find((account) => account.id === values.from_account_id);
    const toAccount = toAccounts?.find((account) => account.id === values.to_account_id);
    const moneyCurrencies = {
      source: fromAccount === undefined || isIncome ? undefined : readAccountCurrency(fromAccount),
      destination:
        toAccount === undefined || transactionType === 'EXPENSE'
          ? undefined
          : readAccountCurrency(toAccount),
    };
    const isDestinationAmountAsked =
      isTransfer &&
      moneyCurrencies.source !== undefined &&
      moneyCurrencies.destination !== undefined &&
      moneyCurrencies.source !== moneyCurrencies.destination &&
      moneyCurrencies.destination !== baseCurrency;
    const paidCurrency = values.is_paid_in_another_currency
      ? values.source_currency
      : moneyCurrencies.destination;
    const isBaseCurrencyAmountAsked =
      isIncome &&
      moneyCurrencies.destination !== undefined &&
      moneyCurrencies.destination !== baseCurrency &&
      paidCurrency !== baseCurrency;
    return { ...moneyCurrencies, isDestinationAmountAsked, isBaseCurrencyAmountAsked };
  }

  const resolver: Resolver<MovementFormValues, unknown, MovementRequest> = (
    values,
    context,
    options,
  ) => {
    const { source, destination, isDestinationAmountAsked, isBaseCurrencyAmountAsked } =
      readMoneyCurrencies(values);
    const schemas = {
      EXPENSE: () =>
        createExpenseFormSchema({
          sourceCurrency: source,
          isPaidInAnotherCurrency: values.is_paid_in_another_currency,
          today,
        }),
      INCOME: () =>
        createIncomeFormSchema({
          destinationCurrency: destination,
          isPaidInAnotherCurrency: values.is_paid_in_another_currency,
          isBaseCurrencyAmountAsked,
          baseCurrency,
          today,
        }),
      TRANSFER: () =>
        createTransferFormSchema({
          sourceCurrency: source,
          destinationCurrency: destination,
          isDestinationAmountAsked,
          today,
        }),
    };
    return zodResolver(schemas[transactionType]())(values, context, options);
  };
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    MovementFormValues,
    unknown,
    MovementRequest
  >({
    resolver,
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      location_id: '',
      source_amount: '',
      source_currency: '',
      is_paid_in_another_currency: false,
      destination_amount: '',
      destination_currency: '',
      base_currency_amount: '',
      income_period: '',
      transaction_date: toDateText(today),
      comment: '',
    },
  });
  const [
    fromAccountId,
    toAccountId,
    locationId,
    sourceAmount,
    sourceCurrency,
    isPaidInAnotherCurrency,
    destinationAmount,
    incomePeriod,
    date,
  ] = useWatch({
    control,
    name: [
      'from_account_id',
      'to_account_id',
      'location_id',
      'source_amount',
      'source_currency',
      'is_paid_in_another_currency',
      'destination_amount',
      'income_period',
      'transaction_date',
    ],
  });
  const create = useMutation(transactionMutations.create(relatedQueryKeys));
  const fromAccount = fromAccounts?.find((account) => account.id === fromAccountId);
  const toAccount = toAccounts?.find((account) => account.id === toAccountId);
  const location = locations?.find((place) => place.id === locationId);
  const { destination, isDestinationAmountAsked, isBaseCurrencyAmountAsked } = readMoneyCurrencies({
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    is_paid_in_another_currency: isPaidInAnotherCurrency,
    source_currency: sourceCurrency,
  });
  const amountAccount = isIncome ? toAccount : fromAccount;
  const amountField = isIncome ? 'destination_amount' : 'source_amount';
  const isExtraAmountShown = isTransfer ? isDestinationAmountAsked : isPaidInAnotherCurrency;
  const pickers = {
    from_account_id: {
      ...copy.from,
      selectedId: fromAccount?.id,
      items: fromAccounts
        ?.filter((account) => !isTransfer || account.id !== toAccountId)
        .map((account) =>
          isIncome ? toAccountItem({ account, note: '' }) : toMoneyAccountItem(account),
        ),
    },
    to_account_id: {
      ...copy.to,
      selectedId: toAccount?.id,
      items: toAccounts
        ?.filter((account) => !isTransfer || account.id !== fromAccountId)
        .map((account) =>
          transactionType === 'EXPENSE'
            ? toAccountItem({
                account,
                note: categoryTypes.find((type) => type.key === account.category_type)?.label ?? '',
              })
            : toMoneyAccountItem(account),
        ),
    },
    location_id: {
      title: 'Location',
      searchLabel: 'Search locations',
      emptyText: 'There are no locations yet.',
      selectedId: location?.id,
      items: locations?.map((place) => ({
        id: place.id,
        name: place.name,
        color: undefined,
        note: '',
      })),
    },
  } satisfies Record<PickerField, unknown>;
  const requestError = formState.errors.root?.['server']?.message;

  function closePicker(field: PickerField) {
    flushSync(() => {
      setPickerField(undefined);
    });
    document.getElementById(`${rowIdPrefix}-${field}`)?.focus();
  }

  return (
    <>
      <form
        className={styles['transactionForm']}
        hidden={pickerField !== undefined}
        noValidate
        onSubmit={(event) => {
          void handleSubmit((movement) => {
            create.mutate(movement, {
              onSuccess: onClose,
              onError: (error) => {
                readSaveErrors({
                  error,
                  fields: FORM_FIELDS,
                  fallbackMessage: copy.saveError,
                }).forEach(({ field, message }) => {
                  const hiddenFieldTarget =
                    field === 'root.server' || isExtraAmountShown
                      ? undefined
                      : HIDDEN_FIELD_TARGETS[transactionType][field];
                  setError(hiddenFieldTarget ?? field, { message });
                });
              },
            });
          })(event);
        }}
      >
        <FormHeader
          transactionType={transactionType}
          transactionTypes={transactionTypes}
          onTypeChange={onTypeChange}
          onClose={onClose}
        />
        <AmountField
          label={copy.amountLabel}
          registration={register(amountField)}
          currency={amountAccount === undefined ? undefined : readAccountCurrency(amountAccount)}
          hint={readBaseCurrencyHint({
            account: amountAccount,
            amountText: isIncome ? destinationAmount : sourceAmount,
            baseCurrency,
          })}
          error={formState.errors[amountField]?.message}
        />
        <div className={styles['rows']}>
          <PickerRow
            id={`${rowIdPrefix}-from_account_id`}
            label={copy.from.title}
            value={fromAccount?.name}
            placeholder={copy.from.placeholder}
            color={fromAccount === undefined ? undefined : readAccountColor(fromAccount)}
            note={
              fromAccount === undefined || isIncome ? undefined : readMoneyAccountNote(fromAccount)
            }
            error={formState.errors.from_account_id?.message}
            onOpen={() => {
              setPickerField('from_account_id');
            }}
          />
          <PickerRow
            id={`${rowIdPrefix}-to_account_id`}
            label={copy.to.title}
            value={toAccount?.name}
            placeholder={copy.to.placeholder}
            color={toAccount === undefined ? undefined : readAccountColor(toAccount)}
            note={
              toAccount === undefined || transactionType === 'EXPENSE'
                ? undefined
                : readMoneyAccountNote(toAccount)
            }
            error={formState.errors.to_account_id?.message}
            onOpen={() => {
              setPickerField('to_account_id');
            }}
          />
          {transactionType === 'EXPENSE' && (
            <PickerRow
              id={`${rowIdPrefix}-location_id`}
              label="Location"
              value={location?.name}
              placeholder="Choose a location"
              color={undefined}
              note={undefined}
              error={formState.errors.location_id?.message}
              onOpen={() => {
                setPickerField('location_id');
              }}
            />
          )}
          {isIncome && (
            <SelectRow
              label="For month"
              registration={register('income_period')}
              options={readIncomeMonths({
                isoDate: readIsoDate(date) ?? today,
                selectedMonth: incomePeriod,
              })}
            />
          )}
          <InputRow
            label="Date"
            input={readDateInputProps(register('transaction_date'))}
            action={
              <CalendarButton
                label="transaction"
                value={date}
                max={today}
                onPick={(dateText) => {
                  setValue('transaction_date', dateText, {
                    shouldValidate: formState.isSubmitted,
                  });
                }}
              />
            }
            error={formState.errors.transaction_date?.message}
          />
        </div>
        {!isTransfer && (
          <label className={styles['anotherCurrency']}>
            <input
              {...register('is_paid_in_another_currency')}
              type="checkbox"
              className={styles['checkbox']}
            />
            Paid in another currency
          </label>
        )}
        {(isExtraAmountShown || isBaseCurrencyAmountAsked) && (
          <div className={[styles['rows'], styles['extraRows']].join(' ')}>
            {transactionType === 'EXPENSE' && (
              <ForeignAmountRow
                label="Seller’s amount"
                currencyLabel="Seller’s currency"
                amountRegistration={register('destination_amount')}
                currencyRegistration={register('destination_currency')}
                currencies={currencies}
                amountError={formState.errors.destination_amount?.message}
                currencyError={formState.errors.destination_currency?.message}
              />
            )}
            {isIncome && isPaidInAnotherCurrency && (
              <ForeignAmountRow
                label="Paid amount"
                currencyLabel="Paid currency"
                amountRegistration={register('source_amount')}
                currencyRegistration={register('source_currency')}
                currencies={currencies}
                amountError={formState.errors.source_amount?.message}
                currencyError={formState.errors.source_currency?.message}
              />
            )}
            {isBaseCurrencyAmountAsked && (
              <InputRow
                label={`In ${baseCurrency}`}
                input={{
                  ...register('base_currency_amount'),
                  inputMode: 'decimal',
                  autoComplete: 'off',
                  placeholder: '0.00',
                }}
                suffix={baseCurrency}
                error={formState.errors.base_currency_amount?.message}
              />
            )}
            {isDestinationAmountAsked && (
              <InputRow
                label="Amount received"
                input={{
                  ...register('destination_amount'),
                  inputMode: 'decimal',
                  autoComplete: 'off',
                  placeholder: '0.00',
                }}
                suffix={destination}
                error={formState.errors.destination_amount?.message}
              />
            )}
          </div>
        )}
        <div className={styles['rows']}>
          <InputRow
            label="Comment"
            input={{
              ...register('comment'),
              autoComplete: 'off',
              placeholder: 'Optional',
              maxLength: COMMENT_MAX_LENGTH,
            }}
            error={formState.errors.comment?.message}
          />
        </div>
        {requestError !== undefined && (
          <p className={styles['error']} role="alert">
            {requestError}
          </p>
        )}
        <button type="submit" className={styles['submit']} disabled={create.isPending}>
          {copy.submitLabel}
        </button>
      </form>
      {pickerField !== undefined && (
        <EntityPicker
          {...pickers[pickerField]}
          onSelect={(selectedId) => {
            setValue(pickerField, selectedId, { shouldValidate: formState.isSubmitted });
            closePicker(pickerField);
          }}
          onBack={() => {
            closePicker(pickerField);
          }}
        />
      )}
    </>
  );
}
