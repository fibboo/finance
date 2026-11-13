import { keepPreviousData, type QueryKey, useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import type { To } from 'react-router';

import { ActionBar } from '@/components/action-bar/action-bar';
import { ActionButton } from '@/components/action-button/action-button';
import { EDIT_ICON_PATH, TRANSACTIONS_ICON_PATH } from '@/components/action-button/action-icons';
import { DetailsPanel } from '@/components/details-panel/details-panel';

import { locationQueries } from '../api/location-queries';
import { readLocationLinkId } from '../api/selected-location';
import { DeleteLocation } from './delete-location';
import styles from './location-details.module.css';
import { RestoreLocation } from './restore-location';

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
  const {
    data: location,
    isError,
    isFetching,
    isPlaceholderData,
    refetch,
  } = useQuery({ ...locationQueries.detail(locationId), placeholderData: keepPreviousData });
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
      arrowKeyList={undefined}
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
                <RestoreLocation
                  key={locationId}
                  locationId={locationId}
                  relatedQueryKeys={relatedQueryKeys}
                  onRestored={onStatusChanged}
                  onNameTaken={onRestoreNameTaken}
                />
              ) : (
                <>
                  <ActionButton
                    label="Edit"
                    iconPath={EDIT_ICON_PATH}
                    isDanger={false}
                    action={{ kind: 'button', blockingHint: undefined, onClick: onEdit }}
                  />
                  <DeleteLocation
                    key={locationId}
                    locationId={locationId}
                    location={location}
                    relatedQueryKeys={relatedQueryKeys}
                    onDeleted={onStatusChanged}
                  />
                </>
              )}
            </ActionBar>
          </article>
        )
      }
    />
  );
}
