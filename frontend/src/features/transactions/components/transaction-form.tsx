import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { EntityPicker } from '@/components/entity-picker/entity-picker';
import { useToday } from '@/hooks/use-today';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import type { AdjustmentTransactionType, EntryTransactionType } from '../api/new-transaction';
import { transactionMutations } from '../api/transaction-mutations';
import {
  COMMENT_MAX_LENGTH,
  createAdjustmentFormSchema,
  isBaseCurrencyAmountNeeded,
  readAccountCurrency,
  readAmountText,
} from '../schemas/transaction-form';
import { AmountField } from './amount-field';
import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { FormHeader } from './form-header';
import { InputRow } from './input-row';
import { readMoneyAccountNote, toMoneyAccountItem } from './money-account-item';
import { PickerRow } from './picker-row';
import { readSaveErrors } from './save-errors';
import styles from './transaction-form.module.css';

type Account = components['schemas']['Account'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type AdjustmentFormSchema = ReturnType<typeof createAdjustmentFormSchema>;
type AdjustmentFormInput = z.input<AdjustmentFormSchema>;
type AdjustmentFormOutput = z.output<AdjustmentFormSchema>;

const SAVE_ERROR_MESSAGE = "Couldn't save the adjustment. Please try again.";
const FORM_FIELDS = [
  'account_id',
  'new_balance',
  'base_currency_amount',
  'transaction_date',
  'comment',
] as const;

function readBalanceHint({
  account,
  newBalanceText,
}: Readonly<{ account: Readonly<Account>; newBalanceText: string }>): string {
  const currency = readAccountCurrency(account);
  const balance = formatMoney({ amount: Number(account.balance), currency });
  const newBalance = readAmountText(newBalanceText);
  const difference =
    newBalance === undefined
      ? ''
      : ` · ${formatMoney({
          amount: Number(newBalance) - Number(account.balance),
          currency,
          signDisplay: 'exceptZero',
        })}`;
  const hint = `Now ${balance}${difference}`;
  return hint;
}

type TransactionFormProps = Readonly<{
  transactionType: AdjustmentTransactionType;
  transactionTypes: readonly DictionaryItem[];
  moneyAccounts: readonly Account[] | undefined;
  baseCurrency: string;
  relatedQueryKeys: readonly QueryKey[];
  onTypeChange: (transactionType: EntryTransactionType) => void;
  onClose: () => void;
}>;

export function TransactionForm({
  transactionType,
  transactionTypes,
  moneyAccounts,
  baseCurrency,
  relatedQueryKeys,
  onTypeChange,
  onClose,
}: TransactionFormProps) {
  const today = useToday();
  const [isPickingAccount, setIsPickingAccount] = useState(false);
  const [isBaseAmountAsked, setIsBaseAmountAsked] = useState(false);
  const accountRowId = useId();
  const resolver: Resolver<AdjustmentFormInput, unknown, AdjustmentFormOutput> = (
    values,
    context,
    options,
  ) =>
    zodResolver(
      createAdjustmentFormSchema({
        account: moneyAccounts?.find((account) => account.id === values.account_id),
        baseCurrency,
        today,
      }),
    )(values, context, options);
  const { control, register, handleSubmit, setError, setValue, clearErrors, formState } = useForm<
    AdjustmentFormInput,
    unknown,
    AdjustmentFormOutput
  >({
    resolver,
    defaultValues: {
      account_id: '',
      new_balance: '',
      base_currency_amount: '',
      transaction_date: toDateText(today),
      comment: '',
    },
  });
  const [accountId, newBalanceText, transactionDate] = useWatch({
    control,
    name: ['account_id', 'new_balance', 'transaction_date'],
  });
  const adjust = useMutation(transactionMutations.adjust(relatedQueryKeys));
  const account = moneyAccounts?.find((moneyAccount) => moneyAccount.id === accountId);
  const requestError = formState.errors.root?.['server']?.message;

  function closePicker() {
    flushSync(() => {
      setIsPickingAccount(false);
    });
    document.getElementById(accountRowId)?.focus();
  }

  return (
    <>
      <form
        className={styles['transactionForm']}
        hidden={isPickingAccount}
        noValidate
        onSubmit={(event) => {
          void handleSubmit((values) => {
            adjust.mutate(values, {
              onSuccess: onClose,
              onError: (error) => {
                readSaveErrors({
                  error,
                  fields: FORM_FIELDS,
                  fallbackMessage: SAVE_ERROR_MESSAGE,
                }).forEach(({ field, message }) => {
                  if (field === 'base_currency_amount') {
                    setIsBaseAmountAsked(true);
                  }
                  setError(field, { message });
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
          label="New balance"
          registration={register('new_balance')}
          currency={account === undefined ? undefined : readAccountCurrency(account)}
          hint={account === undefined ? undefined : readBalanceHint({ account, newBalanceText })}
          error={formState.errors.new_balance?.message}
        />
        <div className={styles['rows']}>
          <PickerRow
            id={accountRowId}
            label="Account"
            value={account?.name}
            placeholder="Choose an account"
            color={account === undefined ? undefined : readAccountColor(account)}
            note={account === undefined ? undefined : readMoneyAccountNote(account)}
            error={formState.errors.account_id?.message}
            onOpen={() => {
              setIsPickingAccount(true);
            }}
          />
          <InputRow
            label="Date"
            input={readDateInputProps(register('transaction_date'))}
            action={
              <CalendarButton
                label="transaction"
                value={transactionDate}
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
        {(isBaseAmountAsked || isBaseCurrencyAmountNeeded({ account, baseCurrency })) && (
          <div className={styles['rows']}>
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
        <button type="submit" className={styles['submit']} disabled={adjust.isPending}>
          Adjust balance
        </button>
      </form>
      {isPickingAccount && (
        <EntityPicker
          title="Account"
          searchLabel="Search accounts"
          emptyText="There are no accounts yet."
          items={moneyAccounts?.map(toMoneyAccountItem)}
          selectedId={account?.id}
          onSelect={(selectedAccountId) => {
            if (selectedAccountId !== accountId) {
              setValue('base_currency_amount', '');
              clearErrors('base_currency_amount');
              setIsBaseAmountAsked(false);
            }
            setValue('account_id', selectedAccountId, { shouldValidate: formState.isSubmitted });
            closePicker();
          }}
          onBack={closePicker}
        />
      )}
    </>
  );
}
