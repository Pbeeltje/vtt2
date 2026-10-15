// components/character-popup/StatsTab.tsx
import { Character } from '../../types/character';
import type { Job } from '../../hooks/useJobs';
import { useCharacter } from '../../hooks/useCharacter';
import { EditableField } from './EditableField';
import { FileUploader } from './FileUploader';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StatsTabProps {
  character: Character;
  /** Saves only the given fields. */
  onSave: (changes: Partial<Character>) => unknown;
  jobs: Job[];
}

export function StatsTab({ character, onSave, jobs }: StatsTabProps) {
  const { editedCharacter, setEditedCharacter, changesFrom, resetDraft } = useCharacter(character);

  const handleFieldChange = (name: string, value: string) => {
    setEditedCharacter(prev => ({ ...prev, [name]: value }));
  };

  /** Saves whatever differs from the server, plus `extra` (a value whose state update hasn't landed yet). */
  const saveChanges = (extra: Partial<Character> = {}) => {
    const changes = changesFrom({ ...editedCharacter, ...extra });
    if (Object.keys(changes).length > 0) onSave(changes);
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveChanges();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      resetDraft();
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
          onBlur={() => saveChanges()}
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
              onBlur={() => saveChanges()}
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
        onChange={(e) => {
          handleFieldChange("Path", e.target.value);
          saveChanges({ Path: e.target.value });
        }}
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
      <form onSubmit={(e) => { e.preventDefault(); saveChanges(); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="Name">Name</Label>
              <EditableField
                value={editedCharacter.Name}
                onChange={(value) => setEditedCharacter(prev => ({ ...prev, Name: value }))}
                onSave={(value) => saveChanges({ Name: value })}
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
                onSave={(value) => saveChanges({ Description: value })}
                isTextarea
                markdownDisplay
                className="min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <FileUploader
              imageUrl={editedCharacter.TokenUrl ?? null}
              onUpload={(url) => {
                setEditedCharacter(prev => ({ ...prev, TokenUrl: url }));
                saveChanges({ TokenUrl: url });
              }}
              label="Token"
              width={16}
              height={16}
              isToken
            />
            <FileUploader
              imageUrl={editedCharacter.PortraitUrl ?? null}
              onUpload={(url) => {
                setEditedCharacter(prev => ({ ...prev, PortraitUrl: url }));
                saveChanges({ PortraitUrl: url });
              }}
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

        {jobs.length > 0 ? (
          <div className="pt-2 border-t border-border">
            <Label className="text-xs font-semibold">Jobs</Label>
            <ul className="mt-1.5 space-y-0.5 text-sm">
              {jobs.map((job) => (
                <li key={job.JobId}>
                  <span className="font-medium">{job.Name}</span>
                  <span className="text-muted-foreground"> — Tier {job.Tier}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

      </form>
    </div>
  );
}