import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  CATALOG_DESCRIPTION_SEPARATOR,
  CATALOG_FULL_MENU_MIN_WIDTH,
  CatalogTransactions,
} from '@/app/catalog-transactions';
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
import {
  readIsDeletedShown,
  storeIsDeletedShown,
  useStoredIsDeletedShown,
  writeIsDeletedShown,
} from '@/components/catalog-list/deleted-filter';
import { NoEntries } from '@/components/catalog-list/no-entries';
import { NoMatchingEntries } from '@/components/catalog-list/no-matching-entries';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { NewButton } from '@/components/new-button/new-button';
import { Page } from '@/components/page/page';
import { SearchField } from '@/components/search-field/search-field';
import { Sheet } from '@/components/sheet/sheet';
import {
  readCategoryPurposeOptions,
  readCategoryPurposeFilter,
  writeCategoryPurposeFilter,
} from '@/features/accounts/api/category-purpose-filter';
import { accountMutations } from '@/features/accounts/api/account-mutations';
import { ACCOUNT_PAGE_SIZE, accountQueries } from '@/features/accounts/api/account-queries';
import {
  readClassificationFilter,
  readLegacyCategoryType,
  writeClassificationFilter,
} from '@/features/accounts/api/category-type-filter';
import { classificationQueries } from '@/features/accounts/api/classification-queries';
import {
  readAccountLinkId,
  readSelectedAccountId,
  writeSelectedAccount,
} from '@/features/accounts/api/selected-account';
import { readCatalogDeleteCopy } from '@/features/accounts/components/catalog-delete-copy';
import { CategoryForm } from '@/features/accounts/components/category-form';
import { ClassificationSettings } from '@/features/accounts/components/classification-settings';
import { RestoreForm } from '@/features/accounts/components/restore-form';
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { summaryQueries } from '@/features/summary/api/summary-queries';
import { writeSelectedTransaction } from '@/features/transactions/api/selected-transaction';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useListedEntry } from '@/hooks/use-listed-entry';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { readClassificationLabel } from '@/lib/classification-label';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './categories.module.css';

