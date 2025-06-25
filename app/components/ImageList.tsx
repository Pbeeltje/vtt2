"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Pencil, Play } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import type { DMImage } from "../types/image"
import type { Character } from "../types/character"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ImageListProps {
  images: DMImage[]
  categories: string[]
  onAddImage: (category: string, file: File) => Promise<void>
  onDeleteImage: (image: DMImage) => Promise<void>
  onDragStart?: (e: React.DragEvent<HTMLLIElement>, image: DMImage) => void
  onSceneClick?: (scene: DMImage) => void
  onDeleteSceneData?: (image: DMImage) => Promise<void>
  onRenameImage?: (image: DMImage, newName: string) => Promise<void>
  onUpdateSceneScale?: (image: DMImage, scale: number) => Promise<void>
  onUpdateSceneBorderSize?: (image: DMImage, borderSize: number) => Promise<void>
  characters?: Character[]
  currentUserRole?: string
  onDropImage?: (category: string, image: DMImage, x: number, y: number) => void
  onMakeSceneActive?: (sceneId: number) => void
}

export default function ImageList({
  images,
  onAddImage,
  onDeleteImage,
  onDragStart,
  onSceneClick,
  onDeleteSceneData,
  onRenameImage,
  onUpdateSceneScale,
  onUpdateSceneBorderSize,
  characters = [],
  currentUserRole,
  onDropImage,
  onMakeSceneActive,
}: ImageListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Scene")
  const [uploading, setUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<DMImage | null>(null)
  const categories = ["Scene", "Image", "Prop"]
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingImage, setEditingImage] = useState<DMImage | null>(null)
  const [newName, setNewName] = useState("")
  const [sceneScale, setSceneScale] = useState(1)
  const [sceneBorderSize, setSceneBorderSize] = useState(0.2) // Default 20% border

  const handleDeleteImage = (image: DMImage) => {
    if (window.confirm(`Are you sure you want to delete ${image.Name}?`)) {
      onDeleteImage(image)
    }
  }

  const handleImageClick = (image: DMImage) => {
    if (image.Category === "Scene") {
      onSceneClick?.(image)
    } else {
      const newSelectedImage = selectedImage?.Id === image.Id ? null : image
      setSelectedImage(newSelectedImage)
    }
  }

  const handleUpload = async (category: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "Error",
            description: "Image size exceeds 5MB limit.",
            variant: "destructive",
          })
          return
        }
        setUploading(true)
        try {
          await onAddImage(category, file)
          toast({
            title: "Image Uploaded",
            description: `${file.name} added to ${category}.`,
          })
        } catch (error) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to upload image.",
            variant: "destructive",
          })
        } finally {
          setUploading(false)
        }
      }
    }
    input.click()
  }

  const handleRenameImage = async (image: DMImage) => {
    if (image.Category === "Scene") {
      // For scenes, open the edit dialog with both name and scale options
      setEditingImage(image)
      setNewName(image.Name)
      
      // Get scale and border size from scene data if it exists
      if (image.SceneData) {
        try {
          const sceneData = JSON.parse(image.SceneData)
          setSceneScale(sceneData.scale || 1)
          setSceneBorderSize(sceneData.borderSize || 0.2)
        } catch (error) {
          setSceneScale(1)
          setSceneBorderSize(0.2)
        }
      } else {
        setSceneScale(1)
        setSceneBorderSize(0.2)
      }
      
      setEditDialogOpen(true)
    } else {
      // For other image types, just prompt for name
      const newName = window.prompt("Enter new name:", image.Name)
      if (newName && newName !== image.Name && onRenameImage) {
        try {
          await onRenameImage(image, newName)
          toast({
            title: "Success",
            description: "Image renamed successfully.",
          })
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to rename image.",
            variant: "destructive",
          })
        }
      }
    }
  }

  const handleSaveSceneEdit = async () => {
    if (!editingImage || !newName) return
    
    try {
      // First rename the image
      if (newName !== editingImage.Name && onRenameImage) {
        await onRenameImage(editingImage, newName)
      }
      
      // Then update the scale if the function is provided
      if (onUpdateSceneScale) {
        await onUpdateSceneScale(editingImage, sceneScale)
      }
      
      // Then update the border size if the function is provided
      if (onUpdateSceneBorderSize) {
        await onUpdateSceneBorderSize(editingImage, sceneBorderSize)
      }
      
      toast({
        title: "Success",
        description: "Scene updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update scene.",
        variant: "destructive",
      })
    } finally {
      setEditDialogOpen(false)
      setEditingImage(null)
    }
  }

  const getNameClass = (name: string) => {
    // Default Tailwind text size is text-base (16px), reduce to text-sm (14px) if long
    return name.length > 10 ? "text-sm break-words" : "text-base"
  }

  const getCategoryStyle = (category: string) => {
    // Implement the logic to determine the style based on the category
    // This is a placeholder and should be replaced with the actual implementation
    return ""
  }

  return (
    <>
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
                      draggable={image.Category !== "Scene"}
                      onDragStart={image.Category !== "Scene" ? (e) => {
                        console.log('ImageList drag start triggered for:', image.Name, image.Category);
                        
                        // Set the data in the format expected by useDragAndDrop
                        const imageData = {
                          imageId: image.Id.toString(),
                          url: image.Link,
                          category: image.Category
                        }
                        
                        console.log('ImageList drag start:', imageData);
                        
                        e.dataTransfer.setData("application/json", JSON.stringify(imageData))
                        
                        // Set effectAllowed to prevent file drag
                        e.dataTransfer.effectAllowed = "copy";
                      } : undefined}
                      onClick={() => handleImageClick(image)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                          <Image
                            src={image.Link || "/placeholder.svg"}
                            alt={image.Name}
                            width={40}
                            height={40}
                            className="object-cover"
                            draggable={false}
                          />
                        </div>
                        <button className="text-left hover:underline" onClick={(e) => {
                          e.stopPropagation();
                          handleImageClick(image);
                        }}>
                          {image.Name}
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {image.Category === "Scene" && onMakeSceneActive && currentUserRole === 'DM' && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              onMakeSceneActive(image.Id);
                            }}
                            className="text-green-500 hover:text-green-700 h-7 w-7"
                            title="Make Active Scene for Players"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        {image.Category === "Scene" && image.SceneData && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm("Are you sure you want to clear this scene's data?")) {
                                onDeleteSceneData?.(image)
                              }
                            }}
                            className="text-blue-500 hover:text-blue-700 h-7 w-7"
                            title="Clear Scene Data"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRenameImage(image)
                          }}
                          title="Rename"
                          className="h-7 w-7"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteImage(image)
                          }}
                          title="Delete Image"
                          className="h-7 w-7"
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Scene</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="scale" className="text-right">
                Scale
              </Label>
              <Input
                id="scale"
                type="number"
                step="0.1"
                value={sceneScale}
                onChange={(e) => {
                  const value = e.target.value
                  const parsedValue = parseFloat(value)
                  setSceneScale(isNaN(parsedValue) ? 0 : parsedValue)
                }}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="borderSize" className="text-right">
                Border Size
              </Label>
              <Input
                id="borderSize"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={sceneBorderSize}
                onChange={(e) => {
                  const value = e.target.value
                  const parsedValue = parseFloat(value)
                  setSceneBorderSize(isNaN(parsedValue) ? 0 : Math.max(0, Math.min(1, parsedValue)))
                }}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <div className="col-span-4 text-sm text-gray-500 text-center">
                Border size is a percentage of the image size (0.2 = 20%) that allows dragging images outside the main grid area.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveSceneEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

