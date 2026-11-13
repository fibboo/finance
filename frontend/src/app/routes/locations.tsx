import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type To, useSearchParams } from 'react-router';

import { CatalogTransactions } from '@/app/catalog-transactions';
import { LOCATION_ICON_PATH } from '@/app/location-icon';
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
import { dictionaryQueries } from '@/features/dictionaries/api/dictionary-queries';
import { locationMutations } from '@/features/locations/api/location-mutations';
import { LOCATION_PAGE_SIZE, locationQueries } from '@/features/locations/api/location-queries';
import {
  readLocationLinkId,
  readSelectedLocationId,
  writeSelectedLocation,
} from '@/features/locations/api/selected-location';
import { LocationForm } from '@/features/locations/components/location-form';
import { LocationRestoreForm } from '@/features/locations/components/location-restore-form';
import { writeTransactionFilters } from '@/features/transactions/api/transaction-filters';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { useListedEntry } from '@/hooks/use-listed-entry';
import { TYPED_SEARCH_STATE, useSearchField } from '@/hooks/use-search-field';
import { ApiError } from '@/lib/api-error';
import { isThrownWithoutData } from '@/lib/query-meta';
import { readSearchTerm } from '@/lib/search-term';

import styles from './locations.module.css';

const LOCATION_SEARCH_FIELD_ID = 'location-search';
const LOCATION_GROUP_KEY = 'LOCATIONS';

function readLocationCount(
  total: number | undefined,
): Readonly<{ value: number; label: string }> | undefined {
  const locationCount =
    total === undefined
      ? undefined
      : { value: total, label: total === 1 ? 'location' : 'locations' };
  return locationCount;
}

function readLocationTransactionsLink(locationId: string): To {
  const transactionsLink = {
    pathname: '/transactions',
    search: writeTransactionFilters({
      transaction_types: [],
      account_ids: [],
      category_ids: [],
      income_source_ids: [],
      location_ids: [locationId],
    }).toString(),
  };
  return transactionsLink;
}

