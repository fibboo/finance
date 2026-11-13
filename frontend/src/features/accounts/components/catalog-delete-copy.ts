import type { components } from '@/lib/api-schema';

type Account = components['schemas']['Account'];

export type DeleteCopy = Readonly<{ label: string; title: string; text: string }>;

const ENTITY_NAMES_BY_KIND = {
  EXPENSE: { entityName: 'category', entityNames: 'categories' },
  INCOME: { entityName: 'income source', entityNames: 'income sources' },
} as const;

export function readCatalogDeleteCopy(
  account: Readonly<Pick<Account, 'kind' | 'name'>>,
): DeleteCopy {
  if (account.kind !== 'EXPENSE' && account.kind !== 'INCOME') {
    throw new Error(`The account kind ${account.kind} is not a catalog entry.`);
  }

  const { entityName, entityNames } = ENTITY_NAMES_BY_KIND[account.kind];
  const deleteCopy = {
    label: `Delete ${entityName}`,
    title: `Delete this ${entityName}?`,
    text: `${account.name}. It leaves your ${entityNames} and the pickers, and its past transactions keep showing it.`,
  };
  return deleteCopy;
}
