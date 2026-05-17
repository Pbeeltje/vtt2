/** Whether the host configured a registration gate (REGISTRATION_SECRET). */
export function registrationInviteRequired(): boolean {
  return Boolean(process.env.REGISTRATION_SECRET?.trim());
}

export function getTrimmedRegistrationSecret(): string | null {
  const s = process.env.REGISTRATION_SECRET?.trim();
  return s || null;
}

/** If a secret is configured, `inviteCode` must match (trimmed). If no secret, always valid. */
export function isValidRegistrationInvite(inviteCode: unknown): boolean {
  const secret = getTrimmedRegistrationSecret();
  if (!secret) return true;
  if (typeof inviteCode !== "string") return false;
  return inviteCode.trim() === secret;
}
