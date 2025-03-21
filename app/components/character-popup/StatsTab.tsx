// components/character-popup/StatsTab.tsx
import { Character } from '../../types/character';
import { useCharacter } from '../../hooks/useCharacter';
import { EditableField } from './EditableField';
import { FileUploader } from './FileUploader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StatsTabProps {
  character: Character;
  onUpdate: (updatedCharacter: Character) => void;
  onClose: () => void;
}

export function StatsTab({ character, onUpdate, onClose }: StatsTabProps) {
  const { editedCharacter, setEditedCharacter, handleInputChange, handleSubmit } = useCharacter(character, onUpdate);

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
        onChange={handleInputChange}
        className="w-full max-w-xs h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="Warrior">Warrior</option>
        <option value="Magic User">Magic User</option>
      </select>
    </div>
  );

  return (
    <div className="min-h-[500px]">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-6">
            <div>
              <Label htmlFor="Name">Name</Label>
              <EditableField
                value={editedCharacter.Name}
                onChange={(value) => setEditedCharacter(prev => ({ ...prev, Name: value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {renderField("Level", "Level", "number")}
              {renderField("Age", "Age", "number")}
            </div>
            <div>
              <Label htmlFor="Description">Description</Label>
              <EditableField
                value={editedCharacter.Description || ''}
                onChange={(value) => setEditedCharacter(prev => ({ ...prev, Description: value }))}
                isTextarea
                className="min-h-[150px]"
              />
            </div>
          </div>
          <div className="space-y-6">
            <FileUploader
              imageUrl={editedCharacter.PortraitUrl ?? null}
              onUpload={(url) => setEditedCharacter(prev => ({ ...prev, PortraitUrl: url }))}
              label="Portrait"
              width={50}
              height={50}
            />
            <FileUploader
              imageUrl={editedCharacter.TokenUrl ?? null}
              onUpload={(url) => setEditedCharacter(prev => ({ ...prev, TokenUrl: url }))}
              label="Token"
              width={16}
              height={16}
              isToken
            />
          </div>
        </div>
        {renderPathField()}
        <div className="grid grid-cols-2 gap-4">
          {renderField("Guard", "Guard", "number", "MaxGuard")}
          {renderField("Armor", "Armor", "number")}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {renderField("Strength", "Strength", "number", "MaxStrength")}
          {renderField("Dexterity", "Dexternity", "number", "MaxDexternity")}
          {renderField("Mind", "Mind", "number", "MaxMind")}
          {renderField("Charisma", "Charisma", "number", "MaxCharisma")}
          {editedCharacter.Path === "Warrior" && renderField("Skill", "Skill", "number", "MaxSkill")}
          {editedCharacter.Path === "Magic User" && renderField("MP", "Mp", "number", "MaxMp")}
        </div>
        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </div>
  );
}