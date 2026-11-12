import { z } from 'zod';

import { categoryTypeValues, type components } from '@/lib/api-schema';

type CategoryType = components['schemas']['CategoryType'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const CATEGORY_TYPE_PARAM = 'category_type';
const DELETED_PARAM = 'deleted';
const DELETED_OFF = 'off';

export type CategoryTypeOption = Readonly<{ key: CategoryType; label: string }>;

export type CatalogFilters = Readonly<{
  categoryType: CategoryType | undefined;
  isDeletedShown: boolean;
}>;

export function readCategoryTypeOptions(
  categoryTypes: readonly DictionaryItem[],
): readonly CategoryTypeOption[] {
  const options = categoryTypes.flatMap((item) => {
    const key = categoryTypeValues.find((type) => type === item.key);
    return key === undefined ? [] : [{ key, label: item.label }];
  });
  return options;
}

export function readCatalogFilters({
  searchParams,
  categoryTypes,
}: Readonly<{
  searchParams: URLSearchParams;
  categoryTypes: readonly CategoryTypeOption[];
}>): CatalogFilters {
  const categoryType = z
    .string()
    .nullable()
    .transform((value) => categoryTypes.find((type) => type.key === value)?.key)
    .parse(searchParams.get(CATEGORY_TYPE_PARAM));
  const filters = {
    categoryType,
    isDeletedShown: searchParams.get(DELETED_PARAM) !== DELETED_OFF,
  };
  return filters;
}

export function writeCatalogFilters({
  searchParams,
  filters,
}: Readonly<{ searchParams: URLSearchParams; filters: CatalogFilters }>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (filters.categoryType === undefined) {
    nextSearchParams.delete(CATEGORY_TYPE_PARAM);
  } else {
    nextSearchParams.set(CATEGORY_TYPE_PARAM, filters.categoryType);
  }

  if (filters.isDeletedShown) {
    nextSearchParams.delete(DELETED_PARAM);
  } else {
    nextSearchParams.set(DELETED_PARAM, DELETED_OFF);
  }

  return nextSearchParams;
}
