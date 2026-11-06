"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"
import { JadeDialog } from "./jade-dialog"

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
    <JadeDialog
      open={pending !== null}
      onOpenChange={(open) => !open && settle(false)}
      title={
        <span className="flex items-start gap-3">
          {destructive && <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--jade-hit)] drop-shadow-[1px_1px_0_#000]" aria-hidden />}
          {shown?.title}
        </span>
      }
      description={shown?.description || "Confirm or cancel"}
      showDescription={Boolean(shown?.description)}
    >
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className="jade-btn min-w-20" onClick={() => settle(false)}>
          {shown?.cancelLabel ?? "Cancel"}
        </button>
        <button type="button" autoFocus className={cn("jade-btn min-w-20", destructive && "jade-btn-danger")} onClick={() => settle(true)}>
          {shown?.confirmLabel ?? "OK"}
        </button>
      </div>
    </JadeDialog>
  )
}
