// hooks/useCharacter.ts
import { useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import { Character } from '../types/character';

export function useCharacter(initialCharacter: Character, onUpdate: (updatedCharacter: Character) => void) {
  const [editedCharacter, setEditedCharacter] = useState<Character>(initialCharacter);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
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