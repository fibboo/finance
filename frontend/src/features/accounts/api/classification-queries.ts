import { mutationOptions, queryOptions, type QueryClient } from '@tanstack/react-query';

import { apiClient, readData } from '@/lib/api-client';
import type { components } from '@/lib/api-schema';

import { accountQueries } from './account-queries';

export type Classification = components['schemas']['Classification'];
export type ClassificationKind = components['schemas']['ClassificationKind'];
type ClassificationName = components['schemas']['ClassificationNameRequest'];

type ClassificationPath = Readonly<{ kind: ClassificationKind; classification_id: string }>;

async function fetchClassifications(kind: ClassificationKind): Promise<Classification[]> {
  const classifications = readData(
    await apiClient.GET('/accounting/classifications/{kind}', { params: { path: { kind } } }),
  );
  return classifications;
}

async function createClassification({
  kind,
  ...body
}: Readonly<ClassificationName & { kind: ClassificationKind }>): Promise<Classification> {
  const classification = readData(
    await apiClient.POST('/accounting/classifications/{kind}', {
      params: { path: { kind } },
      body,
    }),
  );
  return classification;
}

async function renameClassification({
  name,
  ...path
}: Readonly<ClassificationName & ClassificationPath>): Promise<Classification> {
  const classification = readData(
    await apiClient.PUT('/accounting/classifications/{kind}/{classification_id}', {
      params: { path },
      body: { name },
    }),
  );
  return classification;
}

async function deleteClassification({
  replacement_id,
  ...path
}: Readonly<ClassificationPath & { replacement_id: string | undefined }>): Promise<void> {
  await apiClient.DELETE('/accounting/classifications/{kind}/{classification_id}', {
    params: { path, query: replacement_id === undefined ? {} : { replacement_id } },
  });
}

export const classificationQueries = {
  list(kind: ClassificationKind) {
    return queryOptions({
      queryKey: ['classifications', kind] as const,
      queryFn: () => fetchClassifications(kind),
    });
  },
};

export const classificationMutations = {
  create(kind: ClassificationKind) {
    return mutationOptions({
      mutationFn: (body: Readonly<ClassificationName>) => createClassification({ kind, ...body }),
      onSuccess: (_classification, _body, _result, { client }) =>
        invalidateClassifications({ client, kind }),
    });
  },
  rename(kind: ClassificationKind) {
    return mutationOptions({
      mutationFn: (body: Readonly<ClassificationName & { classification_id: string }>) =>
        renameClassification({ kind, ...body }),
      onSuccess: (_classification, _body, _result, { client }) =>
        invalidateClassifications({ client, kind }),
    });
  },
  delete(kind: ClassificationKind) {
    return mutationOptions({
      mutationFn: (body: Readonly<Omit<Parameters<typeof deleteClassification>[0], 'kind'>>) =>
        deleteClassification({ kind, ...body }),
      onSuccess: (_classification, _body, _result, { client }) =>
        Promise.all([
          invalidateClassifications({ client, kind }),
          client.invalidateQueries({ queryKey: accountQueries.all().queryKey }),
        ]),
    });
  },
};

function invalidateClassifications({
  client,
  kind,
}: Readonly<{ client: QueryClient; kind: ClassificationKind }>): Promise<void> {
  const invalidation = client.invalidateQueries({
    queryKey: classificationQueries.list(kind).queryKey,
  });
  return invalidation;
}

export function readClassificationLabel({
  classifications,
  classificationId,
}: Readonly<{
  classifications: readonly Classification[] | undefined;
  classificationId: string | null | undefined;
}>): string | undefined {
  const name =
    classifications !== undefined && classifications.length > 1
      ? classifications.find((classification) => classification.id === classificationId)?.name
      : undefined;
  return name;
}

export function readStartingClassificationId({
  classifications,
  classificationId,
}: Readonly<{
  classifications: readonly Classification[] | undefined;
  classificationId: string | null | undefined;
}>): string {
  if (classifications?.length === 1) {
    return classifications[0]?.id ?? '';
  }

  const startingId =
    classificationId ??
    classifications?.find((classification) => classification.is_default)?.id ??
    '';
  return startingId;
}
