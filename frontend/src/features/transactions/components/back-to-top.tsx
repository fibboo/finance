import styles from './back-to-top.module.css';

const ARROW_UP_ICON_PATH = 'M12 19V5M5 12l7-7 7 7';

type BackToTopProps = Readonly<{ onClick: () => void }>;

export function BackToTop({ onClick }: BackToTopProps) {
  return (
    <button
      type="button"
      className={styles['backToTop']}
      aria-label="Back to top"
      data-back-to-top
      onClick={onClick}
    >
      <svg className={styles['icon']} aria-hidden="true" viewBox="0 0 24 24">
        <path d={ARROW_UP_ICON_PATH} />
      </svg>
    </button>
  );
}
