import { useQuery } from '@tanstack/react-query';

import { classificationQueries } from '@/features/accounts/api/classification-queries';
import type { AccountOptionChoices } from '@/lib/account-option-metadata';
import type { components } from '@/lib/api-schema';
import { isThrownWithoutData } from '@/lib/query-meta';

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
    throwOnError: isThrownWithoutData,
  });
  const { data: expenseCategoryTypes } = useQuery({
    ...classificationQueries.list('EXPENSE_CATEGORY'),
    enabled: isEnabled && hasCategories,
    throwOnError: isThrownWithoutData,
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
