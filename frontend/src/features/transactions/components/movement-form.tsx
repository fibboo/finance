import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { FormProvider, type Resolver, useForm, useWatch } from 'react-hook-form';

import { type CreateFormProps, EntityPicker } from '@/components/entity-picker/entity-picker';
import { useToday } from '@/hooks/use-today';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';

import type { EntryTransactionType, MovementTransactionType } from '../api/new-transaction';
import { transactionMutations } from '../api/transaction-mutations';
import {
  COMMENT_MAX_LENGTH,
  createExpenseFormSchema,
  createIncomeFormSchema,
  createTransferFormSchema,
  type MovementFormValues,
  readAccountCurrency,
} from '../schemas/transaction-form';
import { AmountField } from './amount-field';
import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { ExpenseExtraRows } from './expense-extra-rows';
import { FormHeader } from './form-header';
import { IncomeExtraRows } from './income-extra-rows';
import { IncomeMonthRow } from './income-month-row';
import { InputRow } from './input-row';
import { readMoneyAccountNote } from './money-account-item';
import {
  HIDDEN_FIELD_TARGETS,
  LOCATION_COPY,
  MOVEMENT_COPY,
  MOVEMENT_FORM_FIELDS,
  type MovementPickerField,
  readBaseCurrencyHint,
  readMovementCurrencies,
  readMovementPickers,
} from './movement-config';
import { PickerRow } from './picker-row';
import { readSaveErrors } from './save-errors';
import styles from './transaction-form.module.css';
import { TransferExtraRows } from './transfer-extra-rows';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type MovementRequest = components['schemas']['MovementRequest'];
type CreateFormRenderer = (props: CreateFormProps) => ReactNode;

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
  renderIncomeSourceForm: CreateFormRenderer;
  renderLocationForm: CreateFormRenderer;
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
  renderIncomeSourceForm,
  renderLocationForm,
  onTypeChange,
  onClose,
}: MovementFormProps) {
  const today = useToday();
  const [pickerField, setPickerField] = useState<MovementPickerField | undefined>(undefined);
  const rowIdPrefix = useId();
  const copy = MOVEMENT_COPY[transactionType];
  const fromAccounts = transactionType === 'INCOME' ? incomeSources : moneyAccounts;
  const toAccounts = transactionType === 'EXPENSE' ? categories : moneyAccounts;
  const resolver: Resolver<MovementFormValues, unknown, MovementRequest> = (
    values,
    context,
    options,
  ) => {
    const { source, destination, isDestinationAmountAsked, isBaseCurrencyAmountAsked } =
      readMovementCurrencies({
        transactionType,
        fromAccount: fromAccounts?.find((account) => account.id === values.from_account_id),
        toAccount: toAccounts?.find((account) => account.id === values.to_account_id),
        isPaidInAnotherCurrency: values.is_paid_in_another_currency,
        paidCurrency: values.source_currency,
        baseCurrency,
      });
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
    const resolution = zodResolver(schemas[transactionType]())(values, context, options);
    return resolution;
  };
  const form = useForm<MovementFormValues, unknown, MovementRequest>({
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
  const { control, register, handleSubmit, setError, setValue, formState } = form;
  const [
    fromAccountId,
    toAccountId,
    locationId,
    sourceAmount,
    sourceCurrency,
    isPaidInAnotherCurrency,
    destinationAmount,
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
      'transaction_date',
    ],
  });
  const create = useMutation(transactionMutations.create(relatedQueryKeys));
  const fromAccount = fromAccounts?.find((account) => account.id === fromAccountId);
  const toAccount = toAccounts?.find((account) => account.id === toAccountId);
  const location = locations?.find((place) => place.id === locationId);
  const { destination, isDestinationAmountAsked, isBaseCurrencyAmountAsked } =
    readMovementCurrencies({
      transactionType,
      fromAccount,
      toAccount,
      isPaidInAnotherCurrency,
      paidCurrency: sourceCurrency,
      baseCurrency,
    });
  const isIncome = transactionType === 'INCOME';
  const amountAccount = isIncome ? toAccount : fromAccount;
  const isExtraAmountShown =
    transactionType === 'TRANSFER' ? isDestinationAmountAsked : isPaidInAnotherCurrency;
  const pickers = readMovementPickers({
    transactionType,
    fromAccounts,
    toAccounts,
    locations,
    categoryTypes,
    fromAccountId,
    toAccountId,
    locationId,
  });
  const createFormRenderers: Readonly<Record<MovementPickerField, CreateFormRenderer | undefined>> =
    {
      from_account_id: transactionType === 'INCOME' ? renderIncomeSourceForm : undefined,
      to_account_id: undefined,
      location_id: renderLocationForm,
    };
  const requestError = formState.errors.root?.['server']?.message;

  function closePicker(field: MovementPickerField) {
    flushSync(() => {
      setPickerField(undefined);
    });
    document.getElementById(`${rowIdPrefix}-${field}`)?.focus();
  }

  return (
    <FormProvider {...form}>
      <form
        className={styles['transactionForm']}
        hidden={pickerField !== undefined}
        noValidate
        onSubmit={(event) => {
          void handleSubmit((movement) => {
            create.mutate(movement, {
              onSuccess: onClose,
              onError: (error) => {
                const targets = HIDDEN_FIELD_TARGETS[transactionType];
                readSaveErrors({
                  error,
                  fields: MOVEMENT_FORM_FIELDS,
                  fallbackMessage: copy.saveError,
                }).forEach(({ field, message }) => {
                  const target =
                    field === 'root.server'
                      ? undefined
                      : ((isExtraAmountShown ? undefined : targets.extra[field]) ??
                        targets.always[field]);
                  setError(target ?? field, { message });
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
          registration={register(isIncome ? 'destination_amount' : 'source_amount')}
          currency={amountAccount === undefined ? undefined : readAccountCurrency(amountAccount)}
          hint={
            isIncome && isPaidInAnotherCurrency
              ? undefined
              : readBaseCurrencyHint({
                  account: amountAccount,
                  amountText: isIncome ? destinationAmount : sourceAmount,
                  baseCurrency,
                })
          }
          error={
            (isIncome ? formState.errors.destination_amount : formState.errors.source_amount)
              ?.message
          }
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
              label={LOCATION_COPY.title}
              value={location?.name}
              placeholder={LOCATION_COPY.placeholder}
              color={undefined}
              note={undefined}
              error={formState.errors.location_id?.message}
              onOpen={() => {
                setPickerField('location_id');
              }}
            />
          )}
          {isIncome && <IncomeMonthRow />}
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
        {transactionType !== 'TRANSFER' && (
          <label className={styles['anotherCurrency']}>
            <input
              {...register('is_paid_in_another_currency')}
              type="checkbox"
              className={styles['checkbox']}
            />
            Paid in another currency
          </label>
        )}
        {transactionType === 'EXPENSE' && <ExpenseExtraRows currencies={currencies} />}
        {isIncome && (
          <IncomeExtraRows
            currencies={currencies}
            baseCurrency={baseCurrency}
            isBaseCurrencyAmountAsked={isBaseCurrencyAmountAsked}
          />
        )}
        {transactionType === 'TRANSFER' && (
          <TransferExtraRows
            destinationCurrency={destination}
            isDestinationAmountAsked={isDestinationAmountAsked}
          />
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
          renderCreateForm={createFormRenderers[pickerField]}
          onSelect={(selectedId) => {
            setValue(pickerField, selectedId, { shouldValidate: formState.isSubmitted });
            closePicker(pickerField);
          }}
          onBack={() => {
            closePicker(pickerField);
          }}
        />
      )}
    </FormProvider>
  );
}
