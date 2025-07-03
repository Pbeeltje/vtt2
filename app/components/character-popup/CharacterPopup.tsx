// components/character-popup/CharacterPopup.tsx
'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X } from 'lucide-react';
import { Character } from '../../types/character';
import type { User } from '../../types/user';
import { StatsTab } from './StatsTab';
import { JobsTab } from './JobsTab';
import { InventoryTab } from './InventoryTab';
import { toast } from "@/components/ui/use-toast";

interface CharacterPopupProps {
  character: Character;
  onClose: () => void;
  onUpdate: (updatedCharacter: Character) => void;
  isDM: boolean;
  allUsers?: User[];
}

export default function CharacterPopup({ character, onClose, onUpdate, isDM, allUsers }: CharacterPopupProps) {
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState<number | ''>( '');

  const handleAssignCharacter = async () => {
    if (selectedUserIdToAssign === '') { 
      toast({ title: "Selection Required", description: "Please select a user to assign the character to.", variant: "destructive" });
      return;
    }

    if (!character) {
      toast({ title: "Error", description: "No character data found.", variant: "destructive" });
      return;
    }

    const updatedCharacter = {
      ...character,
      userId: selectedUserIdToAssign as number, 
    };

    try {
      await onUpdate(updatedCharacter);
      setSelectedUserIdToAssign(''); 
    } catch (error) {
      console.error("Error assigning character:", error);
      toast({ title: "Error", description: "Failed to assign character.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]">
      <div className="bg-white p-6 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-[101]" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="absolute top-2 right-2" onClick={onClose}><X className="h-4 w-4" /></Button>
        <Tabs defaultValue="stats" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            {isDM && <TabsTrigger value="options">Options</TabsTrigger>}
          </TabsList>
          <TabsContent value="stats">
            <StatsTab character={character} onUpdate={onUpdate} />
          </TabsContent>
          <TabsContent value="jobs">
            <JobsTab characterId={character.CharacterId} />
          </TabsContent>
          <TabsContent value="inventory">
            <InventoryTab characterId={character.CharacterId} maxStrength={character.MaxStrength || 0} />
          </TabsContent>
          {isDM && (
            <TabsContent value="options">
              <div className="min-h-[500px] p-4 space-y-4">
                <h3 className="text-lg font-semibold">Assign Character to User</h3>
                <div>
                  <label htmlFor="user-assign-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Select User:
                  </label>
                  <div className="flex items-center space-x-2">
                    <select
                      id="user-assign-select"
                      value={selectedUserIdToAssign}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedUserIdToAssign(value === "" ? "" : Number(value));
                      }}
                      className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    >
                      <option key="default" value="">-- Select a User --</option>
                      {allUsers && allUsers.filter(u => u.role !== 'DM').map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.username} ({user.role})
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={handleAssignCharacter}
                      disabled={selectedUserIdToAssign === ''}
                      className="whitespace-nowrap"
                    >
                      Assign to User
                    </Button>
                  </div>
                </div>
                {character.userId !== null && character.userId !== undefined && (() => {
                  let assignedToText = `User ID: ${character.userId}`;
                  const assignedUser = allUsers?.find(u => u.id === character.userId);

                  if (assignedUser) {
                    assignedToText = `${assignedUser.username} (User ID: ${character.userId})`;
                    if (assignedUser.role === 'DM') {
                      assignedToText += ' (DM)';
                    }
                  } else if (allUsers && Array.isArray(allUsers) && allUsers.length > 0) {
                    assignedToText = `Unknown User (User ID: ${character.userId})`;
                  } else if (!allUsers || (Array.isArray(allUsers) && allUsers.length === 0)) {
                    assignedToText = `User ID: ${character.userId} (User details pending/unavailable)`;
                  }

                  return (
                    <p className="text-sm text-gray-600">
                      Currently assigned to: {assignedToText}
                    </p>
                  );
                })()}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}