export const handle = { fullMenuMinWidth: CATALOG_FULL_MENU_MIN_WIDTH };

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
  const { data: classifications } = useQuery(classificationQueries.list('EXPENSE_CATEGORY'));
  const classificationId = readClassificationFilter({
    searchParams,
    param: 'category_type',
    classifications,
  });
  const legacyCategoryType = readLegacyCategoryType(searchParams);
  const legacyCategoryTypeLabel =
    dictionaries?.category_types.find(({ key }) => key === legacyCategoryType)?.label ??
    legacyCategoryType;
  const categoryPurposes =
    dictionaries === undefined
      ? undefined
      : readCategoryPurposeOptions(dictionaries.category_purposes ?? []);
  const categoryPurpose =
    categoryPurposes === undefined
      ? undefined
      : readCategoryPurposeFilter({ searchParams, categoryPurposes });
  const isStoredDeletedShown = useStoredIsDeletedShown('categories');
  const isDeletedShown = readIsDeletedShown({ searchParams, isStoredDeletedShown });
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
      ...(legacyCategoryType !== undefined && { category_types: [legacyCategoryType] }),
      ...(classificationId !== undefined && { classification_ids: [classificationId] }),
      ...(categoryPurpose !== undefined && { category_purposes: [categoryPurpose] }),
    }),
    throwOnError: isThrownWithoutData,
  });
  const isFiltered =
    classificationId !== undefined ||
    legacyCategoryType !== undefined ||
    categoryPurpose !== undefined;
  const isNothingMatched =
    (searchTerm !== undefined || isFiltered) && categoryPage?.items.length === 0;
  const hasNoEntries = searchTerm === undefined && !isFiltered && categoryPage?.items.length === 0;
  const entries = categoryPage?.items;
  const groups =
    entries === undefined ? undefined : [{ key: 'categories', heading: undefined, entries }];
  const selectedCategoryId = readSelectedAccountId(searchParams);
  const chosenCategory = entries?.find((category) => category.id === selectedCategoryId);
  const shownCategory = chosenCategory ?? entries?.[0];
  const [editedCategory, setEditedCategoryId] = useListedEntry(categoryPage?.items);
  const [confirmedCategory, setConfirmedCategoryId] = useListedEntry(categoryPage?.items);
  const [renamedCategory, setRenamedCategoryId] = useListedEntry(
    categoryPage?.items.filter((category) => category.status === 'DELETED'),
  );
  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
    summaryQueries.current().queryKey,
  ];
  const categoryDelete = useMutation(accountMutations.delete(relatedQueryKeys));
  const categoryRestore = useMutation(accountMutations.restore(relatedQueryKeys));

  function chooseClassification(nextClassificationId: string | undefined) {
    setSearchParams(
      writeClassificationFilter({
        searchParams: listSearchParams,
        param: 'category_type',
        classificationId: nextClassificationId,
      }),
      { replace: true },
    );
  }

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
    <Page
      title="Categories"
      count={readCategoryCount(activeCategoryPage?.total)}
      actions={
        <>
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
            isDisabled={dictionaries === undefined}
            onClick={() => {
              setIsCreating(true);
            }}
          />
          <ClassificationSettings kind="EXPENSE_CATEGORY" />
        </>
      }
    >
      <div className={styles['categories']}>
        <div className={styles['list']}>
          <CatalogFilters
            segment={
              classifications !== undefined && classifications.length > 1
                ? {
                    kind: 'shown',
                    legend: 'Category type',
                    options: classifications.map(({ id, name }) => ({ key: id, label: name })),
                    chosenKey: classificationId ?? legacyCategoryType,
                    onChoose: chooseClassification,
                  }
                : undefined
            }
            isDeletedShown={isDeletedShown}
            onDeletedShownChange={(nextIsDeletedShown) => {
              setSearchParams(
                writeIsDeletedShown({
                  searchParams: listSearchParams,
                  isStoredDeletedShown,
                  isDeletedShown: nextIsDeletedShown,
                }),
                { replace: true },
              );
              storeIsDeletedShown({ page: 'categories', isDeletedShown: nextIsDeletedShown });
            }}
          >
            {categoryPurposes !== undefined && (
              <fieldset className={styles['purposeFilter']}>
                <legend className="visually-hidden">Category purpose</legend>
                <div className={styles['purposeOptions']}>
                  {[{ key: undefined, label: 'All' }, ...categoryPurposes].map((option) => (
                    <label key={option.key ?? 'ALL'} className={styles['purposeOption']}>
                      <input
                        type="radio"
                        name="category_purpose"
                        checked={categoryPurpose === option.key}
                        onChange={() => {
                          setSearchParams(
                            writeCategoryPurposeFilter({
                              searchParams: listSearchParams,
                              categoryPurpose: option.key,
                            }),
                            { replace: true },
                          );
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {legacyCategoryTypeLabel !== undefined && (
              <button
                type="button"
                className={styles['legacyType']}
                aria-label={`Clear legacy type filter: ${legacyCategoryTypeLabel}`}
                onClick={() => {
                  document.getElementById(CATEGORY_SEARCH_FIELD_ID)?.focus();
                  chooseClassification(undefined);
                }}
              >
                Type: {legacyCategoryTypeLabel} <span aria-hidden="true">×</span>
              </button>
            )}
          </CatalogFilters>
          {isNothingMatched ? (
            <NoMatchingEntries
              entityNames="categories"
              isFiltered={isFiltered}
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(
                  writeCategoryPurposeFilter({
                    searchParams: writeClassificationFilter({
                      searchParams: writeCatalogSearch({
                        searchParams: listSearchParams,
                        search: '',
                      }),
                      param: 'category_type',
                      classificationId: undefined,
                    }),
                    categoryPurpose: undefined,
                  }),
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
              readTransactionsLink={readTransactionsLink}
              renderMark={readCatalogInitial}
              isDescriptionInline
              renderMetadata={(category) => {
                const label = readClassificationLabel({
                  classifications,
                  classificationId: category.classification_id,
                });
                const purpose = category.category_purpose ?? 'PERSONAL';
                const purposeLabel = categoryPurposes?.find(({ key }) => key === purpose)?.label;
                return (
                  <span className={styles['metadata']}>
                    {label}
                    {label !== undefined &&
                      purposeLabel !== undefined &&
                      CATALOG_DESCRIPTION_SEPARATOR}
                    <span
                      className={purpose === 'INCOME_COST' ? styles['purposeBadge'] : undefined}
                    >
                      {purposeLabel}
                    </span>
                  </span>
                );
              }}
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
        {isDesktop && (shownCategory !== undefined || groups === undefined) && (
          <CatalogTransactions
            entryFeed={
              shownCategory === undefined
                ? undefined
                : {
                    name: shownCategory.name,
                    description: [
                      'Category',
                      readClassificationLabel({
                        classifications,
                        classificationId: shownCategory.classification_id,
                      }),
                      'recent transactions',
                    ]
                      .filter((part) => part !== undefined)
                      .join(CATALOG_DESCRIPTION_SEPARATOR),
                    filterQuery: { account_ids: [shownCategory.id] },
                    transactionsLink: readTransactionsLink(shownCategory),
                  }
            }
            emptyText="No transactions in this category yet"
            transactionTypes={dictionaries?.transaction_types}
          />
        )}
      </div>
      {isCreating && dictionaries !== undefined && (
        <Sheet label="New category" onClose={closeForm}>
          <CategoryForm
            mode={{ kind: 'create', name: '', onCreated: closeForm }}
            categoryPurposes={dictionaries.category_purposes ?? []}
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
            categoryPurposes={dictionaries.category_purposes ?? []}
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
