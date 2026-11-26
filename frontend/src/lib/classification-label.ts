import type { components } from './api-schema';

type Classification = components['schemas']['Classification'];

export function readClassificationLabel({
  classifications,
  classificationId,
  legacyLabel,
}: Readonly<{
  classifications: readonly Classification[] | undefined;
  classificationId: string | null | undefined;
  legacyLabel?: string | undefined;
}>): string | undefined {
  if (classifications === undefined || classifications.length < 2) {
    return undefined;
  }

  const name =
    classificationId == null
      ? legacyLabel
      : classifications.find((classification) => classification.id === classificationId)?.name;
  return name;
}
