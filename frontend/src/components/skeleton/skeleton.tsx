import styles from './skeleton.module.css';

type SkeletonProps = Readonly<{ className: string | undefined }>;

export function Skeleton({ className }: SkeletonProps) {
  return <span aria-hidden="true" className={[styles['skeleton'], className].join(' ')} />;
}

type SkeletonLineProps = Readonly<{
  textClassName: string | undefined;
  className: string | undefined;
}>;

export function SkeletonLine({ textClassName, className }: SkeletonLineProps) {
  return (
    <span className={[styles['line'], textClassName].join(' ')}>
      <Skeleton className={className} />
    </span>
  );
}
