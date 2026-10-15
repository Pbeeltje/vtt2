// components/character-popup/useSheetDraft.ts
import { useCallback } from 'react';
import type { Character } from '../../types/character';
import { useCharacter } from '../../hooks/useCharacter';

/** The sheet's editable draft, shared by the header plates, the medallions and the Stats tab. */
export function useSheetDraft(character: Character, onSave: (changes: Partial<Character>) => unknown) {
  const { editedCharacter, setEditedCharacter, changesFrom, resetDraft } = useCharacter(character);

  const set = useCallback(
    (name: keyof Character, value: unknown) => setEditedCharacter(prev => ({ ...prev, [name]: value })),
    [setEditedCharacter]
  );

  /** Saves whatever differs from the server, plus `extra` (a value whose state update hasn't landed yet). */
  const save = (extra: Partial<Character> = {}) => {
    const changes = changesFrom({ ...editedCharacter, ...extra });
    if (Object.keys(changes).length > 0) onSave(changes);
  };

  /** Enter saves, Escape throws the unsaved edits away. */
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      resetDraft();
    }
  };

  return { draft: editedCharacter, set, save, keyDown };
}

export type SheetDraft = ReturnType<typeof useSheetDraft>;
