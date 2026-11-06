import { useState } from 'react';

import styles from './account-search.module.css';

const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';

type AccountSearchProps = Readonly<{
  term: string;
  isFocused: boolean;
  onSearch: (term: string) => void;
}>;

export function AccountSearch({ term, isFocused, onSearch }: AccountSearchProps) {
  const [value, setValue] = useState(term);
  return (
    <label className={styles['accountSearch']}>
      <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={SEARCH_ICON_PATH} />
      </svg>
      <span className="visually-hidden">Search accounts</span>
      <input
        ref={(input) => {
          if (isFocused) {
            input?.focus();
          }
        }}
        type="search"
        className={styles['input']}
        placeholder="Search accounts"
        autoComplete="off"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          onSearch(event.target.value);
        }}
      />
    </label>
  );
}
