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
    try {
      const response = await fetch(`/api/characters/${editedCharacter.CharacterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedCharacter),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update character');
      }
      const updatedCharacter = await response.json();
      onUpdate(updatedCharacter);
      toast({ title: "Character Updated", description: "Your changes have been saved successfully." });
    } catch (error) {
      console.error('Error updating character:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character.",
        variant: "destructive",
      });
    }
  };

  return { editedCharacter, setEditedCharacter, handleInputChange, handleSubmit };
}