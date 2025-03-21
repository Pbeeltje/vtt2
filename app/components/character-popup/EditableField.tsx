// components/character-popup/EditableField.tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2 } from 'lucide-react';

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  isTextarea?: boolean;
  className?: string;
}

export function EditableField({ value, onChange, isTextarea = false, className }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = () => {
    onChange(tempValue);
    setEditing(false);
  };

  return (
    <div className="flex items-center">
      {editing ? (
        isTextarea ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            className={`mt-1 w-full min-h-[150px] ${className}`}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            className={`mt-1 w-full max-w-xs ${className}`}
          />
        )
      ) : (
        <>
          <span className={`mr-2 ${className}`}>{value}</span>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}