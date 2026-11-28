import type { components } from './api-schema';

type Classification = components['schemas']['Classification'];

export function readClassificationLabel({
  classifications,
  classificationId,
}: Readonly<{
  classifications: readonly Classification[] | undefined;
  classificationId: string | null | undefined;
}>): string | undefined {
  if (classifications === undefined || classifications.length < 2) {
    return undefined;
  }

  const name = classifications.find(
    (classification) => classification.id === classificationId,
  )?.name;
  return name;
}
