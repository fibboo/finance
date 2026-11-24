import { z } from 'zod';

import { categoryPurposeValues, type components } from '@/lib/api-schema';

type CategoryPurpose = components['schemas']['CategoryPurpose'];
type DictionaryItem = components['schemas']['DictionaryItem'];

const CATEGORY_PURPOSE_PARAM = 'category_purpose';

export type CategoryPurposeOption = Readonly<{ key: CategoryPurpose; label: string }>;

export function readCategoryPurposeOptions(
  categoryPurposes: readonly DictionaryItem[],
): readonly CategoryPurposeOption[] {
  const options = categoryPurposes.flatMap((item) => {
    const key = categoryPurposeValues.find((purpose) => purpose === item.key);
    return key === undefined ? [] : [{ key, label: item.label }];
  });
  return options;
}

export function readCategoryPurposeFilter({
  searchParams,
  categoryPurposes,
}: Readonly<{
  searchParams: URLSearchParams;
  categoryPurposes: readonly CategoryPurposeOption[];
}>): CategoryPurpose | undefined {
  const purpose = z
    .string()
    .nullable()
    .transform((value) => categoryPurposes.find((purpose) => purpose.key === value)?.key)
    .parse(searchParams.get(CATEGORY_PURPOSE_PARAM));
  return purpose;
}

export function writeCategoryPurposeFilter({
  searchParams,
  categoryPurpose,
}: Readonly<{
  searchParams: URLSearchParams;
  categoryPurpose: CategoryPurpose | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (categoryPurpose === undefined) {
    nextSearchParams.delete(CATEGORY_PURPOSE_PARAM);
  } else {
    nextSearchParams.set(CATEGORY_PURPOSE_PARAM, categoryPurpose);
  }

  return nextSearchParams;
}
