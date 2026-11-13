import { Link, type To } from 'react-router';

import {
  DELETE_ICON_PATH,
  EDIT_ICON_PATH,
  RESTORE_ICON_PATH,
  TRANSACTIONS_ICON_PATH,
} from '@/components/action-button/action-icons';
import type { components } from '@/lib/api-schema';

import { readCatalogDeleteButtonId, readCatalogRowLinkId } from '../api/catalog-row-focus';
import styles from './catalog-row-actions.module.css';

type Account = components['schemas']['Account'];

type CatalogRowActionsProps = Readonly<{
  entry: Readonly<Account>;
  transactionsLink: To;
  isRestorePending: boolean;
  isFocusedAfterRestore: boolean;
  onRestoreFocused: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
}>;

export function CatalogRowActions({
  entry,
  transactionsLink,
  isRestorePending,
  isFocusedAfterRestore,
  onRestoreFocused,
  onEdit,
  onDelete,
  onRestore,
}: CatalogRowActionsProps) {
  const rowLinkId = readCatalogRowLinkId(entry.id);
  if (entry.status === 'DELETED') {
    return (
      <span className={styles['catalogRowActions']}>
        <button
          id={rowLinkId}
          type="button"
          aria-label="Restore"
          title="Restore"
          aria-disabled={isRestorePending}
          className={styles['action']}
          onClick={() => {
            if (!isRestorePending) {
              onRestore();
            }
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
          if (link !== null && isFocusedAfterRestore) {
            if (document.activeElement === document.body) {
              link.focus();
            }

            onRestoreFocused();
          }
        }}
        id={rowLinkId}
        to={transactionsLink}
        aria-label="Transactions"
        title="Transactions"
        className={styles['action']}
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
        id={readCatalogDeleteButtonId(entry.id)}
        type="button"
        aria-label="Delete"
        title="Delete"
        className={`${styles['action'] ?? ''} ${styles['danger'] ?? ''}`}
        onClick={onDelete}
      >
        <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
          <path d={DELETE_ICON_PATH} />
        </svg>
      </button>
    </span>
  );
}
