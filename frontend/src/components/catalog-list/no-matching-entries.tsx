import { NoEntries } from './no-entries';
import styles from './no-matching-entries.module.css';

const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';

type NoMatchingEntriesProps = Readonly<{
  entityNames: string;
  onClear: () => void;
}>;

export function NoMatchingEntries({ entityNames, onClear }: NoMatchingEntriesProps) {
  return (
    <NoEntries
      iconPath={SEARCH_ICON_PATH}
      title={`No ${entityNames} match this search`}
      text="Try another name or description."
    >
      <button type="button" className={styles['clear']} onClick={onClear}>
        Clear search
      </button>
    </NoEntries>
  );
}
