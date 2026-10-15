"use client"

import { useCallback, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { api, errorMessage } from "../lib/api"
import type { DMImage } from "../types/image"
import type { User } from "../types/user"

/** DM-only data: the image library (maps, tokens, props) and the list of user accounts. */
export function useDmLibrary() {
  const [images, setImages] = useState<DMImage[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])

  const loadImages = useCallback(async () => {
    try {
      setImages(await api<DMImage[]>("/api/images"))
    } catch (error) {
      toast({ title: "Images not loaded", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      setAllUsers(await api<User[]>("/api/users"))
    } catch (error) {
      toast({ title: "Users not loaded", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  /** Uploads an image; returns it, or null if the upload failed (already reported). */
  const uploadImage = useCallback(async (category: string, file: File): Promise<DMImage | null> => {
    const form = new FormData()
    form.append("file", file)
    form.append("category", category)
    try {
      const image = await api<DMImage>("/api/images", { method: "POST", body: form })
      setImages((prev) => [...prev, image])
      return image
    } catch (error) {
      toast({ title: "Upload failed", description: errorMessage(error), variant: "destructive" })
      return null
    }
  }, [])

  const deleteImage = useCallback(async (image: DMImage) => {
    try {
      await api(`/api/images/${image.Id}`, { method: "DELETE" })
      setImages((prev) => prev.filter((i) => i.Id !== image.Id))
      toast({ title: "Image deleted" })
    } catch (error) {
      toast({ title: "Image not deleted", description: errorMessage(error), variant: "destructive" })
    }
  }, [])

  const renameImage = useCallback(async (image: DMImage, name: string) => {
    try {
      await api(`/api/images/${image.Id}`, { method: "PUT", body: { name } })
      setImages((prev) => prev.map((i) => (i.Id === image.Id ? { ...i, Name: name.trim() } : i)))
    } catch (error) {
      toast({ title: "Image not renamed", description: errorMessage(error), variant: "destructive" })
      throw error
    }
  }, [])

  const addImageToList = useCallback((image: DMImage) => setImages((prev) => [...prev, image]), [])

  const reset = useCallback(() => {
    setImages([])
    setAllUsers([])
  }, [])

  return { images, setImages, allUsers, loadImages, loadUsers, uploadImage, deleteImage, renameImage, addImageToList, reset }
}
