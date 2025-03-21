// components/character-popup/CharacterPopup.tsx
'use client'

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from 'lucide-react';
import { Character } from '../../types/character';
import { StatsTab } from './StatsTab';
import { JobsTab } from './JobsTab';
import { InventoryTab } from './InventoryTab';

interface CharacterPopupProps {
  character: Character;
  onClose: () => void;
  onUpdate: (updatedCharacter: Character) => void;
}

export default function CharacterPopup({ character, onClose, onUpdate }: CharacterPopupProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white p-6 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-[101]" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={onClose}><X className="h-4 w-4" /></Button>
        <Tabs defaultValue="stats" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="stats">
            <StatsTab character={character} onUpdate={onUpdate} onClose={onClose} />
          </TabsContent>
          <TabsContent value="jobs">
            <JobsTab characterId={character.CharacterId} />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab characterId={character.CharacterId} maxStrength={character.MaxStrength || 0} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}