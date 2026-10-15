/** The env-configured DM (DM_USERNAME / DM_PASSWORD) is always this user id, and is the host. */
export const ENV_DM_USER_ID = 0

export function envDmConfigured(): boolean {
  return Boolean(process.env.DM_USERNAME && process.env.DM_PASSWORD)
}
