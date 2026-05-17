/**
 * Host tunnel UI/API: on by default in non-production; opt out with ENABLE_HOST_TUNNEL=false.
 * Opt in for production-like local runs: ENABLE_HOST_TUNNEL=true
 */
export function isHostTunnelFeatureEnabled(): boolean {
  const v = process.env.ENABLE_HOST_TUNNEL?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  return process.env.NODE_ENV !== "production";
}
