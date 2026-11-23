import styles from './filter-summary.module.css';

type FilterSummaryProps = Readonly<{ summary: string; onOpen: () => void; onReset: () => void }>;

export function FilterSummary({ summary, onOpen, onReset }: FilterSummaryProps) {
  if (summary === '') {
    return null;
  }
  return (
    <div className={styles['summary']}>
      <button
        type="button"
        className={styles['text']}
        aria-label={`Edit filters: ${summary}`}
        onClick={onOpen}
      >
        {summary}
      </button>
      <button type="button" className={styles['clear']} onClick={onReset}>
        Clear
      </button>
    </div>
  );
}
