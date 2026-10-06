export function isOwner(
  email: string | null | undefined,
  allowedEmail: string | null | undefined,
): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedAllowedEmail = allowedEmail?.trim().toLowerCase();

  return Boolean(
    normalizedEmail &&
      normalizedAllowedEmail &&
      normalizedEmail === normalizedAllowedEmail,
  );
}
