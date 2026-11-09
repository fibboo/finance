import styles from './deleted-account-name.module.css';

type DeletedAccountNameProps = Readonly<{ name: string }>;

export function DeletedAccountName({ name }: DeletedAccountNameProps) {
  return (
    <span className={styles['deletedAccountName']}>
      {name}
      <span className="visually-hidden">, deleted</span>
    </span>
  );
}
