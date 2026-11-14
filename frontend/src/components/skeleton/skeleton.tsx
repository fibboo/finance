import styles from './skeleton.module.css';

type SkeletonProps = Readonly<{ className: string | undefined }>;

export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={[styles['skeleton'], className].join(' ')} />;
}
