import { z } from 'zod';

import type { Classification } from './classification-queries';

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
