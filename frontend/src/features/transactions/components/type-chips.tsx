import type { components } from '@/lib/api-schema';

import styles from './type-chips.module.css';

type DictionaryItem = components['schemas']['DictionaryItem'];

type TypeChipsProps = Readonly<{
  types: readonly DictionaryItem[];
  selectedType: string;
  onChange: (transactionType: string) => void;
}>;

export function TypeChips({ types, selectedType, onChange }: TypeChipsProps) {
  return (
    <fieldset className={styles['typeChips']}>
      <legend className="visually-hidden">Type</legend>
      {types.map((type) => (
        <label key={type.key} className={styles['chip']}>
          <input
            type="radio"
            name="transaction_type"
            className={styles['radio']}
            checked={type.key === selectedType}
            onChange={() => {
              onChange(type.key);
            }}
          />
          {type.label}
        </label>
      ))}
    </fieldset>
  );
}
