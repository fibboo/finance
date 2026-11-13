import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type To, useSearchParams } from 'react-router';

import { CatalogTransactions } from '@/app/catalog-transactions';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import { accountMutations } from '@/features/accounts/api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import { readAccountSearch, writeAccountSearch } from '@/features/accounts/api/account-search';
import {
  readCatalogDeleteButtonId,
  readNeighbourCatalogRowLinkId,
} from '@/features/accounts/api/catalog-row-focus';
import {
  readCatalogFilters,
  readCategoryTypeOptions,
  writeCatalogFilters,
} from '@/features/accounts/api/catalog-filters';
import { CatalogFilters } from '@/features/accounts/components/catalog-filters';
import { readSelectedAccountId } from '@/features/accounts/api/selected-account';
import { readCategoryGroups } from '@/features/accounts/components/catalog-grouping';
import { CatalogList } from '@/features/accounts/components/catalog-list';
import { CatalogRowActions } from '@/features/accounts/components/catalog-row-actions';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { NoMatchingAccounts } from '@/features/accounts/components/no-matching-accounts';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './categories.module.css';

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

function readCategoryTransactionsLink(categoryId: string): To {
  const transactionsLink = {
    pathname: '/transactions',
    search: writeTransactionFilters({
      transaction_types: [],
      account_ids: [],
      category_ids: [categoryId],
      income_source_ids: [],
    }).toString(),
  };
  return transactionsLink;
}

export function Component() {
  const isDesktop = useIsDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [editedCategoryId, setEditedCategoryId] = useState<string | undefined>(undefined);
  const [confirmedCategoryId, setConfirmedCategoryId] = useState<string | undefined>(undefined);
  const [renamedCategoryId, setRenamedCategoryId] = useState<string | undefined>(undefined);
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | undefined>(undefined);
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
  const editedCategory = categoryPage?.items.find((category) => category.id === editedCategoryId);
  const confirmedCategory = categoryPage?.items.find(
    (category) => category.id === confirmedCategoryId,
  );
  const renamedCategory = categoryPage?.items.find((category) => category.id === renamedCategoryId);
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
        <div className={styles['list']}>
          {isNothingMatched ? (
            <NoMatchingAccounts
              entityNames="categories"
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(writeAccountSearch({ searchParams, search: '' }), {
                  replace: true,
                });
              }}
            />
          ) : (
            <CatalogList
              label="Categories"
              groups={groups}
              selection={
                isDesktop
                  ? { chosenEntryId: chosenCategory?.id, defaultEntryId: shownCategory?.id }
                  : undefined
              }
              renderActions={(category) => (
                <CatalogRowActions
                  entry={category}
                  transactionsLink={readCategoryTransactionsLink(category.id)}
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
            transactionsLink={readCategoryTransactionsLink(shownCategory.id)}
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
            category={renamedCategory}
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
          title="Delete this category?"
          text={`${confirmedCategory.name}. It leaves your categories and the pickers, and its past transactions keep showing it.`}
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
