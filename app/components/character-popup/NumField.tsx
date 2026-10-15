// components/character-popup/NumField.tsx
import type { Character } from '../../types/character';
import type { SheetDraft } from './useSheetDraft';

interface NumFieldProps {
  sheet: SheetDraft;
  name: keyof Character;
  label: string;
  className?: string;
  maxLength?: number;
  /** Size the box to its digits (for "7/10" pairs that must stay centred) instead of a fixed width. */
  fit?: boolean;
}

/** A whole-number field on the sheet: digits only, saved on blur or Enter. */
export function NumField({ sheet, name, label, className = "", maxLength = 2, fit = false }: NumFieldProps) {
  const value = sheet.draft[name];
  const text = value === null || value === undefined ? '' : String(value);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => sheet.set(name, e.target.value.replace(/[^0-9]/g, '').slice(0, maxLength))}
      onFocus={(e) => e.target.select()}
      onBlur={() => sheet.save()}
      onKeyDown={sheet.keyDown}
      aria-label={label}
      title={label}
      // Tabular digits are exactly 1ch wide, so this hugs the number.
      style={fit ? { width: `${Math.max(1, text.length)}ch` } : undefined}
      className={`min-w-0 bg-transparent text-center tabular-nums outline-none focus:bg-black/40 focus:shadow-[0_0_0_1px_#e0c25a] ${className}`}
    />
  );
}
