export interface User {
  id: number;
  username: string;
  role: string;
  /** Permanent host (cannot be demoted; only they can grant/revoke DM for others). */
  isHostAdmin?: boolean;
}

