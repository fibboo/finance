import styles from './new-button.module.css';

const NEW_ICON_PATH = 'M12 5v14M5 12h14';

type NewButtonProps = Readonly<{
  entityName: string;
  isDisabled: boolean;
  onClick: () => void;
}>;

export function NewButton({ entityName, isDisabled, onClick }: NewButtonProps) {
  return (
    <button type="button" className={styles['newButton']} disabled={isDisabled} onClick={onClick}>
      <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={NEW_ICON_PATH} />
      </svg>
      New <span className="visually-hidden-on-phone">{entityName}</span>
    </button>
  );
}
