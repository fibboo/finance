import { z } from 'zod';

import { categoryTypeValues, type components } from '@/lib/api-schema';

type CategoryType = components['schemas']['CategoryType'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const CATEGORY_TYPE_PARAM = 'category_type';

export type CategoryTypeOption = Readonly<{ key: CategoryType; label: string }>;

export function readCategoryTypeOptions(
  categoryTypes: readonly DictionaryItem[],
): readonly CategoryTypeOption[] {
  const options = categoryTypes.flatMap((item) => {
    const key = categoryTypeValues.find((type) => type === item.key);
    return key === undefined ? [] : [{ key, label: item.label }];
  });
  return options;
}

export function readCategoryTypeFilter({
  searchParams,
  categoryTypes,
}: Readonly<{
  searchParams: URLSearchParams;
  categoryTypes: readonly CategoryTypeOption[];
}>): CategoryType | undefined {
  const categoryType = z
    .string()
    .nullable()
    .transform((value) => categoryTypes.find((type) => type.key === value)?.key)
    .parse(searchParams.get(CATEGORY_TYPE_PARAM));
  return categoryType;
}

export function writeCategoryTypeFilter({
  searchParams,
  categoryType,
}: Readonly<{
  searchParams: URLSearchParams;
  categoryType: CategoryType | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (categoryType === undefined) {
    nextSearchParams.delete(CATEGORY_TYPE_PARAM);
  } else {
    nextSearchParams.set(CATEGORY_TYPE_PARAM, categoryType);
  }

  return nextSearchParams;
}
