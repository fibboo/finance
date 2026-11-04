import type { EntityPickerItem } from '@/components/entity-picker/entity-picker';
import { readAccountColor } from '@/lib/account-colors';
import type { components } from '@/lib/api-schema';
import { formatMoney } from '@/lib/format-money';

import type { MovementTransactionType } from '../api/new-transaction';
import { readAccountCurrency, readAmountText } from '../schemas/transaction-form';
import { toMoneyAccountItem } from './money-account-item';

type Account = components['schemas']['Account'];
type Location = components['schemas']['Location'];
type DictionaryItem = components['schemas']['DictionaryItem'];
type PickerCopy = Readonly<{
  title: string;
  placeholder: string;
  searchLabel: string;
  emptyText: string;
}>;
type MovementPicker = Readonly<{
  title: string;
  searchLabel: string;
  emptyText: string;
  selectedId: string | undefined;
  items: readonly EntityPickerItem[] | undefined;
}>;
type FieldTargets = Readonly<Partial<Record<MovementFormField, MovementFormField>>>;

export type MovementPickerField = 'from_account_id' | 'to_account_id' | 'location_id';
export type MovementFormField = (typeof MOVEMENT_FORM_FIELDS)[number];

export const MOVEMENT_FORM_FIELDS = [
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

export const LOCATION_COPY = {
  title: 'Location',
  placeholder: 'Choose a location',
  searchLabel: 'Search locations',
  emptyText: 'There are no locations yet.',
} satisfies PickerCopy;

export const MOVEMENT_COPY = {
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

export const HIDDEN_FIELD_TARGETS: Readonly<
  Record<MovementTransactionType, Readonly<{ always: FieldTargets; extra: FieldTargets }>>
> = {
  EXPENSE: {
    always: { source_currency: 'from_account_id' },
    extra: { destination_amount: 'source_amount', destination_currency: 'from_account_id' },
  },
  INCOME: {
    always: { destination_currency: 'to_account_id' },
    extra: { source_amount: 'destination_amount', source_currency: 'to_account_id' },
  },
  TRANSFER: {
    always: { source_currency: 'from_account_id', destination_currency: 'to_account_id' },
    extra: { destination_amount: 'source_amount' },
  },
};

export function readMovementCurrencies({
  transactionType,
  fromAccount,
  toAccount,
  isPaidInAnotherCurrency,
  paidCurrency,
  baseCurrency,
}: Readonly<{
  transactionType: MovementTransactionType;
  fromAccount: Readonly<Account> | undefined;
  toAccount: Readonly<Account> | undefined;
  isPaidInAnotherCurrency: boolean;
  paidCurrency: string;
  baseCurrency: string;
}>) {
  const source =
    fromAccount === undefined || transactionType === 'INCOME'
      ? undefined
      : readAccountCurrency(fromAccount);
  const destination =
    toAccount === undefined || transactionType === 'EXPENSE'
      ? undefined
      : readAccountCurrency(toAccount);
  const movementCurrencies = {
    source,
    destination,
    isDestinationAmountAsked:
      transactionType === 'TRANSFER' &&
      source !== undefined &&
      destination !== undefined &&
      source !== destination &&
      destination !== baseCurrency,
    isBaseCurrencyAmountAsked:
      transactionType === 'INCOME' &&
      destination !== undefined &&
      destination !== baseCurrency &&
      (isPaidInAnotherCurrency ? paidCurrency : destination) !== baseCurrency,
  };
  return movementCurrencies;
}

export function readBaseCurrencyHint({
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

function toAccountItem({
  account,
  note,
}: Readonly<{ account: Readonly<Account>; note: string }>): EntityPickerItem {
  const item = { id: account.id, name: account.name, color: readAccountColor(account), note };
  return item;
}

export function readMovementPickers({
  transactionType,
  fromAccounts,
  toAccounts,
  locations,
  categoryTypes,
  fromAccountId,
  toAccountId,
  locationId,
}: Readonly<{
  transactionType: MovementTransactionType;
  fromAccounts: readonly Account[] | undefined;
  toAccounts: readonly Account[] | undefined;
  locations: readonly Location[] | undefined;
  categoryTypes: readonly DictionaryItem[];
  fromAccountId: string;
  toAccountId: string;
  locationId: string;
}>): Readonly<Record<MovementPickerField, MovementPicker>> {
  const isTransfer = transactionType === 'TRANSFER';
  const copy = MOVEMENT_COPY[transactionType];
  const pickers = {
    from_account_id: {
      title: copy.from.title,
      searchLabel: copy.from.searchLabel,
      emptyText: copy.from.emptyText,
      selectedId: fromAccounts?.find((account) => account.id === fromAccountId)?.id,
      items: fromAccounts
        ?.filter((account) => !isTransfer || account.id !== toAccountId)
        .map((account) =>
          transactionType === 'INCOME'
            ? toAccountItem({ account, note: '' })
            : toMoneyAccountItem(account),
        ),
    },
    to_account_id: {
      title: copy.to.title,
      searchLabel: copy.to.searchLabel,
      emptyText: copy.to.emptyText,
      selectedId: toAccounts?.find((account) => account.id === toAccountId)?.id,
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
      title: LOCATION_COPY.title,
      searchLabel: LOCATION_COPY.searchLabel,
      emptyText: LOCATION_COPY.emptyText,
      selectedId: locations?.find((place) => place.id === locationId)?.id,
      items: locations?.map((place) => ({
        id: place.id,
        name: place.name,
        color: undefined,
        note: '',
      })),
    },
  };
  return pickers;
}
