import { useRef, useState } from 'react';

import styles from './search-field.module.css';

const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';

type SearchFieldProps = Readonly<{
  id: string;
  label: string;
  term: string;
  isFocusedOnMount: boolean;
  onSearch: (term: string) => void;
}>;

export function SearchField({ id, label, term, isFocusedOnMount, onSearch }: SearchFieldProps) {
  const [value, setValue] = useState(term);
  const hasFocusedOnMount = useRef(false);
  return (
    <label className={styles['searchField']}>
      <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={SEARCH_ICON_PATH} />
      </svg>
      <span className="visually-hidden">{label}</span>
      <input
        ref={(input) => {
          if (input !== null && isFocusedOnMount && !hasFocusedOnMount.current) {
            hasFocusedOnMount.current = true;
            input.focus();
          }
        }}
        id={id}
        type="search"
        className={styles['input']}
        placeholder={label}
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
