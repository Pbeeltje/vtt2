// components/character-popup/useImageUpload.ts
import { useRef, useState } from 'react';
import { toast } from "@/components/ui/use-toast";

/**
 * Uploads a picked image to the library and hands back its URL. Render `input` somewhere and
 * call `pick()` from a button.
 */
export function useImageUpload(label: string, onUpload: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Error", description: "Image size exceeds 5MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'Image');
    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData, credentials: 'include' });
      if (!response.ok) throw new Error('Failed to upload image');
      const row = await response.json();
      onUpload(row.Link as string);
      toast({ title: `${label} uploaded` });
    } catch (error) {
      console.error(`Error uploading ${label.toLowerCase()}:`, error);
      toast({ title: "Error", description: `Failed to upload ${label.toLowerCase()}.`, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const input = <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={inputRef} />;
  return { uploading, pick: () => inputRef.current?.click(), input };
}
