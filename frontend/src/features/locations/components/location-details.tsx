import { keepPreviousData, type QueryKey, useMutation, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import type { To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import {
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
  RESTORE_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import { DetailsPanel } from '@/components/details-panel/details-panel';
import { ApiError } from '@/lib/api-error';

import { locationMutations } from '../api/location-mutations';
import { locationQueries } from '../api/location-queries';
import { readLocationLinkId } from '../api/selected-location';
import { LOCATION_DELETE_TITLE, readLocationDeleteText } from './location-delete-copy';
import styles from './location-details.module.css';

type LocationDetailsProps = Readonly<{
  locationId: string;
  markIconPath: string;
  transactionsLink: To;
  transactionsLinkId: string;
  relatedQueryKeys: readonly QueryKey[];
  isShownByDefault: boolean;
  onEdit: () => void;
  onStatusChanged: () => void;
  onRestoreNameTaken: () => void;
  onClose: () => void;
  onChoose: () => void;
}>;

export function LocationDetails({
  locationId,
  markIconPath,
  transactionsLink,
  transactionsLinkId,
  relatedQueryKeys,
  isShownByDefault,
  onEdit,
  onStatusChanged,
  onRestoreNameTaken,
  onClose,
  onChoose,
}: LocationDetailsProps) {
  const titleId = useId();
  const deleteButtonId = useId();
  const [isConfirming, setIsConfirming] = useState(false);
  const {
    data: location,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useQuery({ ...locationQueries.detail(locationId), placeholderData: keepPreviousData });
  const deleteOptions = locationMutations.delete(relatedQueryKeys);
  const locationDelete = useMutation({
    ...deleteOptions,
    onSuccess: async (deletedLocation, deletedLocationId, onMutateResult, context) => {
      await deleteOptions.onSuccess?.(deletedLocation, deletedLocationId, onMutateResult, context);
      onStatusChanged();
    },
  });
  const restoreOptions = locationMutations.restore(relatedQueryKeys);
  const locationRestore = useMutation({
    ...restoreOptions,
    onSuccess: async (restoredLocation, restore, onMutateResult, context) => {
      await restoreOptions.onSuccess?.(restoredLocation, restore, onMutateResult, context);
      onStatusChanged();
    },
  });

  function closeConfirmation() {
    setIsConfirming(false);
    document.getElementById(deleteButtonId)?.focus();
  }

  return (
    <DetailsPanel
      label="Location details"
      isLoaded={location !== undefined}
      isError={isError}
      isFetching={isFetching}
      isReplacing={isPlaceholderData}
      isShownByDefault={isShownByDefault}
      isKeptOpenOnDesktop={false}
      errorMessage="Couldn't load the location"
      returnFocusId={readLocationLinkId(locationId)}
      onRetry={() => {
        void refetch();
      }}
      onClose={onClose}
      onChoose={onChoose}
      renderContent={(closeButton) =>
        location !== undefined && (
          <article aria-labelledby={titleId} className={styles['locationDetails']}>
            <div className={styles['header']} data-sheet-drag-area>
              <span
                className={`${styles['mark'] ?? ''} ${location.status === 'DELETED' ? (styles['deletedMark'] ?? '') : ''}`}
                aria-hidden="true"
              >
                <svg className={styles['markIcon']} viewBox="0 0 24 24">
                  <path d={markIconPath} />
                </svg>
              </span>
              <div className={styles['heading']}>
                <span className={styles['meta']}>
                  Location
                  {location.status === 'DELETED' && (
                    <span className={styles['badge']}>Deleted</span>
                  )}
                </span>
                <h2 id={titleId} className={styles['title']}>
                  {location.status === 'DELETED' ? (
                    <s className={styles['deletedTitle']}>{location.name}</s>
                  ) : (
                    location.name
                  )}
                </h2>
              </div>
              {closeButton}
            </div>
            {location.description !== undefined &&
              location.description !== null &&
              location.description !== '' && (
                <p className={styles['description']}>{location.description}</p>
              )}
            <ActionBar>
              <ActionButton
                id={transactionsLinkId}
                label="Transactions"
                iconPath={TRANSACTIONS_ICON_PATH}
                isDanger={false}
                action={{ kind: 'link', to: transactionsLink, isScrollKept: false }}
              />
              {location.status === 'DELETED' ? (
                <ActionButton
                  label="Restore"
                  iconPath={RESTORE_ICON_PATH}
                  isDanger={false}
                  action={{
                    kind: 'button',
                    blockingHint: undefined,
                    onClick: () => {
                      if (locationRestore.isPending) {
                        return;
                      }

                      locationRestore.mutate(
                        { location_id: locationId },
                        {
                          onError: (error) => {
                            if (
                              error instanceof ApiError &&
                              error.error_code === 'NAME_ALREADY_EXISTS'
                            ) {
                              onRestoreNameTaken();
                            }
                          },
                        },
                      );
                    },
                  }}
                />
              ) : (
                <>
                  <ActionButton
                    label="Edit"
                    iconPath={EDIT_ICON_PATH}
                    isDanger={false}
                    action={{ kind: 'button', blockingHint: undefined, onClick: onEdit }}
                  />
                  <ActionButton
                    id={deleteButtonId}
                    label="Delete location"
                    iconPath={DELETE_ICON_PATH}
                    isDanger
                    action={{
                      kind: 'button',
                      blockingHint: undefined,
                      onClick: () => {
                        setIsConfirming(true);
                      },
                    }}
                  />
                </>
              )}
            </ActionBar>
            {isConfirming && (
              <DeleteConfirmation
                title={LOCATION_DELETE_TITLE}
                text={readLocationDeleteText(location.name)}
                isPending={locationDelete.isPending}
                onCancel={closeConfirmation}
                onConfirm={() => {
                  locationDelete.mutate(locationId, {
                    onSuccess: () => {
                      setIsConfirming(false);
                    },
                    onError: closeConfirmation,
                  });
                }}
              />
            )}
          </article>
        )
      }
    />
  );
}
