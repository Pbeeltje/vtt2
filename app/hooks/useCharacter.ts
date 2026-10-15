// hooks/useCharacter.ts
import { useState, useEffect, useRef } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Character } from '../types/character';

/**
 * Apply a server update to the draft without discarding local edits: fields the user changed
 * since the last server version keep their local value, everything else takes the new value.
 */
function mergeServerUpdate(draft: Character, previousServer: Character, nextServer: Character): Character {
  if (previousServer.CharacterId !== nextServer.CharacterId) return nextServer;
  const merged: Record<string, unknown> = { ...nextServer };
  const draftFields = draft as unknown as Record<string, unknown>;
  const previousFields = previousServer as unknown as Record<string, unknown>;
  // Compare as strings: inputs hold "12" where the server sends 12.
  const asText = (value: unknown) => (value === null || value === undefined ? '' : String(value));
  for (const key of Object.keys(draftFields)) {
    if (asText(draftFields[key]) !== asText(previousFields[key])) merged[key] = draftFields[key];
  }
  return merged as unknown as Character;
}

export function useCharacter(initialCharacter: Character, onUpdate: (updatedCharacter: Character) => void) {
  const [editedCharacter, setEditedCharacter] = useState<Character>(initialCharacter);
  const previousServerRef = useRef(initialCharacter);

  useEffect(() => {
    const previousServer = previousServerRef.current;
    previousServerRef.current = initialCharacter;
    setEditedCharacter(draft => mergeServerUpdate(draft, previousServer, initialCharacter));
  }, [initialCharacter]);

  // Optional: Log when editedCharacter itself changes
  // useEffect(() => {
  //   console.log('[useCharacter] editedCharacter state updated. New Name:', editedCharacter.Name);
  // }, [editedCharacter]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // console.log(`[useCharacter] handleInputChange: ${name} = ${value}`); // Can be noisy
    setEditedCharacter(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // The API call will be handled by the onUpdate callback (Home.tsx's handleUpdateCharacter)
    onUpdate(editedCharacter);
    // Optionally, you might want to move the success toast to Home.tsx after its API call succeeds.
    // For now, let's assume onUpdate will handle feedback or the existing toast in Home.tsx is sufficient.
    // toast({ title: "Character Updated", description: "Your changes have been submitted." }); 
  };

  return { editedCharacter, setEditedCharacter, handleInputChange, handleSubmit };
}