import { useQuery } from '@tanstack/react-query';

import { classificationQueries } from '@/features/accounts/api/classification-queries';
import type { AccountOptionChoices } from '@/features/transactions/components/account-option-metadata';
import type { components } from '@/lib/api-schema';

type AccountingDictionaries = components['schemas']['AccountingDictionaries'];

export function useAccountOptionChoices({
  dictionaries,
  isEnabled,
  hasCategories,
}: Readonly<{
  dictionaries: AccountingDictionaries | undefined;
  isEnabled: boolean;
  hasCategories: boolean;
}>): AccountOptionChoices {
  const { data: moneyAccountTypes } = useQuery({
    ...classificationQueries.list('MONEY_ACCOUNT'),
    enabled: isEnabled,
  });
  const { data: expenseCategoryTypes } = useQuery({
    ...classificationQueries.list('EXPENSE_CATEGORY'),
    enabled: isEnabled && hasCategories,
  });
  const choices = {
    moneyAccountTypes,
    expenseCategoryTypes,
    accountKinds: dictionaries?.account_kinds,
    legacyCategoryTypes: dictionaries?.category_types,
    categoryPurposes: dictionaries?.category_purposes ?? undefined,
  };
  return choices;
}
