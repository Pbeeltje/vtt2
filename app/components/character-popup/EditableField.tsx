// components/character-popup/EditableField.tsx
import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit2 } from 'lucide-react';
import { MarkdownContent } from '@/components/MarkdownContent';
import { cn } from '@/lib/utils';

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  isTextarea?: boolean;
  className?: string;
  /** When set, non-edit view renders markdown instead of plain text. */
  markdownDisplay?: boolean;
}

export function EditableField({ value, onChange, onSave, isTextarea = false, className, markdownDisplay = false }: EditableFieldProps) {
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
    if (onSave) {
      onSave(tempValue);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isTextarea) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="flex items-start gap-1">
      {editing ? (
        isTextarea ? (
          <Textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={`mt-1 w-full min-h-[150px] ${className}`}
          />
        ) : (
          <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className={`mt-1 w-full max-w-xs ${className}`}
          />
        )
      ) : (
        <>
          <div className={cn('mr-2 min-w-0 flex-1', className)}>
            {markdownDisplay ? (
              value.trim() ? (
                <MarkdownContent markdown={value} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            ) : (
              <span>{value}</span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
            <Edit2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}