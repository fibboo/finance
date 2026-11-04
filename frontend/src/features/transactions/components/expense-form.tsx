import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { EntityPicker, type EntityPickerItem } from '@/components/entity-picker/entity-picker';
import { useToday } from '@/hooks/use-today';
import { readAccountColor } from '@/lib/account-colors';
import { ApiError } from '@/lib/api-error';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import type { EntryTransactionType } from '../api/new-transaction';
import { transactionMutations } from '../api/transaction-mutations';
import {
  COMMENT_MAX_LENGTH,
  createExpenseFormSchema,
  readAccountCurrency,
  readAmountText,
} from '../schemas/transaction-form';
import { AmountField } from './amount-field';
import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { FormHeader } from './form-header';
import { InputRow } from './input-row';
import { PickerRow } from './picker-row';
import styles from './transaction-form.module.css';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type ExpenseFormSchema = ReturnType<typeof createExpenseFormSchema>;
type ExpenseFormInput = z.input<ExpenseFormSchema>;
type ExpenseFormOutput = z.output<ExpenseFormSchema>;
type PickerField = 'from_account_id' | 'to_account_id' | 'location_id';

const SERVER_ERROR_STATUS = 500;
const SAVE_ERROR_MESSAGE = "Couldn't save the expense. Please try again.";
const FORM_FIELDS = [
  'from_account_id',
  'to_account_id',
  'location_id',
  'source_amount',
  'destination_amount',
  'destination_currency',
  'transaction_date',
  'comment',
] as const;

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
    readAccountCurrency(account) === baseCurrency ||
    rate <= 0
      ? undefined
      : `≈ ${formatMoney({ amount: Number(amount) * rate, currency: baseCurrency })}`;
  return hint;
}

function toMoneyAccountItem(account: Readonly<Account>): EntityPickerItem {
  const item = {
    id: account.id,
    name: account.name,
    color: readAccountColor(account),
    note: formatMoney({ amount: Number(account.balance), currency: readAccountCurrency(account) }),
  };
  return item;
}

type ExpenseFormProps = Readonly<{
  transactionTypes: readonly DictionaryItem[];
  categoryTypes: readonly DictionaryItem[];
  currencies: readonly DictionaryItem[];
  moneyAccounts: readonly Account[] | undefined;
  categories: readonly Account[] | undefined;
  locations: readonly Location[] | undefined;
  baseCurrency: string;
  relatedQueryKeys: readonly QueryKey[];
  onTypeChange: (transactionType: EntryTransactionType) => void;
  onClose: () => void;
}>;

