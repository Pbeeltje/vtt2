"use client"

import { memo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Pencil, Play } from "lucide-react"
import { toast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DEFAULT_BORDER_SIZE, parseSceneData } from "@/lib/scene-model"
import type { DMImage } from "../types/image"

const CATEGORIES = ["Scene", "Image", "Prop"] as const
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

interface ImageListProps {
  images: DMImage[]
  /** Scenes with their latest saved data (the image list's copy can be stale). */
  scenes: DMImage[]
  onUploadImage: (category: string, file: File) => Promise<unknown>
  onDeleteImage: (image: DMImage) => Promise<void>
  onRenameImage: (image: DMImage, newName: string) => Promise<void>
  onSceneClick: (scene: DMImage) => void
  onClearSceneData: (image: DMImage) => Promise<void>
  onUpdateSceneSettings: (image: DMImage, settings: { scale: number; borderSize: number }) => Promise<boolean>
  onMakeSceneActive: (sceneId: number) => void
  activeSceneId: number | null
}

function ImageList({
  images,
  scenes,
  onUploadImage,
  onDeleteImage,
  onRenameImage,
  onSceneClick,
  onClearSceneData,
  onUpdateSceneSettings,
  onMakeSceneActive,
  activeSceneId,
}: ImageListProps) {
  const [activeCategory, setActiveCategory] = useState<string>("Scene")
  const [uploading, setUploading] = useState(false)
  const [editingScene, setEditingScene] = useState<DMImage | null>(null)
  const [newName, setNewName] = useState("")
  const [sceneScale, setSceneScale] = useState(1)
  const [sceneBorderSize, setSceneBorderSize] = useState(DEFAULT_BORDER_SIZE)

  const sceneData = (image: DMImage) => scenes.find((s) => s.Id === image.Id)?.SceneData ?? image.SceneData

  const handleUpload = (category: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/gif,image/webp"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > MAX_UPLOAD_BYTES) {
        toast({ title: "Image too large", description: "Images can be at most 5 MB.", variant: "destructive" })
        return
      }
      setUploading(true)
      try {
        if (await onUploadImage(category, file)) {
          toast({ title: "Image uploaded", description: `${file.name} added to ${category}.` })
        }
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  const handleRename = async (image: DMImage) => {
    if (image.Category === "Scene") {
      const state = parseSceneData(sceneData(image))
      setEditingScene(image)
      setNewName(image.Name)
      setSceneScale(state.scale)
      setSceneBorderSize(state.borderSize)
      return
    }
    const name = window.prompt("Enter new name:", image.Name)
    if (name && name.trim() && name !== image.Name) {
      await onRenameImage(image, name).catch(() => {})
    }
  }

  const handleSaveSceneEdit = async () => {
    const scene = editingScene
    if (!scene || !newName.trim()) return
    if (!(sceneScale > 0)) {
      toast({ title: "Invalid scale", description: "Scale must be greater than 0.", variant: "destructive" })
      return
    }
    try {
      if (newName.trim() !== scene.Name) await onRenameImage(scene, newName)
      const current = parseSceneData(sceneData(scene))
      if (sceneScale !== current.scale || sceneBorderSize !== current.borderSize) {
        if (!(await onUpdateSceneSettings(scene, { scale: sceneScale, borderSize: sceneBorderSize }))) return
      }
      toast({ title: "Scene updated" })
      setEditingScene(null)
    } catch {
      // The failed step already showed its own message.
    }
  }

  return (
    <>
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="grid w-full grid-cols-3">
          {CATEGORIES.map((category) => (
            <TabsTrigger key={category} value={category}>
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((category) => (
          <TabsContent key={category} value={category}>
            <ScrollArea className="h-[calc(100vh-250px)]">
              <Button variant="outline" size="sm" className="mt-4" onClick={() => handleUpload(category)} disabled={uploading}>
                {uploading ? "Uploading..." : (<><Plus className="w-4 h-4 mr-2" /> Add {category}</>)}
              </Button>
              <ul className="space-y-2 mt-4">
                {images
                  .filter((img) => img.Category === category)
                  .map((image) => {
                    const isScene = image.Category === "Scene"
                    const isActive = isScene && image.Id === activeSceneId
                    return (
                      <li
                        key={image.Id}
                        className={`flex items-center justify-between p-2 bg-white rounded-lg shadow ${isActive ? "ring-2 ring-green-500" : ""}`}
                        draggable={!isScene}
                        onDragStart={
                          isScene
                            ? undefined
                            : (e) => {
                                e.dataTransfer.setData("application/json", JSON.stringify({ imageId: image.Id.toString(), url: image.Link, category: image.Category }))
                                e.dataTransfer.effectAllowed = "copy"
                              }
                        }
                        onClick={() => isScene && onSceneClick(image)}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden">
                            <Image src={image.Link || "/placeholder.svg"} alt={image.Name} width={40} height={40} className="object-cover" draggable={false} />
                          </div>
                          <span className={`text-left ${isScene ? "hover:underline cursor-pointer" : ""} ${image.Name.length > 10 ? "text-sm break-words" : "text-base"}`}>
                            {image.Name}
                            {isActive && <span className="ml-2 text-xs text-green-700">(active)</span>}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {isScene && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                onMakeSceneActive(image.Id)
                              }}
                              className="text-green-500 hover:text-green-700 h-7 w-7"
                              title="Make active scene for players"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {isScene && sceneData(image) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm("Clear this scene's tokens, images, fog and grid settings?")) void onClearSceneData(image)
                              }}
                              className="text-blue-500 hover:text-blue-700 h-7 w-7"
                              title="Clear scene data"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRename(image)
                            }}
                            title={isScene ? "Edit scene" : "Rename"}
                            className="h-7 w-7"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (window.confirm(`Are you sure you want to delete ${image.Name}?`)) void onDeleteImage(image)
                            }}
                            title="Delete image"
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
              </ul>
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={editingScene !== null} onOpenChange={(open) => !open && setEditingScene(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Scene</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="scale" className="text-right">Scale</Label>
              <Input
                id="scale"
                type="number"
                step="0.1"
                min="0.1"
                value={sceneScale}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setSceneScale(isNaN(value) ? 0 : value)
                }}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="borderSize" className="text-right">Border Size</Label>
              <Input
                id="borderSize"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={sceneBorderSize}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setSceneBorderSize(isNaN(value) ? 0 : Math.max(0, Math.min(1, value)))
                }}
                className="col-span-3"
              />
            </div>
            <div className="col-span-4 text-sm text-gray-500 text-center">
              Changing the scale moves tokens, images, fog and drawings with the map. Border size is a fraction of the
              image size (0.2 = 20%) that lets you place things outside the map.
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

export default memo(ImageList)
