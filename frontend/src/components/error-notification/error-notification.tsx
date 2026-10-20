import { useSyncExternalStore } from 'react';

import styles from './error-notification.module.css';
import {
  dismissErrorNotification,
  readIsErrorShown,
  subscribeToErrorNotification,
} from './error-notification-store';

export function ErrorNotification() {
  const isErrorShown = useSyncExternalStore(subscribeToErrorNotification, readIsErrorShown);

  return (
    <div className={styles['region']} role="alert">
      {isErrorShown && (
        <div className={styles['notification']}>
          <span>Something went wrong. Please try again.</span>
          <button type="button" className={styles['dismiss']} onClick={dismissErrorNotification}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