export function ExpenseForm({
  transactionTypes,
  categoryTypes,
  currencies,
  moneyAccounts,
  categories,
  locations,
  baseCurrency,
  relatedQueryKeys,
  onTypeChange,
  onClose,
}: ExpenseFormProps) {
  const today = useToday();
  const [pickerField, setPickerField] = useState<PickerField | undefined>(undefined);
  const rowIdPrefix = useId();
  const resolver: Resolver<ExpenseFormInput, unknown, ExpenseFormOutput> = (
    values,
    context,
    options,
  ) => {
    const fromAccount = moneyAccounts?.find((account) => account.id === values.from_account_id);
    return zodResolver(
      createExpenseFormSchema({
        sourceCurrency: fromAccount === undefined ? undefined : readAccountCurrency(fromAccount),
        isPaidInAnotherCurrency: values.is_paid_in_another_currency,
        today,
      }),
    )(values, context, options);
  };
  const { control, register, handleSubmit, setError, setValue, formState } = useForm<
    ExpenseFormInput,
    unknown,
    ExpenseFormOutput
  >({
    resolver,
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      location_id: '',
      source_amount: '',
      is_paid_in_another_currency: false,
      destination_amount: '',
      destination_currency: '',
      transaction_date: toDateText(today),
      comment: '',
    },
  });
  const [fromAccountId, categoryId, locationId, amountText, isPaidInAnotherCurrency, date] =
    useWatch({
      control,
      name: [
        'from_account_id',
        'to_account_id',
        'location_id',
        'source_amount',
        'is_paid_in_another_currency',
        'transaction_date',
      ],
    });
  const create = useMutation(transactionMutations.create(relatedQueryKeys));
  const fromAccount = moneyAccounts?.find((account) => account.id === fromAccountId);
  const category = categories?.find((account) => account.id === categoryId);
  const location = locations?.find((place) => place.id === locationId);
  const pickers = {
    from_account_id: {
      title: 'From',
      searchLabel: 'Search accounts',
      emptyText: 'There are no accounts yet.',
      selectedId: fromAccount?.id,
      items: moneyAccounts?.map((account) => toMoneyAccountItem(account)),
    },
    to_account_id: {
      title: 'Category',
      searchLabel: 'Search categories',
      emptyText: 'There are no categories yet.',
      selectedId: category?.id,
      items: categories?.map((account) => ({
        id: account.id,
        name: account.name,
        color: readAccountColor(account),
        note: categoryTypes.find((type) => type.key === account.category_type)?.label ?? '',
      })),
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
                if (!(error instanceof ApiError) || error.fieldErrors.length === 0) {
                  setError('root.server', {
                    message:
                      error instanceof ApiError && error.status < SERVER_ERROR_STATUS
                        ? error.message
                        : SAVE_ERROR_MESSAGE,
                  });
                } else {
                  error.fieldErrors.forEach((fieldError) => {
                    const field = FORM_FIELDS.find((formField) => formField === fieldError.field);
                    setError(field ?? 'root.server', { message: fieldError.message });
                  });
                }
              },
            });
          })(event);
        }}
      >
        <FormHeader
          transactionType="EXPENSE"
          transactionTypes={transactionTypes}
          onTypeChange={onTypeChange}
          onClose={onClose}
        />
        <AmountField
          label="Amount"
          registration={register('source_amount')}
          currency={fromAccount === undefined ? undefined : readAccountCurrency(fromAccount)}
          hint={readBaseCurrencyHint({ account: fromAccount, amountText, baseCurrency })}
          error={formState.errors.source_amount?.message}
        />
        <div className={styles['rows']}>
          <PickerRow
            id={`${rowIdPrefix}-from_account_id`}
            label="From"
            value={fromAccount?.name}
            placeholder="Choose an account"
            color={fromAccount === undefined ? undefined : readAccountColor(fromAccount)}
            note={fromAccount === undefined ? undefined : toMoneyAccountItem(fromAccount).note}
            error={formState.errors.from_account_id?.message}
            onOpen={() => {
              setPickerField('from_account_id');
            }}
          />
          <PickerRow
            id={`${rowIdPrefix}-to_account_id`}
            label="Category"
            value={category?.name}
            placeholder="Choose a category"
            color={category === undefined ? undefined : readAccountColor(category)}
            note={undefined}
            error={formState.errors.to_account_id?.message}
            onOpen={() => {
              setPickerField('to_account_id');
            }}
          />
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
        <label className={styles['anotherCurrency']}>
          <input
            {...register('is_paid_in_another_currency')}
            type="checkbox"
            className={styles['checkbox']}
          />
          Paid in another currency
        </label>
        {isPaidInAnotherCurrency && (
          <div className={[styles['rows'], styles['sellerRows']].join(' ')}>
            <InputRow
              label="Seller’s amount"
              input={{
                ...register('destination_amount'),
                inputMode: 'decimal',
                autoComplete: 'off',
                placeholder: '0.00',
              }}
              suffix={
                <select
                  {...register('destination_currency')}
                  className={styles['currencySelect']}
                  aria-label="Seller’s currency"
                  aria-invalid={formState.errors.destination_currency !== undefined}
                >
                  <option value="">Currency</option>
                  {currencies.map((currency) => (
                    <option key={currency.key} value={currency.key}>
                      {currency.key}
                    </option>
                  ))}
                </select>
              }
              error={
                formState.errors.destination_amount?.message ??
                formState.errors.destination_currency?.message
              }
            />
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
          Add expense
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
