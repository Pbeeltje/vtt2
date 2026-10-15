"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, for deletes and other things that can't be undone. */
  destructive?: boolean
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

// Module-level store, like use-toast, so any component can await a confirmation
// without threading context through. <ConfirmDialogHost /> in the layout renders it.
let current: Pending | null = null
const listeners = new Set<(pending: Pending | null) => void>()

function emit() {
  for (const listener of listeners) listener(current)
}

/** In-app replacement for window.confirm. Resolves true on confirm, false on cancel or dismiss. */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts = typeof options === "string" ? { title: options } : options
  // A new request supersedes one still open; the old one counts as cancelled.
  current?.resolve(false)
  return new Promise((resolve) => {
    current = { ...opts, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  if (!current) return
  current.resolve(ok)
  current = null
  emit()
}

export function ConfirmDialogHost() {
  const [pending, setPending] = React.useState<Pending | null>(current)
  // Keep the last request around while the dialog closes, so its text doesn't vanish mid-fade.
  const [shown, setShown] = React.useState<Pending | null>(current)

  React.useEffect(() => {
    const listener = (next: Pending | null) => {
      setPending(next)
      if (next) setShown(next)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const destructive = shown?.destructive ?? false

  return (
    <DialogPrimitive.Root open={pending !== null} onOpenChange={(open) => !open && settle(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "jade fixed left-1/2 top-1/2 z-[310] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 outline-none",
            "duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <i className="jade-knot absolute -top-2 left-4 right-4 z-10 h-4" aria-hidden />
          <div className="jade-well jade-fill px-6 pb-5 pt-7">
            <div className="flex items-start gap-3">
              {destructive && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--jade-hit)] drop-shadow-[1px_1px_0_#000]" aria-hidden />}
              <div className="min-w-0 space-y-2">
                <DialogPrimitive.Title className="jade-title text-lg leading-tight">{shown?.title}</DialogPrimitive.Title>
                {shown?.description ? (
                  <DialogPrimitive.Description className="jade-outline text-sm text-[var(--jade-ink)]">{shown.description}</DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">Confirm or cancel</DialogPrimitive.Description>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="jade-btn min-w-20" onClick={() => settle(false)}>
                {shown?.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                autoFocus
                className={cn("jade-btn min-w-20", destructive && "jade-btn-danger")}
                onClick={() => settle(true)}
              >
                {shown?.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
          <i className="jade-knot jade-knot-under absolute -bottom-2 left-4 right-4 z-10 h-4" aria-hidden />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
