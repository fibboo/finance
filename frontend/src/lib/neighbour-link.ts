export function readNeighbourLinkId({
  linkIdPrefix,
  linkId,
}: Readonly<{ linkIdPrefix: string; linkId: string }>): string | undefined {
  const linkIds = Array.from(
    document.querySelectorAll(`[id^="${linkIdPrefix}"]`),
    (link) => link.id,
  );
  const index = linkIds.indexOf(linkId);
  const neighbourLinkId = index === -1 ? undefined : (linkIds[index + 1] ?? linkIds[index - 1]);
  return neighbourLinkId;
}
