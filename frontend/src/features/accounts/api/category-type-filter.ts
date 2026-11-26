import { z } from 'zod';

import { categoryTypeValues, type components } from '@/lib/api-schema';

import type { Classification } from './classification-queries';

type CategoryType = components['schemas']['CategoryType'];
type ClassificationFilterParam = 'account_type' | 'category_type';

export function readClassificationFilter({
  searchParams,
  param,
  classifications,
}: Readonly<{
  searchParams: URLSearchParams;
  param: ClassificationFilterParam;
  classifications: readonly Classification[] | undefined;
}>): string | undefined {
  if (classifications === undefined || classifications.length < 2) {
    return undefined;
  }

  const parsed = z.uuid().safeParse(searchParams.get(param));
  const classificationId = parsed.success
    ? classifications.find((classification) => classification.id === parsed.data)?.id
    : undefined;
  return classificationId;
}

export function readLegacyCategoryType(searchParams: URLSearchParams): CategoryType | undefined {
  const parsed = z.enum(categoryTypeValues).safeParse(searchParams.get('category_type'));
  const categoryType = parsed.success ? parsed.data : undefined;
  return categoryType;
}

export function writeClassificationFilter({
  searchParams,
  param,
  classificationId,
}: Readonly<{
  searchParams: URLSearchParams;
  param: ClassificationFilterParam;
  classificationId: string | undefined;
}>): URLSearchParams {
  const nextSearchParams = new URLSearchParams(searchParams);
  if (classificationId === undefined) {
    nextSearchParams.delete(param);
  } else {
    nextSearchParams.set(param, classificationId);
  }

  return nextSearchParams;
}
