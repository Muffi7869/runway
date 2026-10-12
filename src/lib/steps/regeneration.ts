export function isRegenerationLocked({
  hasProgress,
  hasBlocks,
}: {
  hasProgress: boolean;
  hasBlocks: boolean;
}): boolean {
  return hasProgress || hasBlocks;
}
