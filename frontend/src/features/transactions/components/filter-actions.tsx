import styles from './filter-actions.module.css';

type FilterActionsProps = Readonly<{ onReset: () => void }>;

export function FilterActions({ onReset }: FilterActionsProps) {
  return (
    <div className={styles['filterActions']}>
      <button type="button" className={styles['reset']} onClick={onReset}>
        Reset
      </button>
      <button type="submit" className={styles['apply']}>
        Apply
      </button>
    </div>
  );
}
