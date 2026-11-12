import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { readAccountSearch, writeAccountSearch } from '@/features/accounts/api/account-search';
import {
  readCatalogFilters,
  readCategoryTypeOptions,
  writeCatalogFilters,
} from '@/features/accounts/api/catalog-filters';
import { CatalogFilters } from '@/features/accounts/components/catalog-filters';
import { readCategoryGroups } from '@/features/accounts/components/catalog-grouping';
import { CatalogList } from '@/features/accounts/components/catalog-list';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './categories.module.css';

const CATEGORY_SEARCH_FIELD_ID = 'category-search';

function readCategoryCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const categoryCount =
    total === undefined
      ? undefined
      : { value: total, label: total === 1 ? 'category' : 'categories' };
  return categoryCount;
}

export function Component() {
  const [isCreating, setIsCreating] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = readAccountSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const categoryTypes =
    dictionaries === undefined ? undefined : readCategoryTypeOptions(dictionaries.category_types);
  const filters =
    categoryTypes === undefined ? undefined : readCatalogFilters({ searchParams, categoryTypes });
  const { data: activeCategoryPage } = useQuery({
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: ['EXPENSE'], order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
  const { data: categoryPage } = useQuery({
    ...accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: ['EXPENSE'],
      order: 'recent_use',
      statuses: filters?.isDeletedShown === false ? ['ACTIVE'] : ['ACTIVE', 'DELETED'],
      ...(searchTerm !== undefined && { search_term: searchTerm }),
      ...(filters?.categoryType !== undefined && { category_types: [filters.categoryType] }),
    }),
    enabled: filters !== undefined,
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && categoryPage?.items.length === 0;

  function closeForm() {
    setIsCreating(false);
  }

  return (
    <Page title="Categories" count={readCategoryCount(activeCategoryPage?.total)}>
      <div className={styles['controls']}>
        <div className={styles['actions']}>
          <SearchField
            key={searchField.fieldKey}
            id={CATEGORY_SEARCH_FIELD_ID}
            label="Search categories"
            term={search}
            isFocusedOnMount={searchField.isFocusedOnMount}
            onSearch={(nextSearch) => {
              setSearchParams(writeAccountSearch({ searchParams, search: nextSearch }), {
                replace: true,
                state: TYPED_SEARCH_STATE,
              });
            }}
          />
          <NewButton
            entityName="category"
            isDisabled={categoryTypes === undefined}
            onClick={() => {
              setIsCreating(true);
            }}
          />
        </div>
        {categoryTypes !== undefined && filters !== undefined && (
          <CatalogFilters
            categoryTypes={categoryTypes}
            filters={filters}
            onChange={(nextFilters) => {
              setSearchParams(writeCatalogFilters({ searchParams, filters: nextFilters }), {
                replace: true,
              });
            }}
          />
        )}
      </div>
      <div className={styles['categories']}>
        {isNothingMatched ? (
          <NoMatchingAccounts
            entityNames="categories"
            onClear={() => {
              searchField.focusAfterClear();
              setSearchParams(writeAccountSearch({ searchParams, search: '' }), { replace: true });
            }}
          />
        ) : (
          <CatalogList
            label="Categories"
            groups={
              categoryPage === undefined || categoryTypes === undefined
                ? undefined
                : readCategoryGroups({ categories: categoryPage.items, categoryTypes })
            }
          />
        )}
      </div>
      {isCreating && categoryTypes !== undefined && dictionaries !== undefined && (
        <Sheet label="New category" onClose={closeForm}>
          <CategoryForm
            name=""
            categoryTypes={dictionaries.category_types}
            onCreated={closeForm}
            onBack={closeForm}
          />
        </Sheet>
      )}
    </Page>
  );
}
