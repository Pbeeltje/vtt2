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
}

export function StatsTab({ character, onUpdate }: StatsTabProps) {
  const { editedCharacter, setEditedCharacter, handleInputChange, handleSubmit } = useCharacter(character, onUpdate);

  const handleFieldChange = (name: string, value: string) => {
    setEditedCharacter(prev => ({ ...prev, [name]: value }));
  };

  const handleFieldBlur = () => {
    // Save directly to database without opening modal
    fetch(`/api/characters/${character.CharacterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedCharacter),
    }).catch(console.error);
  };

  const handleEditableFieldSave = () => {
    // Save directly to database without opening modal
    fetch(`/api/characters/${character.CharacterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedCharacter),
    }).catch(console.error);
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Save directly to database without opening modal
      fetch(`/api/characters/${character.CharacterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedCharacter),
      }).catch(console.error);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditedCharacter(character);
    }
  };

  const renderField = (label: string, name: string, type: string = "text", maxField?: string, customInputProps?: Record<string, any>) => (
    <div className="space-y-0.5">
      <Label htmlFor={name} className="text-xs font-semibold">{label}</Label>
      <div className="flex items-center space-x-1">
        <Input
          id={name}
          name={name}
          type={type}
          value={editedCharacter[name as keyof Character] ?? ''}
          onChange={(e) => handleFieldChange(name, e.target.value)}
          onBlur={handleFieldBlur}
          onKeyDown={handleFieldKeyDown}
          className={customInputProps?.className || (type === "number" ? "w-14" : "w-full max-w-xs")}
          min={customInputProps?.min ?? (type === "number" ? 0 : undefined)}
          max={customInputProps?.max}
          {...(customInputProps?.inputMode && { inputMode: customInputProps.inputMode })}
          {...(customInputProps?.pattern && { pattern: customInputProps.pattern })}
        />
        {maxField && (
          <>
            <span className="text-xs">/</span>
            <Input
              id={maxField}
              name={maxField}
              type="number"
              value={editedCharacter[maxField as keyof Character] ?? ''}
              onChange={(e) => handleFieldChange(maxField, e.target.value)}
              onBlur={handleFieldBlur}
              onKeyDown={handleFieldKeyDown}
              className="w-14"
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
        onChange={(e) => handleFieldChange("Path", e.target.value)}
        onBlur={handleFieldBlur}
        onKeyDown={handleFieldKeyDown}
        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <option value="Warrior">Warrior</option>
        <option value="Magic User">Magic User</option>
      </select>
    </div>
  );

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="Name">Name</Label>
              <EditableField
                value={editedCharacter.Name}
                onChange={(value) => setEditedCharacter(prev => ({ ...prev, Name: value }))}
                onSave={handleEditableFieldSave}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {renderField("Level", "Level", "number")}
              {renderField("Age", "Age", "number", undefined, { className: "w-20", max: undefined, inputMode: "numeric", pattern: "[0-9]*" })}
              {renderPathField()}
            </div>
            <div>
              <Label htmlFor="Description">Description</Label>
              <EditableField
                value={editedCharacter.Description || ''}
                onChange={(value) => setEditedCharacter(prev => ({ ...prev, Description: value }))}
                onSave={handleEditableFieldSave}
                isTextarea
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <FileUploader
              imageUrl={editedCharacter.TokenUrl ?? null}
              onUpload={(url) => setEditedCharacter(prev => ({ ...prev, TokenUrl: url }))}
              label="Token"
              width={16}
              height={16}
              isToken
            />
            <FileUploader
              imageUrl={editedCharacter.PortraitUrl ?? null}
              onUpload={(url) => setEditedCharacter(prev => ({ ...prev, PortraitUrl: url }))}
              label="Portrait"
              width={64}
              height={64}
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {renderField("Guard", "Guard", "number", "MaxGuard")}
          {renderField("Armor", "Armor", "number")}
          {renderField("Strength", "Strength", "number", "MaxStrength")}
          {renderField("Dexterity", "Dexternity", "number", "MaxDexternity")}
          {renderField("Mind", "Mind", "number", "MaxMind")}
          {renderField("Charisma", "Charisma", "number", "MaxCharisma")}
          {editedCharacter.Path === "Warrior" && renderField("Skill", "Skill", "number", "MaxSkill")}
          {editedCharacter.Path === "Magic User" && renderField("Spellcraft", "Skill", "number", "MaxSkill")}
          {editedCharacter.Path === "Magic User" && renderField("MP", "Mp", "number", "MaxMp")}
        </div>

      </form>
    </div>
  );
}