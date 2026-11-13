import { useQuery } from '@tanstack/react-query';

import { useBaseCurrency } from '@/app/use-base-currency';
import type { CreateFormProps } from '@/components/entity-picker/entity-picker';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { IncomeSourceForm } from '@/features/accounts/components/income-source-form';
import { MoneyAccountForm } from '@/features/accounts/components/money-account-form';
import { currencyQueries } from '@/features/currencies/api/currency-queries';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { LOCATION_PAGE_SIZE, locationQueries } from '@/features/locations/api/location-queries';
import { LocationForm } from '@/features/locations/components/location-form';
import type { EntryTransactionType } from '@/features/transactions/api/new-transaction';
import { MONEY_ACCOUNT_KINDS } from '@/lib/account-kinds';
import { isThrownWithoutData } from '@/lib/query-meta';

export function useMovementChoices(transactionType: EntryTransactionType | undefined) {
  const isOpen = transactionType !== undefined;
  const isExpense = transactionType === 'EXPENSE';
  const baseCurrency = useBaseCurrency();
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    enabled: isOpen,
    throwOnError: isThrownWithoutData,
  });
  const { data: currencies } = useQuery({
    ...currencyQueries.recentUse(),
    enabled: isOpen,
    throwOnError: isThrownWithoutData,
  });
  const { data: moneyAccounts } = useQuery({
    ...accountQueries.list({
      kinds: [...MONEY_ACCOUNT_KINDS],
      size: ACCOUNT_PAGE_SIZE,
      order: 'recent_use',
    }),
    enabled: isOpen,
    throwOnError: isThrownWithoutData,
  });
  const { data: categories } = useQuery({
    ...accountQueries.list({ kinds: ['EXPENSE'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
    throwOnError: isThrownWithoutData,
  });
  const { data: locations } = useQuery({
    ...locationQueries.list({ size: LOCATION_PAGE_SIZE, order: 'recent_use' }),
    enabled: isExpense,
    throwOnError: isThrownWithoutData,
  });
  const { data: incomeSources } = useQuery({
    ...accountQueries.list({ kinds: ['INCOME'], size: ACCOUNT_PAGE_SIZE, order: 'recent_use' }),
    enabled: transactionType === 'INCOME',
    throwOnError: isThrownWithoutData,
  });

  function renderMoneyAccountForm(props: CreateFormProps) {
    if (dictionaries === undefined || currencies === undefined || baseCurrency === undefined) {
      throw new Error(
        'A money account form needs the dictionaries, the currencies and the base currency.',
      );
    }

    return (
      <MoneyAccountForm
        mode={{ kind: 'create', name: props.name, onCreated: props.onCreated }}
        onBack={props.onBack}
        accountKinds={dictionaries.account_kinds}
        currencies={currencies}
        baseCurrency={baseCurrency}
      />
    );
  }

  function renderCategoryForm(props: CreateFormProps) {
    if (dictionaries === undefined) {
      throw new Error('A category form needs the dictionaries.');
    }

    return (
      <CategoryForm
        mode={{ kind: 'create', name: props.name, onCreated: props.onCreated }}
        categoryTypes={dictionaries.category_types}
        onBack={props.onBack}
      />
    );
  }

  const isEveryListLoaded =
    moneyAccounts !== undefined &&
    (!isExpense || (categories !== undefined && locations !== undefined)) &&
    (transactionType !== 'INCOME' || incomeSources !== undefined);
  const movementChoices = {
    dictionaries,
    currencies,
    baseCurrency,
    moneyAccounts: moneyAccounts?.items,
    categories: categories?.items,
    incomeSources: incomeSources?.items,
    locations: locations?.items,
    isEveryListLoaded,
    createForms: {
      renderCategoryForm,
      renderIncomeSourceForm(props: CreateFormProps) {
        return (
          <IncomeSourceForm
            mode={{ kind: 'create', name: props.name, onCreated: props.onCreated }}
            onBack={props.onBack}
          />
        );
      },
      renderMoneyAccountForm,
      renderLocationForm(props: CreateFormProps) {
        return <LocationForm {...props} />;
      },
    },
  };
  return movementChoices;
}
