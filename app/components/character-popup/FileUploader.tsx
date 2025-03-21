// components/character-popup/FileUploader.tsx
import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Upload } from 'lucide-react';

interface FileUploaderProps {
  imageUrl: string | null;
  onUpload: (url: string) => void;
  label: string;
  width: number;
  height: number;
  isToken?: boolean;
}

export function FileUploader({ imageUrl, onUpload, label, width, height, isToken = false }: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Error", description: "Image size exceeds 5MB.", variant: "destructive" });
        return;
      }
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      try {
        const response = await fetch('/api/imgur-upload', { method: 'POST', body: formData });
        if (!response.ok) throw new Error('Failed to upload image');
        const { url } = await response.json();
        onUpload(url);
        toast({ title: `${label} Uploaded`, description: `${label} uploaded successfully!` });
      } catch (error) {
        console.error(`Error uploading ${label.toLowerCase()}:`, error);
        toast({ title: "Error", description: `Failed to upload ${label.toLowerCase()}.`, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className={`w-${width} h-${height} bg-gray-200 rounded-lg overflow-hidden`}>
        {imageUrl ? (
          uploading ? (
            <div className="w-full h-full flex items-center justify-center text-gray-400">Uploading...</div>
          ) : (
            <Image src={imageUrl} alt={`${label} of character`} width={width * 4} height={height * 4} style={{ objectFit: isToken ? 'cover' : 'contain' }} />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">{`No ${label}`}</div>
        )}
      </div>
      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" ref={fileInputRef} />
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? 'Uploading...' : `Upload ${label}`} <Upload className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}