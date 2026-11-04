import type { components } from '@/lib/api-schema';

import { ENTRY_TRANSACTION_TYPES, type EntryTransactionType } from '../api/new-transaction';
import styles from './form-header.module.css';
import { TypeChips } from './type-chips';

type DictionaryItem = components['schemas']['DictionaryItem'];

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';

type FormHeaderProps = Readonly<{
  transactionType: EntryTransactionType;
  transactionTypes: readonly DictionaryItem[];
  onTypeChange: (transactionType: EntryTransactionType) => void;
  onClose: () => void;
}>;

export function FormHeader({
  transactionType,
  transactionTypes,
  onTypeChange,
  onClose,
}: FormHeaderProps) {
  const entryTypes = transactionTypes.filter((type) =>
    ENTRY_TRANSACTION_TYPES.some((entryType) => entryType === type.key),
  );
  return (
    <>
      <div className={styles['header']}>
        <h2 className={styles['title']}>New transaction</h2>
        <button type="button" className={styles['close']} aria-label="Close" onClick={onClose}>
          <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={CLOSE_ICON_PATH} />
          </svg>
        </button>
      </div>
      <TypeChips
        types={entryTypes}
        selectedType={transactionType}
        onChange={(typeKey) => {
          const nextType = ENTRY_TRANSACTION_TYPES.find((entryType) => entryType === typeKey);
          if (nextType !== undefined) {
            onTypeChange(nextType);
          }
        }}
      />
    </>
  );
}
