import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { Sheet } from '@/components/sheet/sheet';
import { locationQueries } from '@/features/locations/api/location-queries';
import { writeSelectedLocation } from '@/features/locations/api/selected-location';
import { LocationDetails } from '@/features/locations/components/location-details';
import { LocationForm } from '@/features/locations/components/location-form';
import { LocationRestoreForm } from '@/features/locations/components/location-restore-form';
import { transactionQueries } from '@/features/transactions/api/transaction-queries';
import { ApiError, NOT_FOUND_STATUS } from '@/lib/api-error';

import { LOCATION_ICON_PATH } from './location-icon';
import { readLocationTransactionsLink } from './transactions-link';

type SelectedLocationDetailsProps = Readonly<{
  locationId: string;
}>;

export function SelectedLocationDetails({ locationId }: SelectedLocationDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editedLocationId, setEditedLocationId] = useState<string | undefined>(undefined);
  const [renamedLocationId, setRenamedLocationId] = useState<string | undefined>(undefined);
  const transactionsLinkId = useId();
  const isEditing = editedLocationId === locationId;
  if (editedLocationId !== undefined && !isEditing) {
    setEditedLocationId(undefined);
  }

  const isRenaming = renamedLocationId === locationId;
  if (renamedLocationId !== undefined && !isRenaming) {
    setRenamedLocationId(undefined);
  }

  const { data: location, error } = useQuery(locationQueries.detail(locationId));
  if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
    return (
      <Navigate
        to={{ search: writeSelectedLocation({ searchParams, locationId: undefined }).toString() }}
        replace
      />
    );
  }

  const relatedQueryKeys = [
    transactionQueries.feeds().queryKey,
    transactionQueries.details().queryKey,
  ];

  function closeEditForm() {
    setEditedLocationId(undefined);
  }

  function closeRestoreForm() {
    setRenamedLocationId(undefined);
  }

  function focusTransactionsLink() {
    requestAnimationFrame(() => {
      document.getElementById(transactionsLinkId)?.focus();
    });
  }

  return (
    <>
      <LocationDetails
        locationId={locationId}
        markIconPath={LOCATION_ICON_PATH}
        transactionsLink={readLocationTransactionsLink(locationId)}
        transactionsLinkId={transactionsLinkId}
        relatedQueryKeys={relatedQueryKeys}
        isShownByDefault={false}
        onEdit={() => {
          setEditedLocationId(locationId);
        }}
        onStatusChanged={focusTransactionsLink}
        onRestoreNameTaken={() => {
          setRenamedLocationId(locationId);
        }}
        onClose={() => {
          setSearchParams(writeSelectedLocation({ searchParams, locationId: undefined }), {
            preventScrollReset: true,
          });
        }}
        onChoose={() => {
          setSearchParams(writeSelectedLocation({ searchParams, locationId }), {
            preventScrollReset: true,
            replace: true,
          });
        }}
      />
      {isEditing && location !== undefined && (
        <Sheet label="Edit location" onClose={closeEditForm}>
          <LocationForm
            mode={{
              kind: 'edit',
              location,
              relatedQueryKeys,
              onSaved: () => {
                setEditedLocationId((openLocationId) =>
                  openLocationId === locationId ? undefined : openLocationId,
                );
              },
            }}
            onBack={closeEditForm}
          />
        </Sheet>
      )}
      {isRenaming && location?.status === 'DELETED' && (
        <Sheet label="Restore location" onClose={closeRestoreForm}>
          <LocationRestoreForm
            location={location}
            relatedQueryKeys={relatedQueryKeys}
            onRestored={() => {
              closeRestoreForm();
              focusTransactionsLink();
            }}
            onBack={closeRestoreForm}
          />
        </Sheet>
      )}
    </>
  );
}
