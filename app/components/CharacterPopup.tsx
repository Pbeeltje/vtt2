'use client'

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { X, Edit2, Upload } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { Character } from '../types/character';

interface CharacterPopupProps {
  character: Character;
  onClose: () => void;
  onUpdate: (updatedCharacter: Character) => void;
}

interface Job {
  JobId: number;
  Name: string;
  Description: string | null;
  Tier: number;
  CharacterId: number;
}

export default function CharacterPopup({ character, onClose, onUpdate }: CharacterPopupProps) {
  const [editedCharacter, setEditedCharacter] = useState<Character>(character);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingToken, setUploadingToken] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tokenFileInputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [newJobName, setNewJobName] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedCharacter(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting character with Path:", editedCharacter.Path);
    try {
      const response = await fetch(`/api/characters/${character.CharacterId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedCharacter),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update character');
      }
      const updatedCharacter = await response.json();
      console.log("Character updated successfully:", updatedCharacter);
      onUpdate(updatedCharacter);
      toast({
        title: "Character Updated",
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      console.error('Error updating character:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update character. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
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

  const handleTokenFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Error",
          description: "Image size exceeds 5MB limit. Please choose a smaller file.",
          variant: "destructive",
        });
        return;
      }

      setUploadingToken(true);
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
        setEditedCharacter(prev => ({ ...prev, TokenUrl: url }));

        toast({
          title: "Token Uploaded",
          description: "Your character's token has been uploaded successfully. Don't forget to save your changes!",
        });
      } catch (error) {
        console.error('Error uploading token:', error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload token. Please try again.",
          variant: "destructive",
        });
      } finally {
        setUploadingToken(false);
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
  );

  const renderPathField = () => (
    <div className="space-y-1">
      <Label htmlFor="Path">Path</Label>
      <select
        id="Path"
        name="Path"
        value={editedCharacter.Path || "Warrior"}
        onChange={(e) => {
          console.log("Path changed to:", e.target.value);
          setEditedCharacter(prev => ({ ...prev, Path: e.target.value }));
        }}
        className="w-full max-w-xs h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="Warrior">Warrior</option>
        <option value="Magic User">Magic User</option>
      </select>
    </div>
  );

  const handleEditClick = (e: React.MouseEvent, field: 'name' | 'description') => {
    e.stopPropagation();
    if (field === 'name') setEditingName(true);
    if (field === 'description') setEditingDescription(true);
  };

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await fetch(`/api/characters/${character.CharacterId}/jobs`);
        if (!response.ok) {
          throw new Error(`Failed to fetch jobs: ${response.statusText}`);
        }
        const data: Job[] = await response.json();
        setJobs(data);
      } catch (error: any) {
        console.error("Error fetching jobs:", error);
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to fetch jobs. Please try again.",
          variant: "destructive",
        });
      }
    };
    fetchJobs();
  }, [character.CharacterId]);

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName) {
      toast({
        title: "Error",
        description: "Job name is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/characters/${character.CharacterId}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newJobName, description: null, tier: 1 }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add job: ${response.statusText}`);
      }

      const newJob: Job = await response.json();
      setJobs([...jobs, newJob]);
      setNewJobName('');

      toast({
        title: "Job Added",
        description: `${newJob.Name} has been added successfully.`,
      });
    } catch (error: any) {
      console.error("Error adding job:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add job. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white p-6 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-[101]" // Increased max-w-2xl to max-w-3xl
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <Tabs
          defaultValue="stats"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onMouseUp={e => e.stopPropagation()}
        >
          <TabsList>
            <TabsTrigger value="stats">Stats</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>
          <TabsContent value="stats" className="min-h-[500px]">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column: Name, Level + Age, Description */}
                <div className="space-y-6">
                  {/* Name */}
                  <div>
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

                  {/* Level and Age */}
                  <div className="grid grid-cols-2 gap-4">
                    {renderField("Level", "Level", "number")}
                    {renderField("Age", "Age", "number")}
                  </div>

                  {/* Description */}
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
                          className="mt-1 w-full min-h-[150px]"
                          autoFocus
                        />
                      ) : (
                        <>
                          <p className="mr-2 min-h-[150px]">{editedCharacter.Description}</p>
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

                {/* Right Column: Portrait and Token */}
                <div className="space-y-6">
                  {/* Portrait */}
                  <div className="flex flex-col items-center">
                    <div className="w-50 h-50 bg-gray-200 rounded-lg overflow-hidden">
                      {editedCharacter.PortraitUrl ? (
                        uploading ? (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            Uploading...
                          </div>
                        ) : (
                          <Image
                            src={editedCharacter.PortraitUrl || "/placeholder.svg"}
                            alt={`Portrait of ${editedCharacter.Name}`}
                            width={250}
                            height={250}
                            style={{ objectFit: 'contain' }}
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

                  {/* Token */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden">
                      {editedCharacter.TokenUrl ? (
                        uploadingToken ? (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            Uploading...
                          </div>
                        ) : (
                          <Image
                            src={editedCharacter.TokenUrl}
                            alt={`Token of ${editedCharacter.Name}`}
                            width={64}
                            height={64}
                            style={{ objectFit: 'cover' }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          No Token
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleTokenFileChange}
                      className="hidden"
                      ref={tokenFileInputRef}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => tokenFileInputRef.current?.click()}
                      disabled={uploadingToken}
                    >
                      {uploadingToken ? 'Uploading...' : 'Upload Token'}
                      <Upload className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Path */}
              {renderPathField()}

              {/* Guard and Armor */}
              <div className="grid grid-cols-2 gap-4">
                {renderField("Guard", "Guard", "number", "MaxGuard")}
                {renderField("Armor", "Armor", "number")}
              </div>

              {/* Remaining Stats */}
              <div className="grid grid-cols-2 gap-4">
                {renderField("Strength", "Strength", "number", "MaxStrength")}
                {renderField("Dexterity", "Dexternity", "number", "MaxDexternity")}
                {renderField("Mind", "Mind", "number", "MaxMind")}
                {renderField("Charisma", "Charisma", "number", "MaxCharisma")}
                {editedCharacter.Path === "Warrior" && renderField("Skill", "Skill", "number", "MaxSkill")}
                {editedCharacter.Path === "Magic User" && renderField("MP", "Mp", "number", "MaxMp")}
              </div>

              {/* Save/Cancel Buttons */}
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
          <TabsContent value="jobs" className="min-h-[500px]">
            <div className="space-y-4">
              {jobs.length > 0 ? (
                <ul>
                  {jobs.map((job) => (
                    <li key={job.JobId}>
                      {job.Name} - {job.Description} (Tier {job.Tier})
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Jobless..</p>
              )}
              <form onSubmit={handleAddJob} className="mt-4">
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder="New Job Name"
                    value={newJobName}
                    onChange={(e) => setNewJobName(e.target.value)}
                    className="w-full max-w-xs"
                  />
                  <Button type="submit" size="sm">
                    Add Job
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
          <TabsContent value="inventory" className="min-h-[500px]">
            <div className="space-y-4">
              <p>Inventory information coming soon...</p>
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>Under construction - Check back later!</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}