import styles from './boot-screen.module.css';

type BootScreenProps = Readonly<{
  label?: string;
}>;

export function BootScreen({ label = 'Loading' }: BootScreenProps) {
  return (
    <div role="status" className={styles['bootScreen']}>
      <span className="visually-hidden">{label}</span>
      <span className={styles['logo']} aria-hidden="true">
        <span className={styles['mark']} aria-hidden="true" />
        finance
      </span>
      <span className={styles['track']}>
        <span className={styles['progress']} />
      </span>
    </div>
  );
}
