import styles from './logo.module.css';

type LogoProps = Readonly<{
  nameClassName?: string | undefined;
}>;

export function Logo({ nameClassName }: LogoProps) {
  return (
    <span className={styles['logo']}>
      <span className={styles['mark']} aria-hidden="true" />
      <span className={nameClassName}>finance</span>
    </span>
  );
}
