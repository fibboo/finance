import type { components } from '@/lib/api-schema';

import { ENTRY_TRANSACTION_TYPES, type EntryTransactionType } from '../api/new-transaction';
import styles from './form-header.module.css';
import { TypeChips } from './type-chips';

type DictionaryItem = components['schemas']['DictionaryItem'];

export const NEW_TRANSACTION_TITLE = 'New transaction';

const CLOSE_ICON_PATH = 'M6 6l12 12M18 6 6 18';

export type TypeChoice = Readonly<{
  transactionType: EntryTransactionType;
  transactionTypes: readonly DictionaryItem[];
  onTypeChange: (transactionType: EntryTransactionType) => void;
}>;

type FormHeaderProps = Readonly<{
  title: string;
  typeChoice: TypeChoice | undefined;
  onClose: () => void;
}>;

export function FormHeader({ title, typeChoice, onClose }: FormHeaderProps) {
  const entryTypes = typeChoice?.transactionTypes.filter((type) =>
    ENTRY_TRANSACTION_TYPES.some((entryType) => entryType === type.key),
  );
  return (
    <>
      <div className={styles['header']} data-sheet-drag-area>
        <h2 className={styles['title']}>{title}</h2>
        <button type="button" className={styles['close']} aria-label="Close" onClick={onClose}>
          <svg className={styles['closeIcon']} aria-hidden="true" viewBox="0 0 24 24">
            <path d={CLOSE_ICON_PATH} />
          </svg>
        </button>
      </div>
      {typeChoice !== undefined && entryTypes !== undefined && (
        <TypeChips
          types={entryTypes}
          selectedType={typeChoice.transactionType}
          onChange={(typeKey) => {
            const nextType = ENTRY_TRANSACTION_TYPES.find((entryType) => entryType === typeKey);
            if (nextType !== undefined) {
              typeChoice.onTypeChange(nextType);
            }
          }}
        />
      )}
    </>
  );
}
