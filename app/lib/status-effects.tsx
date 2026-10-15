// Status effects a token can show on the map, one at a time (picked in token settings).
import { ArrowDown, ArrowUp, Droplet, Grid3x3, Hand, Plus, Shield, X } from "lucide-react"

type StatusIcon = (props: { className?: string }) => React.ReactNode

function FilledDroplet({ className }: { className?: string }) {
  return <Droplet className={className} fill="currentColor" />
}

/** A shield with a downward arrow on it. */
function ShieldArrow({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className ?? ""}`}>
      <Shield className="h-full w-full" />
      <ArrowDown className="absolute h-1/2 w-1/2" strokeWidth={3} />
    </span>
  )
}

/** A net: a lattice turned on its corner. */
function Net({ className }: { className?: string }) {
  return <Grid3x3 className={`rotate-45 ${className ?? ""}`} />
}

export const STATUS_EFFECTS = {
  drop: { label: "Green drop", Icon: FilledDroplet, color: "#16a34a" },
  x: { label: "Red X", Icon: X, color: "#dc2626" },
  net: { label: "Net", Icon: Net, color: "#78716c" },
  hand: { label: "Hand", Icon: Hand, color: "#d97706" },
  down: { label: "Down arrow", Icon: ArrowDown, color: "#2563eb" },
  up: { label: "Up arrow", Icon: ArrowUp, color: "#2563eb" },
  shieldArrow: { label: "Shield arrow", Icon: ShieldArrow, color: "#7c3aed" },
  plus: { label: "Plus", Icon: Plus, color: "#16a34a" },
} satisfies Record<string, { label: string; Icon: StatusIcon; color: string }>

export type StatusEffect = keyof typeof STATUS_EFFECTS

export function isStatusEffect(value: unknown): value is StatusEffect {
  return typeof value === "string" && Object.hasOwn(STATUS_EFFECTS, value)
}

/** The icon for one status effect, in its own colour. */
export function StatusEffectIcon({ effect, className }: { effect: StatusEffect; className?: string }) {
  const { Icon, color } = STATUS_EFFECTS[effect]
  return (
    <span style={{ color }} className="inline-flex">
      <Icon className={className} />
    </span>
  )
}
