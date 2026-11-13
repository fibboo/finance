import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { CATALOG_FULL_MENU_MIN_WIDTH, CatalogTransactions } from '@/app/catalog-transactions';
import { CATEGORY_ICON_PATH } from '@/app/category-icon';
import { readTransactionsLink } from '@/app/transactions-link';
import { readCatalogInitial } from '@/components/catalog-list/catalog-entry';
import { CatalogFilters } from '@/components/catalog-list/catalog-filters';
import { CatalogList } from '@/components/catalog-list/catalog-list';
import { CatalogRowActions } from '@/components/catalog-list/catalog-row-actions';
import {
  readCatalogDeleteButtonId,
  readNeighbourCatalogRowLinkId,
} from '@/components/catalog-list/catalog-row-focus';
import { readCatalogSearch, writeCatalogSearch } from '@/components/catalog-list/catalog-search';
import { readIsDeletedShown, writeIsDeletedShown } from '@/components/catalog-list/deleted-filter';
import { NoEntries } from '@/components/catalog-list/no-entries';
import { NoMatchingEntries } from '@/components/catalog-list/no-matching-entries';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { accountMutations } from '@/features/accounts/api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import {
  readCategoryTypeFilter,
  readCategoryTypeOptions,
  writeCategoryTypeFilter,
} from '@/features/accounts/api/category-type-filter';
import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import { readCatalogDeleteCopy } from '@/features/accounts/components/catalog-delete-copy';
import { readCategoryGroups } from '@/features/accounts/components/catalog-grouping';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useListedEntry } from '@/hooks/use-listed-entry';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './categories.module.css';

export const handle = { fullMenuMinWidth: CATALOG_FULL_MENU_MIN_WIDTH };

