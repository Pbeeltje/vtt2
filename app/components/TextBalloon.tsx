interface TextBalloonProps {
  message: string
  /** The speaking token's top-left corner and width, in map pixels. */
  x: number
  y: number
  tokenWidth: number
}

/** What a character just said in chat, over its token. useChat removes it after a few seconds. */
export default function TextBalloon({ message, x, y, tokenWidth }: TextBalloonProps) {
  return (
    <div
      className="pointer-events-none absolute z-50"
      // Anchored by its bottom edge, so longer messages grow upwards instead of over the token.
      style={{ left: x + tokenWidth / 2, top: y - 12, transform: "translate(-50%, -100%)" }}
    >
      <div className="relative min-w-[100px] max-w-xs bg-[#efe9cf] px-4 py-2.5 shadow-[0_0_0_1.5px_#0a0d0a,0_4px_10px_rgba(0,0,0,.6)]">
        <div className="break-words font-[family-name:var(--font-spectral)] text-sm leading-snug text-[#1a1f18]">{message}</div>
        {/* The tail, pointing down at the token. */}
        <div className="absolute left-1/2 top-full -mt-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-[#efe9cf] shadow-[1.5px_1.5px_0_#0a0d0a]" />
      </div>
    </div>
  )
}
