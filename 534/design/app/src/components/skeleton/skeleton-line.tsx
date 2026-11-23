import { Skeleton } from './skeleton';
import styles from './skeleton.module.css';

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
