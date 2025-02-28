'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "@/components/ui/use-toast"
import { X, Edit2, Upload } from 'lucide-react'
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Character } from '../types/character'

interface CharacterPopupProps {
  character: Character
  onClose: () => void
  onUpdate: (updatedCharacter: Character) => void
}

export default function CharacterPopup({ character, onClose, onUpdate }: CharacterPopupProps) {
  const [editedCharacter, setEditedCharacter] = useState<Character>(character)
  const [editingName, setEditingName] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEditedCharacter(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch(`/api/characters/${character.CharacterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedCharacter),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update character')
      }
      const updatedCharacter = await response.json()
      onUpdate(updatedCharacter)
      toast({
        title: "Character Updated",
        description: "Your changes have been saved successfully.",
      })
    } catch (error) {
      console.error('Error updating character:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (5MB = 5 * 1024 * 1024 bytes)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size exceeds 5MB limit. Please choose a smaller file.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/imgur-upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to upload image: ${errorData.error || response.statusText}`);
        }

        const { url } = await response.json();
        
        setEditedCharacter(prev => ({ ...prev, PortraitUrl: url }));

        toast({
          title: "Portrait Uploaded",
          description: "Your character's portrait has been uploaded successfully. Don't forget to save your changes!",
        });
      } catch (error) {
        console.error('Error uploading portrait:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload portrait. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    }
  };

  const renderField = (label: string, name: string, type: string = "text", maxField?: string) => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center space-x-2">
        <Input
          id={name}
          name={name}
          type={type}
          value={editedCharacter[name as keyof Character] ?? ''}
          onChange={handleInputChange}
          className={type === "number" ? "w-16" : "w-full max-w-xs"}
          {...(type === "number" ? { min: 0, max: 99 } : {})}
        />
        {maxField && (
          <>
            <span>/</span>
            <Input
              id={maxField}
              name={maxField}
              type="number"
              value={editedCharacter[maxField as keyof Character] ?? ''}
              onChange={handleInputChange}
              className="w-16"
              min={0}
              max={99}
            />
          </>
        )}
      </div>
    </div>
  )

  const renderPathField = () => (
    <div className="space-y-1">
      <Label htmlFor="Path">Path</Label>
      <Select
        value={editedCharacter.Path}
        onValueChange={(value) => setEditedCharacter(prev => ({ ...prev, Path: value }))}
      >
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue placeholder="Select a path" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Warrior">Warrior</SelectItem>
          <SelectItem value="Magic User">Magic User</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const handleEditClick = (e: React.MouseEvent, field: 'name' | 'description') => {
    e.stopPropagation()
    if (field === 'name') setEditingName(true)
    if (field === 'description') setEditingDescription(true)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="stats">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="flex-grow">
                  <div className="flex items-center space-x-4">
                    <div className="flex-grow">
                      <Label htmlFor="Name">Name</Label>
                      <div className="flex items-center">
                        {editingName ? (
                          <Input
                            id="Name"
                            name="Name"
                            value={editedCharacter.Name}
                            onChange={handleInputChange}
                            onBlur={() => setEditingName(false)}
                            className="mt-1 w-full max-w-xs"
                            autoFocus
                          />
                        ) : (
                          <>
                            <span className="mr-2">{editedCharacter.Name}</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={(e) => handleEditClick(e, 'name')}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {renderField("Level", "Level", "number")}
                    {renderField("Age", "Age", "number")}
                  </div>
                  <div>
                    <Label htmlFor="Description">Description</Label>
                    <div className="flex items-start">
                      {editingDescription ? (
                        <Textarea
                          id="Description"
                          name="Description"
                          value={editedCharacter.Description}
                          onChange={handleInputChange}
                          onBlur={() => setEditingDescription(false)}
                          className="mt-1 w-full h-32"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="mr-2">{editedCharacter.Description}</p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => handleEditClick(e, 'description')}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 bg-gray-200 rounded-lg overflow-hidden">
                    {editedCharacter.PortraitUrl ? (
                      uploading ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          Uploading...
                        </div>
                      ) : (
                        <Image
                          src={editedCharacter.PortraitUrl || "/placeholder.svg"}
                          alt={`Portrait of ${editedCharacter.Name}`}
                          width={128}
                          height={128}
                          objectFit="cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Upload Portrait'}
                    <Upload className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {renderPathField()}
              <div className="flex space-x-2">
                {renderField("Guard", "Guard", "number", "MaxGuard")}
                {renderField("Armor", "Armor", "number")}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-4">
                {renderField("Strength", "Strength", "number", "MaxStrength")}
                {renderField("Dexterity", "Dexternity", "number", "MaxDexternity")}
                {renderField("Mind", "Mind", "number", "MaxMind")}
                {renderField("Charisma", "Charisma", "number", "MaxCharisma")}
              </div>
              {editedCharacter.Path === "Warrior" && renderField("Skill", "Skill", "number", "MaxSkill")}
              {editedCharacter.Path === "Magic User" && renderField("MP", "Mp", "number", "MaxMp")}

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Save
                </Button>
              </div>
            </form>
          </TabsContent>
          <TabsContent value="jobs">
            <p>Job information coming soon...</p>
          </TabsContent>
          <TabsContent value="inventory">
            <p>Inventory information coming soon...</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

