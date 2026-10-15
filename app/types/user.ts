export interface User {
  id: number;
  username: string;
  role: string;
  /** Permanent host (cannot be demoted; only they can grant/revoke DM for others). */
  isHostAdmin?: boolean;
  /** Player colour (lib/player-colors.ts): portrait ring, name, map pings, default drawing colour. */
  color?: string;
  /** Uploaded avatar, or null for the default silhouette. */
  avatarUrl?: string | null;
}
