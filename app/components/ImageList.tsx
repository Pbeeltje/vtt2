"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import type { DMImage } from "../types/image";

interface ImageListProps {
  images: DMImage[];
  categories: string[];
  onAddImage: (category: string, file: File) => Promise<void>;
  onDeleteImage: (image: DMImage) => Promise<void>;
}

export default function ImageList({
  images,
  onAddImage,
  onDeleteImage,
}: ImageListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Scene");
  const [uploading, setUploading] = useState(false);
  const categories = ["Scene", "Image", "Token"];

  const handleDeleteImage = (image: DMImage) => {
    if (window.confirm(`Are you sure you want to delete ${image.Name}?`)) {
      onDeleteImage(image);
    }
  };

  const handleUpload = async (category: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Error",
            description: "Image size exceeds 5MB limit.",
            variant: "destructive",
          });
          return;
        }
        setUploading(true);
        try {
          await onAddImage(category, file);
          toast({
            title: "Image Uploaded",
            description: `${file.name} added to ${category}.`,
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to upload image.",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  };

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
      <TabsList className="grid w-full grid-cols-3">
        {categories.map((category) => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      {categories.map((category) => (
        <TabsContent key={category} value={category}>
          <ScrollArea className="h-[calc(100vh-250px)] pr-4">
            <ul className="space-y-2">
              {images
                .filter((image) => image.Category === category)
                .map((image) => (
                  <li
                    key={image.Id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                        {image.Link ? (
                          <Image
                            src={image.Link}
                            alt={image.Name}
                            width={48}
                            height={48}
                            objectFit="cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            No Image
                          </div>
                        )}
                      </div>
                      <span>{image.Name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteImage(image)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => handleUpload(category)}
              disabled={uploading}
            >
              {uploading ? (
                "Uploading..."
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" /> Add {category}
                </>
              )}
            </Button>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  );
}