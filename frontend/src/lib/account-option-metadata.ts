import { isMoneyAccountKind } from './account-kinds';
import type { components } from './api-schema';
import { readClassificationLabel } from './classification-label';

type Account = components['schemas']['Account'];
type Classification = components['schemas']['Classification'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type AccountOptionChoices = Readonly<{
  moneyAccountTypes?: readonly Classification[] | undefined;
  expenseCategoryTypes?: readonly Classification[] | undefined;
  categoryPurposes?: readonly DictionaryItem[] | undefined;
}>;

const INCOME_SOURCE_TEXT = 'Income source';

type AccountOptionMetadata = Readonly<{
  type: string | undefined;
  detail: string | undefined;
  isHighlighted: boolean;
}>;

export function readAccountOptionMetadata({
  account,
  choices,
}: Readonly<{
  account: Readonly<Account>;
  choices: AccountOptionChoices | undefined;
}>): AccountOptionMetadata {
  const { classification_id, kind, category_purpose, currency } = account;
  if (kind === 'EXPENSE') {
    const purpose = category_purpose ?? 'PERSONAL';
    return {
      type: readClassificationLabel({
        classifications: choices?.expenseCategoryTypes,
        classificationId: classification_id,
      }),
      detail: choices?.categoryPurposes?.find(({ key }) => key === purpose)?.label,
      isHighlighted: purpose === 'INCOME_COST',
    };
  }

  if (isMoneyAccountKind(kind)) {
    return {
      type: readClassificationLabel({
        classifications: choices?.moneyAccountTypes,
        classificationId: classification_id,
      }),
      detail: currency ?? undefined,
      isHighlighted: false,
    };
  }

  return { type: undefined, detail: undefined, isHighlighted: false };
}

export function joinAccountOptionLabels(labels: readonly (string | undefined)[]): string {
  const text = labels.filter((label) => label !== undefined && label !== '').join(' · ');
  return text;
}

export function readAccountMetaText({
  account,
  choices,
}: Readonly<{
  account: Readonly<Account>;
  choices: AccountOptionChoices | undefined;
}>): string {
  if (account.kind === 'INCOME') {
    return INCOME_SOURCE_TEXT;
  }

  const metadata = readAccountOptionMetadata({ account, choices });
  const metaText = joinAccountOptionLabels([metadata.type, metadata.detail]);
  return metaText;
}
