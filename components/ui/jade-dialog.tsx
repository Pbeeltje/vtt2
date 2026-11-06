"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

type JadeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  /** Read out by screen readers; shown under the title when `showDescription`. */
  description: React.ReactNode
  showDescription?: boolean
  /** Next to the title, e.g. whose token this is. */
  aside?: React.ReactNode
  /** Width and the like for the dialog box. */
  className?: string
  children: React.ReactNode
}

/**
 * The game's modal dialog: a stone panel between two knotwork bands, centred over a dimmed
 * screen. Radix handles focus, Escape and clicking outside.
 */
export function JadeDialog({ open, onOpenChange, title, description, showDescription = false, aside, className, children }: JadeDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[300] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "jade fixed left-1/2 top-1/2 z-[310] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 outline-hidden",
            "duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className
          )}
          // Keep presses inside the dialog away from the map underneath.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <i className="jade-knot absolute -top-2 left-4 right-4 z-10 h-4" aria-hidden />
          <div className="jade-well jade-fill max-h-[calc(100vh-4rem)] overflow-y-auto px-6 pb-5 pt-7">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <DialogPrimitive.Title className="jade-title text-lg leading-tight">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className={showDescription ? "jade-outline text-sm text-[var(--jade-ink)]" : "sr-only"}>
                  {description}
                </DialogPrimitive.Description>
              </div>
              {aside}
            </div>
            {children}
          </div>
          <i className="jade-knot jade-knot-under absolute -bottom-2 left-4 right-4 z-10 h-4" aria-hidden />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
