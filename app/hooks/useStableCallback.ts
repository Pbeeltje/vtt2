import { useCallback, useRef } from "react"

/**
 * A function that never changes identity but always calls the latest `fn`. For handlers passed
 * to memoised children, so a parent re-render (a drag, a stroke) doesn't re-render all of them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, [])
}