export function Component() {
  const isDesktop = useIsDesktop();
  const [isCreating, setIsCreating] = useState(false);
  const [focusedLocationId, setFocusedLocationId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const search = readCatalogSearch(searchParams);
  const searchField = useSearchField(search);
  const searchTerm = readSearchTerm(search);
  const isDeletedShown = readIsDeletedShown(searchParams);
  const { data: dictionaries } = useQuery({
    ...dictionaryQueries.accounting(),
    throwOnError: true,
  });
  const { data: activeLocationPage } = useQuery({
    ...locationQueries.list({ size: LOCATION_PAGE_SIZE, order: 'recent_use' }),
    throwOnError: isThrownWithoutData,
  });
  const { data: locationPage } = useQuery({
    ...locationQueries.list({
      size: LOCATION_PAGE_SIZE,
      order: 'recent_use',
      statuses: isDeletedShown ? ['ACTIVE', 'DELETED'] : ['ACTIVE'],
      ...(searchTerm !== undefined && { search_term: searchTerm }),
    }),
    placeholderData: keepPreviousData,
    throwOnError: isThrownWithoutData,
  });
  const isNothingMatched = searchTerm !== undefined && locationPage?.items.length === 0;
  const hasNoEntries = searchTerm === undefined && locationPage?.items.length === 0;
  const groups =
    locationPage === undefined || isNothingMatched
      ? undefined
      : [{ key: LOCATION_GROUP_KEY, heading: undefined, entries: locationPage.items }];
  const selectedLocationId = readSelectedLocationId(searchParams);
  const chosenLocation = locationPage?.items.find((location) => location.id === selectedLocationId);
  const shownLocation = chosenLocation ?? (isNothingMatched ? undefined : locationPage?.items[0]);
  const [editedLocation, setEditedLocationId] = useListedEntry(locationPage?.items);
  const [confirmedLocation, setConfirmedLocationId] = useListedEntry(locationPage?.items);
  const [renamedLocation, setRenamedLocationId] = useListedEntry(
    locationPage?.items.filter((location) => location.status === 'DELETED'),
  );
  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];
  const locationDelete = useMutation(locationMutations.delete(relatedQueryKeys));
  const locationRestore = useMutation(locationMutations.restore(relatedQueryKeys));

  function closeForm() {
    setIsCreating(false);
  }

  function closeEditForm() {
    setEditedLocationId(undefined);
  }

  function closeRestoreForm() {
    setRenamedLocationId(undefined);
  }

  function closeConfirmation(locationId: string) {
    setConfirmedLocationId(undefined);
    document.getElementById(readCatalogDeleteButtonId(locationId))?.focus();
  }

  return (
    <Page title="Locations" count={readLocationCount(activeLocationPage?.total)}>
      <div className={styles['controls']}>
        <div className={styles['actions']}>
          <SearchField
            key={searchField.fieldKey}
            id={LOCATION_SEARCH_FIELD_ID}
            label="Search locations"
            term={search}
            isFocusedOnMount={searchField.isFocusedOnMount}
            onSearch={(nextSearch) => {
              setSearchParams(writeCatalogSearch({ searchParams, search: nextSearch }), {
                replace: true,
                state: TYPED_SEARCH_STATE,
              });
            }}
          />
          <NewButton
            entityName="location"
            isDisabled={false}
            onClick={() => {
              setIsCreating(true);
            }}
          />
        </div>
        <CatalogFilters
          segment={undefined}
          isDeletedShown={isDeletedShown}
          onDeletedShownChange={(nextIsDeletedShown) => {
            setSearchParams(
              writeIsDeletedShown({ searchParams, isDeletedShown: nextIsDeletedShown }),
              { replace: true },
            );
          }}
        />
      </div>
      <div className={styles['locations']}>
        <div className={styles['list']}>
          {isNothingMatched ? (
            <NoMatchingEntries
              entityNames="locations"
              onClear={() => {
                searchField.focusAfterClear();
                setSearchParams(writeCatalogSearch({ searchParams, search: '' }), {
                  replace: true,
                });
              }}
            />
          ) : hasNoEntries ? (
            <NoEntries
              iconPath={LOCATION_ICON_PATH}
              title="No locations yet"
              text="Add the places you pay at, like a shop or a café."
            />
          ) : (
            <CatalogList
              label="Locations"
              groups={groups}
              selection={
                isDesktop
                  ? {
                      chosenEntryId: chosenLocation?.id,
                      defaultEntryId: shownLocation?.id,
                      readEntryLink: (locationId) => ({
                        search: writeSelectedLocation({ searchParams, locationId }).toString(),
                      }),
                      readEntryLinkId: readLocationLinkId,
                    }
                  : undefined
              }
              renderMark={() => (
                <svg className={styles['markIcon']} viewBox="0 0 24 24">
                  <path d={LOCATION_ICON_PATH} />
                </svg>
              )}
              renderActions={(location) => (
                <CatalogRowActions
                  entry={location}
                  transactionsLink={readLocationTransactionsLink(location.id)}
                  isRestorePending={locationRestore.isPending}
                  isFocusRequested={location.id === focusedLocationId}
                  onFocused={() => {
                    setFocusedLocationId(undefined);
                  }}
                  onEdit={() => {
                    setEditedLocationId(location.id);
                  }}
                  onDelete={() => {
                    setConfirmedLocationId(location.id);
                  }}
                  onRestore={() => {
                    locationRestore.mutate(
                      { location_id: location.id },
                      {
                        onSuccess: () => {
                          setFocusedLocationId(location.id);
                        },
                        onError: (error) => {
                          if (
                            error instanceof ApiError &&
                            error.error_code === 'NAME_ALREADY_EXISTS'
                          ) {
                            setRenamedLocationId(location.id);
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
        {isDesktop && shownLocation !== undefined && (
          <CatalogTransactions
            key={shownLocation.id}
            name={shownLocation.name}
            description="Location · recent transactions"
            emptyText="No transactions at this location yet"
            filterQuery={{ location_ids: [shownLocation.id] }}
            transactionsLink={readLocationTransactionsLink(shownLocation.id)}
            transactionTypes={dictionaries?.transaction_types}
          />
        )}
      </div>
      {isCreating && (
        <Sheet label="New location" onClose={closeForm}>
          <LocationForm
            mode={{ kind: 'create', name: '', onCreated: closeForm }}
            onBack={closeForm}
          />
        </Sheet>
      )}
      {editedLocation !== undefined && (
        <Sheet label="Edit location" onClose={closeEditForm}>
          <LocationForm
            mode={{
              kind: 'edit',
              location: editedLocation,
              relatedQueryKeys,
              onSaved: () => {
                setEditedLocationId((openLocationId) =>
                  openLocationId === editedLocation.id ? undefined : openLocationId,
                );
              },
            }}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
      {renamedLocation !== undefined && (
        <Sheet label="Restore location" onClose={closeRestoreForm}>
          <LocationRestoreForm
            location={renamedLocation}
            relatedQueryKeys={relatedQueryKeys}
            onRestored={() => {
              closeRestoreForm();
              setFocusedLocationId(renamedLocation.id);
            }}
            onBack={closeRestoreForm}
          />
        </Sheet>
      )}
      {confirmedLocation !== undefined && (
        <DeleteConfirmation
          title="Delete this location?"
          text={`${confirmedLocation.name}. It leaves your locations and the pickers, and its past transactions keep showing it.`}
          isPending={locationDelete.isPending}
          onCancel={() => {
            closeConfirmation(confirmedLocation.id);
          }}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourCatalogRowLinkId(confirmedLocation.id);
            locationDelete.mutate(confirmedLocation.id, {
              onSuccess: () => {
                setConfirmedLocationId(undefined);
                document.getElementById(neighbourLinkId ?? LOCATION_SEARCH_FIELD_ID)?.focus();
              },
              onError: () => {
                closeConfirmation(confirmedLocation.id);
                setFocusedLocationId(confirmedLocation.id);
              },
            });
          }}
        />
      )}
    </Page>
  );
}