const CATEGORY_SEARCH_FIELD_ID = 'category-search';
const DESCRIPTION_SEPARATOR = ' · ';

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
  const isDesktop = useIsDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const listSearchParams = writeSelectedTransaction({ searchParams, transactionId: undefined });
  const search = readCatalogSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const categoryTypes =
    dictionaries === undefined ? undefined : readCategoryTypeOptions(dictionaries.category_types);
  const categoryType =
    categoryTypes === undefined
      ? undefined
      : readCategoryTypeFilter({ searchParams, categoryTypes });
  const isDeletedShown = readIsDeletedShown({ searchParams, page: 'categories' });
  const { data: activeCategoryPage } = useQuery({
    ...accountQueries.list({ size: ACCOUNT_PAGE_SIZE, kinds: ['EXPENSE'], order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
  const { data: categoryPage } = useQuery({
    ...accountQueries.list({
      size: ACCOUNT_PAGE_SIZE,
      kinds: ['EXPENSE'],
      order: 'recent_use',
      statuses: isDeletedShown ? ['ACTIVE', 'DELETED'] : ['ACTIVE'],
      ...(searchTerm !== undefined && { search_term: searchTerm }),
      ...(categoryType !== undefined && { category_types: [categoryType] }),
    }),
    enabled: categoryTypes !== undefined,
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && categoryPage?.items.length === 0;
  const hasNoEntries = searchTerm === undefined && categoryPage?.items.length === 0;
  const groups =
    categoryPage === undefined || categoryTypes === undefined || isNothingMatched
      ? undefined
      : readCategoryGroups({ categories: categoryPage.items, categoryTypes });
  const selectedCategoryId = readSelectedAccountId(searchParams);
  const chosenGroup = groups?.find((group) =>
    group.entries.some((category) => category.id === selectedCategoryId),
  );
  const chosenCategory = chosenGroup?.entries.find(
    (category) => category.id === selectedCategoryId,
  );
  const shownGroup = chosenGroup ?? groups?.[0];
  const shownCategory = chosenCategory ?? shownGroup?.entries[0];
  const [editedCategory, setEditedCategoryId] = useListedEntry(categoryPage?.items);
  const [confirmedCategory, setConfirmedCategoryId] = useListedEntry(categoryPage?.items);
  const [renamedCategory, setRenamedCategoryId] = useListedEntry(
    categoryPage?.items.filter((category) => category.status === 'DELETED'),
  );
  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];
  const categoryDelete = useMutation(accountMutations.delete(relatedQueryKeys));
  const categoryRestore = useMutation(accountMutations.restore(relatedQueryKeys));

  function closeForm() {
    setIsCreating(false);
  }

  function closeEditForm() {
    setEditedCategoryId(undefined);
  }

  function closeRestoreForm() {
    setRenamedCategoryId(undefined);
  }

  function closeConfirmation(categoryId: string) {
    setConfirmedCategoryId(undefined);
    document.getElementById(readCatalogDeleteButtonId(categoryId))?.focus();
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
              setSearchParams(
                writeCatalogSearch({ searchParams: listSearchParams, search: nextSearch }),
                {
                  replace: true,
                  state: TYPED_SEARCH_STATE,
                },
              );
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
        {categoryTypes !== undefined && (
          <CatalogFilters
            segment={{
              legend: 'Category type',
              options: categoryTypes,
              chosenKey: categoryType,
              onChoose: (nextCategoryType) => {
                setSearchParams(
                  writeCategoryTypeFilter({
                    searchParams: listSearchParams,
                    categoryType: nextCategoryType,
                  }),
                  { replace: true },
                );
              },
            }}
            isDeletedShown={isDeletedShown}
            onDeletedShownChange={(nextIsDeletedShown) => {
              setSearchParams(
                writeIsDeletedShown({
                  searchParams: listSearchParams,
                  page: 'categories',
                  isDeletedShown: nextIsDeletedShown,
                }),
                { replace: true },
              );
            }}
          />
        )}
      </div>
      <div className={styles['categories']}>
        <div className={styles['list']}>
          {isNothingMatched ? (
            <NoMatchingEntries
              entityNames="categories"
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(
                  writeCatalogSearch({ searchParams: listSearchParams, search: '' }),
                  {
                    replace: true,
                  },
                );
              }}
            />
          ) : hasNoEntries ? (
            <NoEntries
              iconPath={CATEGORY_ICON_PATH}
              title="No categories yet"
              text="Add what you spend on, like groceries or rent."
            />
          ) : (
            <CatalogList
              label="Categories"
              groups={groups}
              selection={
                isDesktop
                  ? {
                      chosenEntryId: chosenCategory?.id,
                      defaultEntryId: shownCategory?.id,
                      readEntryLink: (categoryId) => ({
                        search: writeSelectedAccount({
                          searchParams: listSearchParams,
                          accountId: categoryId,
                        }).toString(),
                      }),
                      readEntryLinkId: readAccountLinkId,
                    }
                  : undefined
              }
              renderMark={readCatalogInitial}
              renderActions={(category) => (
                <CatalogRowActions
                  entry={category}
                  transactionsLink={isDesktop ? undefined : readTransactionsLink(category)}
                  isRestorePending={categoryRestore.isPending}
                  isFocusRequested={category.id === focusedCategoryId}
                  onFocused={() => {
                    setFocusedCategoryId(undefined);
                  }}
                  onEdit={() => {
                    setEditedCategoryId(category.id);
                  }}
                  onDelete={() => {
                    setConfirmedCategoryId(category.id);
                  }}
                  onRestore={() => {
                    categoryRestore.mutate(
                      { account_id: category.id },
                      {
                        onSuccess: () => {
                          setFocusedCategoryId(category.id);
                        },
                        onError: (error) => {
                          if (
                            error instanceof ApiError &&
                            error.error_code === 'NAME_ALREADY_EXISTS'
                          ) {
                            setRenamedCategoryId(category.id);
                          }
                        },
                      },
                    );
                  }}
                />
              )}
            />
          )}
        </div>
        {isDesktop && shownGroup !== undefined && shownCategory !== undefined && (
          <CatalogTransactions
            key={shownCategory.id}
            name={shownCategory.name}
            description={['Category', shownGroup.heading, 'recent transactions'].join(
              DESCRIPTION_SEPARATOR,
            )}
            emptyText="No transactions in this category yet"
            filterQuery={{ account_ids: [shownCategory.id] }}
            transactionsLink={readTransactionsLink(shownCategory)}
            transactionTypes={dictionaries?.transaction_types}
          />
        )}
      </div>
      {isCreating && dictionaries !== undefined && (
        <Sheet label="New category" onClose={closeForm}>
          <CategoryForm
            mode={{ kind: 'create', name: '', onCreated: closeForm }}
            categoryTypes={dictionaries.category_types}
            onBack={closeForm}
          />
        </Sheet>
      )}
      {editedCategory !== undefined && dictionaries !== undefined && (
        <Sheet label="Edit category" onClose={closeEditForm}>
          <CategoryForm
            mode={{
              kind: 'edit',
              category: editedCategory,
              relatedQueryKeys,
              onSaved: () => {
                setEditedCategoryId((openCategoryId) =>
                  openCategoryId === editedCategory.id ? undefined : openCategoryId,
                );
              },
            }}
            categoryTypes={dictionaries.category_types}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
      {renamedCategory !== undefined && (
        <Sheet label="Restore category" onClose={closeRestoreForm}>
          <RestoreForm
            account={renamedCategory}
            entityName="category"
            relatedQueryKeys={relatedQueryKeys}
            onRestored={() => {
              closeRestoreForm();
              setFocusedCategoryId(renamedCategory.id);
            }}
            onBack={closeRestoreForm}
          />
        </Sheet>
      )}
      {confirmedCategory !== undefined && (
        <DeleteConfirmation
          title={readCatalogDeleteCopy(confirmedCategory).title}
          text={readCatalogDeleteCopy(confirmedCategory).text}
          isPending={categoryDelete.isPending}
          onCancel={() => {
            closeConfirmation(confirmedCategory.id);
          }}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourCatalogRowLinkId(confirmedCategory.id);
            categoryDelete.mutate(confirmedCategory.id, {
              onSuccess: () => {
                setConfirmedCategoryId(undefined);
                document.getElementById(neighbourLinkId ?? CATEGORY_SEARCH_FIELD_ID)?.focus();
              },
              onError: () => {
                closeConfirmation(confirmedCategory.id);
                setFocusedCategoryId(confirmedCategory.id);
              },
            });
          }}
        />
      )}
    </Page>
  );
}
