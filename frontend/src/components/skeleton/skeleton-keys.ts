export function listSkeletonKeys(count: number): readonly string[] {
  const keys = Array.from({ length: count }, (_, position) => `skeleton-${String(position + 1)}`);
  return keys;
}
