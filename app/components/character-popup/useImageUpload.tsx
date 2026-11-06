// components/character-popup/useImageUpload.ts
import { useRef, useState } from 'react';
import { toast } from "@/components/ui/use-toast";
import { api, errorMessage } from "../../lib/api";
import type { DMImage } from "../../types/image";

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
      const image = await api<DMImage>('/api/images', { method: 'POST', body: formData });
      onUpload(image.Link);
      toast({ title: `${label} uploaded` });
    } catch (error) {
      toast({ title: `Couldn't upload the ${label.toLowerCase()}`, description: errorMessage(error), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const input = <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={inputRef} />;
  return { uploading, pick: () => inputRef.current?.click(), input };
}
