import { NoEntries } from './no-entries';
import styles from './no-matching-entries.module.css';

const SEARCH_ICON_PATH = 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14m9 16-3.5-3.5';

type NoMatchingEntriesProps = Readonly<{
  entityNames: string;
  isFiltered?: boolean;
  onClear: () => void;
}>;

export function NoMatchingEntries({
  entityNames,
  isFiltered = false,
  onClear,
}: NoMatchingEntriesProps) {
  return (
    <NoEntries
      iconPath={SEARCH_ICON_PATH}
      title={
        isFiltered ? `No ${entityNames} match these filters` : `No ${entityNames} match this search`
      }
      text={isFiltered ? 'Try another filter or search.' : 'Try another name or description.'}
    >
      <button type="button" className={styles['clear']} onClick={onClear}>
        {isFiltered ? 'Clear filters' : 'Clear search'}
      </button>
    </NoEntries>
  );
}
