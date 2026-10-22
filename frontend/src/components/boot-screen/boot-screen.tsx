import styles from './boot-screen.module.css';

type BootScreenProps = Readonly<{
  label?: string;
}>;

export function BootScreen({ label = 'Loading' }: BootScreenProps) {
  return (
    <div role="status" aria-label={label} className={styles['bootScreen']}>
      <span className={styles['logo']}>
        <span className={styles['mark']} aria-hidden="true" />
        finance
      </span>
      <span className={styles['track']}>
        <span className={styles['progress']} />
      </span>
    </div>
  );
}
