import type { CatalogGroup } from '@/components/catalog-list/catalog-entry';
import type { components } from '@/lib/api-schema';

import type { CategoryTypeOption } from '../api/category-type-filter';

type Account = components['schemas']['Account'];

export function readCategoryGroups({
  categories,
  categoryTypes,
}: Readonly<{
  categories: readonly Account[];
  categoryTypes: readonly CategoryTypeOption[];
}>): readonly CatalogGroup<Account>[] {
  const groups = categoryTypes
    .map((type) => ({
      key: type.key,
      heading: type.label,
      entries: categories.filter((category) => category.category_type === type.key),
    }))
    .filter((group) => group.entries.length > 0);
  return groups;
}
