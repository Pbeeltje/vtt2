// hooks/useCharacter.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Character } from '../types/character';

// Compare as strings: inputs hold "12" where the server sends 12.
const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value));

/**
 * Apply a server update to the draft without discarding local edits: fields the user changed
 * since the last server version keep their local value, everything else takes the new value.
 */
function mergeServerUpdate(draft: Character, previousServer: Character, nextServer: Character): Character {
  if (previousServer.CharacterId !== nextServer.CharacterId) return nextServer;
  const merged: Record<string, unknown> = { ...nextServer };
  const draftFields = draft as unknown as Record<string, unknown>;
  const previousFields = previousServer as unknown as Record<string, unknown>;
  for (const key of Object.keys(draftFields)) {
    if (asText(draftFields[key]) !== asText(previousFields[key])) merged[key] = draftFields[key];
  }
  return merged as unknown as Character;
}

/** Fields the sheet edits; ownership and ids are changed elsewhere (or never). */
const EDITABLE_FIELDS = [
  'Name', 'Description', 'Path', 'Age', 'Level', 'Guard', 'MaxGuard', 'Armor', 'Strength', 'MaxStrength',
  'Dexternity', 'MaxDexternity', 'Mind', 'MaxMind', 'Charisma', 'MaxCharisma', 'Skill', 'MaxSkill',
  'Mp', 'MaxMp', 'PortraitUrl', 'TokenUrl',
] as const;

/** A draft of one character for the sheet, kept in step with live server updates. */
export function useCharacter(serverCharacter: Character) {
  const [editedCharacter, setEditedCharacter] = useState<Character>(serverCharacter);
  const previousServerRef = useRef(serverCharacter);

  useEffect(() => {
    const previousServer = previousServerRef.current;
    previousServerRef.current = serverCharacter;
    setEditedCharacter(draft => mergeServerUpdate(draft, previousServer, serverCharacter));
  }, [serverCharacter]);

  /** The edited fields that differ from the server's character. */
  const changesFrom = useCallback((draft: Character): Partial<Character> => {
    const changes: Record<string, unknown> = {};
    const server = previousServerRef.current as unknown as Record<string, unknown>;
    const edited = draft as unknown as Record<string, unknown>;
    for (const field of EDITABLE_FIELDS) {
      if (field in edited && asText(edited[field]) !== asText(server[field])) changes[field] = edited[field];
    }
    return changes as Partial<Character>;
  }, []);

  const resetDraft = useCallback(() => setEditedCharacter(previousServerRef.current), []);

  return { editedCharacter, setEditedCharacter, changesFrom, resetDraft };
}
