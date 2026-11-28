import type { EntityPickerItem } from '@/components/entity-picker/entity-picker';
import { readMoneyAccountColor } from '@/lib/account-colors';
import {
  type AccountOptionChoices,
  joinAccountOptionLabels,
  readAccountOptionMetadata,
} from '@/lib/account-option-metadata';
import type { components } from '@/lib/api-schema';

type Account = components['schemas']['Account'];

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
    description: account.description?.trim(),
    note: joinAccountOptionLabels([
      metadata.type,
      metadata.isHighlighted ? undefined : metadata.detail,
    ]),
    highlightedNote: metadata.isHighlighted ? metadata.detail : undefined,
  };
  return item;
}
