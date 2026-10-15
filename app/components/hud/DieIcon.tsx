/** Outline of a die with the given number of sides, drawn in the HUD's engraved style. */
export default function DieIcon({ sides, className = "h-5 w-5" }: { sides: number; className?: string }) {
  const thin = { strokeWidth: 1.4 }
  let shape: React.ReactNode
  switch (sides) {
    case 4:
      shape = <><path d="M16 4l12 22H4z" /><path d="M16 4v22M4 26l12-8 12 8" {...thin} /></>
      break
    case 6:
      shape = <><path d="M16 4l11 6v12l-11 6-11-6V10z" /><path d="M5 10l11 6 11-6M16 16v12" {...thin} /></>
      break
    case 8:
      shape = <><path d="M16 3l11 13-11 13L5 16z" /><path d="M5 16h22M16 3l-4 13 4 13M16 3l4 13-4 13" {...thin} /></>
      break
    case 10:
      shape = <><path d="M16 3l11 11-11 15L5 14z" /><path d="M5 14l11 4 11-4M16 18v11M16 3l-5 12M16 3l5 12" {...thin} /></>
      break
    case 12:
      shape = <><path d="M16 3l12.5 9-4.8 15H8.3L3.5 12z" /><path d="M16 9l6 4.4-2.3 7H12.3L10 13.4z" {...thin} /></>
      break
    case 20:
      shape = <><path d="M16 3l11.5 6.5v13L16 29 4.5 22.5v-13z" /><path d="M16 9l7 12H9zM16 3v6M4.5 9.5L9 21M27.5 9.5L23 21M9 21l7 8 7-8" {...thin} /></>
      break
    case 100:
      shape = <><path d="M10 6l7 7-7 10-7-10zM22 9l7 7-7 10-7-10z" /><path d="M3 13l7 3 7-3M15 16l7 3 7-3" strokeWidth={1.3} /></>
      break
    default:
      shape = <><circle cx="16" cy="16" r="12.5" /><path d="M16 3.5v6M16 22.5v6M5 10l5 3M27 10l-5 3M5 22l5-3M27 22l-5-3M10 13l6-3.5 6 3.5v6l-6 3.5-6-3.5z" {...thin} /></>
  }
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {shape}
    </svg>
  )
}

/** A square die with a question mark: opens the custom roll (count and expression). */
export function CustomDieIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="4.5" width="23" height="23" rx="4" />
      <path d="M12.3 12.6a3.8 3.8 0 1 1 5.6 3.3c-1.2.7-1.9 1.4-1.9 2.8v.6" strokeWidth={2.3} />
      <circle cx="16" cy="23" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}
