import { zodResolver } from '@hookform/resolvers/zod';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';
import { flushSync } from 'react-dom';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { type CreateFormProps, EntityPicker } from '@/components/entity-picker/entity-picker';
import { useToday } from '@/hooks/use-today';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { readIsoDate, toDateText } from '@/lib/format-date';
import { formatMoney } from '@/lib/format-money';

import type { AdjustmentTransactionType } from '../api/new-transaction';
import { transactionMutations } from '../api/transaction-mutations';
import { transactionQueries } from '../api/transaction-queries';
import {
  type AdjustmentFormValues,
  COMMENT_MAX_LENGTH,
  createAdjustmentFormSchema,
  isBaseCurrencyAmountNeeded,
  readAccountCurrency,
  readAmountText,
} from '../schemas/transaction-form';
import { readAdjustmentPosting, readAdjustmentValues } from './adjustment-values';
import { AmountField } from './amount-field';
import { readAmountInputProps } from './amount-input';
import { CalendarButton } from './calendar-button';
import { readDateInputProps } from './date-input';
import { FormHeader, NEW_TRANSACTION_TITLE, type TypeChoice } from './form-header';
import { InputRow } from './input-row';
import { readMoneyAccountNote, toMoneyAccountItem } from './money-account-item';
import { addOwnChoices } from './movement-values';
import { PickerRow } from './picker-row';
import { readSaveErrors } from './save-errors';
import styles from './transaction-form.module.css';

type Account = components['schemas']['Account'];
type Transaction = components['schemas']['Transaction'];
type AdjustmentFormOutput = z.output<ReturnType<typeof createAdjustmentFormSchema>>;

const SAVE_ERROR_MESSAGE = "Couldn't save the adjustment. Please try again.";
const FORM_FIELDS = [
  'account_id',
  'amount',
  'base_currency_amount',
  'transaction_date',
  'comment',
] as const;

function readBalanceHint({
  account,
  amountText,
  savedAmount,
}: Readonly<{ account: Readonly<Account>; amountText: string; savedAmount: number }>): string {
  const currency = readAccountCurrency(account);
  const balance = Number(account.balance);
  const amount = readAmountText(amountText);
  const newBalance =
    amount === undefined || Number(amount) === savedAmount
      ? ''
      : ` → ${formatMoney({ amount: balance - savedAmount + Number(amount), currency })}`;
  const hint = `Now ${formatMoney({ amount: balance, currency })}${newBalance}`;
  return hint;
}

function readAdjustmentDate({
  dateText,
  today,
}: Readonly<{ dateText: string; today: string }>): string | undefined {
  const isoDate = readIsoDate(dateText);
  const adjustmentDate = isoDate !== undefined && isoDate <= today ? isoDate : undefined;
  return adjustmentDate;
}

type TransactionFormMode =
  | Readonly<{
      kind: 'create';
      typeChoice: TypeChoice;
      presetAccountId: string | undefined;
      renderMoneyAccountForm: (props: CreateFormProps) => ReactNode;
    }>
  | Readonly<{ kind: 'edit'; transaction: Readonly<Transaction> }>;

type TransactionFormProps = Readonly<{
  mode: TransactionFormMode;
  transactionType: AdjustmentTransactionType;
  moneyAccounts: readonly Account[] | undefined;
  baseCurrency: string;
  relatedQueryKeys: readonly QueryKey[];
  onClose: () => void;
}>;

