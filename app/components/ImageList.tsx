"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import type { DMImage } from "../types/image"
import type { Character } from "../types/character"

interface ImageListProps {
  images: DMImage[]
  categories: string[]
  onAddImage: (category: string, file: File) => Promise<void>
  onDeleteImage: (image: DMImage) => Promise<void>
  onDragStart?: (e: React.DragEvent<HTMLLIElement>, image: DMImage) => void
  onSceneClick?: (url: string) => void
  onDeleteSceneData?: (image: DMImage) => Promise<void>
  characters?: Character[]
}

export default function ImageList({
  images,
  onAddImage,
  onDeleteImage,
  onDragStart,
  onSceneClick,
  onDeleteSceneData,
  characters = [],
}: ImageListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Scene")
  const [uploading, setUploading] = useState(false)
  const categories = ["Scene", "Image", "Token"]

  const handleDeleteImage = (image: DMImage) => {
    if (window.confirm(`Are you sure you want to delete ${image.Name}?`)) {
      onDeleteImage(image)
    }
  }

  const handleImageClick = (image: DMImage) => {
    if (image.Category === "Scene" && onSceneClick) {
      onSceneClick(image.Link)
    }
  }

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
            description: error instanceof Error ? error.message : "Failed to upload image.",
            variant: "destructive",
          });
        } finally {
          setUploading(false);
        }
      }
    };
    input.click();
  };

  const getNameClass = (name: string) => {
    // Default Tailwind text size is text-base (16px), reduce to text-sm (14px) if long
    return name.length > 10 ? "text-sm break-words" : "text-base"
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
          <ScrollArea className="h-[calc(100vh-250px)]">
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
            <ul className="space-y-2 mt-4">
              {images
                .filter((img) => img.Category === category)
                .map((image) => (
                  <li
                    key={image.Id}
                    className="flex items-center justify-between p-2 bg-white rounded-lg shadow"
                    draggable={category !== "Scene"}
                    onDragStart={(e) => onDragStart?.(e, image)}
                    onClick={() => handleImageClick(image)}
                  >
                    <div className="flex items-center space-x-2 flex-grow">
                      <Image
                        src={image.Link || "/placeholder.svg"}
                        alt={image.Category === "Token" && image.CharacterId 
                          ? characters.find(c => c.CharacterId === image.CharacterId)?.Name || image.Name
                          : image.Name}
                        width={40}
                        height={40}
                        objectFit="cover"
                      />
                      <span className={`${getNameClass(image.Name)} max-w-[150px]`}>{image.Name}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      {image.Category === "Scene" && image.SceneData && onDeleteSceneData && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSceneData(image);
                          }}
                          className="text-blue-500 hover:text-blue-700"
                          title="Delete Scene Contents"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
            </ul>
          </ScrollArea>
        </TabsContent>
      ))}
    </Tabs>
  )
}