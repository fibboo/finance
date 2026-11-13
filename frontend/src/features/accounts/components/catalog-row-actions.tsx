import { type QueryKey, useMutation } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link, type To } from 'react-router';

import {
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
  RESTORE_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import { DeleteConfirmation } from '@/components/delete-confirmation/delete-confirmation';
import type { components } from '@/lib/api-schema';
import { readNeighbourLinkId } from '@/lib/neighbour-link';

import { accountMutations } from '../api/account-mutations';
import styles from './catalog-row-actions.module.css';

type Account = components['schemas']['Account'];

const ROW_LINK_ID_PREFIX = 'catalog-row-link-';

type CatalogRowActionsProps = Readonly<{
  entry: Readonly<Account>;
  entityName: string;
  entityNames: string;
  transactionsLink: To;
  relatedQueryKeys: readonly QueryKey[];
  searchFieldId: string;
  onEdit: () => void;
}>;

export function CatalogRowActions({
  entry,
  entityName,
  entityNames,
  transactionsLink,
  relatedQueryKeys,
  searchFieldId,
  onEdit,
}: CatalogRowActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFocusedOnRestore, setIsFocusedOnRestore] = useState(false);
  const accountDelete = useMutation(accountMutations.delete(relatedQueryKeys));
  const accountRestore = useMutation(accountMutations.restore(relatedQueryKeys));
  const deleteButtonId = useId();
  const rowLinkId = `${ROW_LINK_ID_PREFIX}${entry.id}`;

  function closeConfirmation() {
    setIsConfirming(false);
    document.getElementById(deleteButtonId)?.focus();
  }

  if (entry.status === 'DELETED') {
    return (
      <span className={styles['catalogRowActions']}>
        <button
          id={rowLinkId}
          type="button"
          aria-label="Restore"
          title="Restore"
          className={styles['action']}
          disabled={accountRestore.isPending}
          onClick={() => {
            accountRestore.mutate(entry.id, {
              onSuccess: () => {
                setIsFocusedOnRestore(true);
              },
            });
          }}
        >
          <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={RESTORE_ICON_PATH} />
          </svg>
        </button>
      </span>
    );
  }

  return (
    <span className={styles['catalogRowActions']}>
      <Link
        ref={(link) => {
          if (isFocusedOnRestore) {
            link?.focus();
          }
        }}
        id={rowLinkId}
        to={transactionsLink}
        aria-label="Transactions"
        title="Transactions"
        className={styles['action']}
        onBlur={() => {
          setIsFocusedOnRestore(false);
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={TRANSACTIONS_ICON_PATH} />
        </svg>
      </Link>
      <button
        type="button"
        aria-label="Edit"
        title="Edit"
        className={styles['action']}
        onClick={onEdit}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={EDIT_ICON_PATH} />
        </svg>
      </button>
      <button
        id={deleteButtonId}
        type="button"
        aria-label="Delete"
        title="Delete"
        className={`${styles['action'] ?? ''} ${styles['danger'] ?? ''}`}
        onClick={() => {
          setIsConfirming(true);
        }}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={DELETE_ICON_PATH} />
        </svg>
      </button>
      {isConfirming && (
        <DeleteConfirmation
          title={`Delete this ${entityName}?`}
          text={`${entry.name}. It leaves your ${entityNames} and the pickers, and its past transactions keep showing it.`}
          isPending={accountDelete.isPending}
          onCancel={closeConfirmation}
          onConfirm={() => {
            const neighbourLinkId = readNeighbourLinkId({
              linkIdPrefix: ROW_LINK_ID_PREFIX,
              linkId: rowLinkId,
            });
            accountDelete.mutate(entry.id, {
              onSuccess: () => {
                setIsConfirming(false);
                document.getElementById(neighbourLinkId ?? searchFieldId)?.focus();
              },
              onError: closeConfirmation,
            });
          }}
        />
      )}
    </span>
  );
}