export function TransactionForm({
  mode,
  transactionType,
  moneyAccounts,
  baseCurrency,
  relatedQueryKeys,
  onClose,
}: TransactionFormProps) {
  const today = useToday();
  const queryClient = useQueryClient();
  const [isPickingAccount, setIsPickingAccount] = useState(false);
  const [isBaseAmountAsked, setIsBaseAmountAsked] = useState(false);
  const accountRowId = useId();
  const editedPosting = mode.kind === 'edit' ? readAdjustmentPosting(mode.transaction) : undefined;
  const editedTransactionId = mode.kind === 'edit' ? mode.transaction.id : undefined;
  const accounts = addOwnChoices({ choices: moneyAccounts, ownChoices: [editedPosting?.account] });
  const resolver: Resolver<AdjustmentFormValues, unknown, AdjustmentFormOutput> = (
    values,
    context,
    options,
  ) => {
    const listedAccount = accounts?.find((moneyAccount) => moneyAccount.id === values.account_id);
    const listedAccountOnDate = queryClient.getQueryData(
      transactionQueries.accountOnDate({
        accountId: listedAccount?.id,
        date: readAdjustmentDate({ dateText: values.transaction_date, today }),
        excludedTransactionId: editedTransactionId,
      }).queryKey,
    );
    const adjustmentFormSchema = createAdjustmentFormSchema({
      account: listedAccount,
      isBaseCurrencyAmountAsked:
        isBaseAmountAsked ||
        isBaseCurrencyAmountNeeded({
          account: listedAccountOnDate ?? listedAccount,
          baseCurrency,
        }),
      baseCurrency,
      today,
    });
    return zodResolver(adjustmentFormSchema)(values, context, options);
  };
  const { control, register, handleSubmit, setError, setValue, clearErrors, formState } = useForm<
    AdjustmentFormValues,
    unknown,
    AdjustmentFormOutput
  >({
    resolver,
    ...(mode.kind === 'edit'
      ? {
          values: readAdjustmentValues(mode.transaction),
          resetOptions: { keepDirtyValues: true },
        }
      : {
          defaultValues: {
            account_id: mode.presetAccountId ?? '',
            amount: '',
            base_currency_amount: '',
            transaction_date: toDateText(today),
            comment: '',
          },
        }),
  });
  const [accountId, amountText, transactionDate] = useWatch({
    control,
    name: ['account_id', 'amount', 'transaction_date'],
  });
  const adjust = useMutation(transactionMutations.adjust(relatedQueryKeys));
  const account = accounts?.find((moneyAccount) => moneyAccount.id === accountId);
  const { data: accountOnDate } = useQuery(
    transactionQueries.accountOnDate({
      accountId: account?.id,
      date: readAdjustmentDate({ dateText: transactionDate, today }),
      excludedTransactionId: editedTransactionId,
    }),
  );
  const isBaseAmountShown =
    isBaseAmountAsked ||
    isBaseCurrencyAmountNeeded({ account: accountOnDate ?? account, baseCurrency });
  const requestError = formState.errors.root?.['server']?.message;

  function forgetAskedBaseAmount() {
    if (isBaseAmountAsked) {
      clearErrors('base_currency_amount');
      setIsBaseAmountAsked(false);
    }
  }

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
            adjust.mutate(
              { ...values, transaction_id: editedTransactionId },
              {
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
              },
            );
          })(event);
        }}
      >
        <FormHeader
          title={mode.kind === 'edit' ? 'Edit adjustment' : NEW_TRANSACTION_TITLE}
          transactionType={transactionType}
          typeChoice={mode.kind === 'create' ? mode.typeChoice : undefined}
          onClose={onClose}
        />
        <AmountField
          label="Amount"
          registration={register('amount')}
          isNegativeAllowed
          currency={account === undefined ? undefined : readAccountCurrency(account)}
          hint={
            account === undefined
              ? undefined
              : readBalanceHint({
                  account,
                  amountText,
                  savedAmount: Number(editedPosting?.amount ?? 0),
                })
          }
          error={formState.errors.amount?.message}
        />
        {isBaseAmountShown && (
          <div className={styles['rows']}>
            <InputRow
              label={`In ${baseCurrency}`}
              input={readAmountInputProps({
                registration: register('base_currency_amount'),
                isNegativeAllowed: false,
              })}
              suffix={baseCurrency}
              error={formState.errors.base_currency_amount?.message}
            />
          </div>
        )}
        <div className={styles['rows']}>
          <PickerRow
            id={accountRowId}
            label="Account"
            value={account?.name}
            placeholder="Choose an account"
            color={account === undefined ? undefined : readAccountColor(account)}
            note={account === undefined ? undefined : readMoneyAccountNote(account)}
            error={formState.errors.account_id?.message}
            onOpen={
              mode.kind === 'edit'
                ? undefined
                : () => {
                    setIsPickingAccount(true);
                  }
            }
          />
          <InputRow
            label="Date"
            input={readDateInputProps(
              register('transaction_date', { onChange: forgetAskedBaseAmount }),
            )}
            action={
              <CalendarButton
                label="transaction"
                value={transactionDate}
                max={today}
                onPick={(dateText) => {
                  forgetAskedBaseAmount();
                  setValue('transaction_date', dateText, {
                    shouldDirty: true,
                    shouldValidate: formState.isSubmitted,
                  });
                }}
              />
            }
            error={formState.errors.transaction_date?.message}
          />
        </div>
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
        <button
          type="submit"
          className={styles['submit']}
          disabled={adjust.isPending || moneyAccounts === undefined}
        >
          {mode.kind === 'edit' ? 'Save changes' : 'Adjust balance'}
        </button>
      </form>
      {mode.kind === 'create' && isPickingAccount && (
        <EntityPicker
          title="Account"
          searchLabel="Search accounts"
          emptyText="There are no accounts yet."
          items={moneyAccounts?.map(toMoneyAccountItem)}
          selectedId={account?.id}
          create={{ label: 'Create account', renderForm: mode.renderMoneyAccountForm }}
          onSelect={(selectedAccountId) => {
            if (selectedAccountId !== accountId) {
              forgetAskedBaseAmount();
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
