import type { ChildProcess } from "child_process";

/** Shared tunnel process state (no `child_process` runtime import — types only). */
export const tunnelRuntime = {
  proc: null as ChildProcess | null,
  publicUrl: null as string | null,
  startPromise: null as Promise<string> | null,
};

export function getTunnelStatus(): { running: boolean; url: string | null } {
  const p = tunnelRuntime.proc;
  const alive = p !== null && !p.killed;
  return { running: alive, url: tunnelRuntime.publicUrl };
}
