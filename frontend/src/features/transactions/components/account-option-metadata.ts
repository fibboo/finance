import type { EntityPickerItem } from '@/components/entity-picker/entity-picker';
import { readMoneyAccountColor } from '@/lib/account-colors';
import { isMoneyAccountKind } from '@/lib/account-kinds';
import type { components } from '@/lib/api-schema';
import { readClassificationLabel } from '@/lib/classification-label';

type Account = components['schemas']['Account'];
type Classification = components['schemas']['Classification'];
type DictionaryItem = components['schemas']['DictionaryItem'];

export type AccountOptionChoices = Readonly<{
  moneyAccountTypes?: readonly Classification[] | undefined;
  expenseCategoryTypes?: readonly Classification[] | undefined;
  accountKinds?: readonly DictionaryItem[] | undefined;
  legacyCategoryTypes?: readonly DictionaryItem[] | undefined;
  categoryPurposes?: readonly DictionaryItem[] | undefined;
}>;

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
  const { classification_id, kind, category_type, category_purpose, currency } = account;
  if (kind === 'EXPENSE') {
    const purpose = category_purpose ?? 'PERSONAL';
    return {
      type: readClassificationLabel({
        classifications: choices?.expenseCategoryTypes,
        classificationId: classification_id,
        legacyLabel: choices?.legacyCategoryTypes?.find(({ key }) => key === category_type)?.label,
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
        legacyLabel: choices?.accountKinds?.find(({ key }) => key === kind)?.label,
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

export function toAccountPickerItem({
  account,
  choices,
}: Readonly<{
  account: Readonly<Account>;
  choices: AccountOptionChoices | undefined;
}>): EntityPickerItem {
  const metadata = readAccountOptionMetadata({ account, choices });
  const item = {
    id: account.id,
    name: account.name,
    color: readMoneyAccountColor(account),
    description:
      account.kind === 'EXPENSE' || isMoneyAccountKind(account.kind)
        ? account.description?.trim()
        : undefined,
    note: joinAccountOptionLabels([
      metadata.type,
      metadata.isHighlighted ? undefined : metadata.detail,
    ]),
    highlightedNote: metadata.isHighlighted ? metadata.detail : undefined,
  };
  return item;
}
