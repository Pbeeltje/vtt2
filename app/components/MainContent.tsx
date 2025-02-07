"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Upload } from "lucide-react"

export default function MainContent() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [imageData, setImageData] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    // Load image data from localStorage on component mount
    const savedImageData = localStorage.getItem("imageData")
    if (savedImageData) {
      setImageData(JSON.parse(savedImageData))
    }
  }, [])

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newImage = e.target?.result as string
        setUploadedImages([...uploadedImages, newImage])
        setSelectedImage(newImage)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageSelect = (image: string) => {
    setSelectedImage(image)
  }

  const handleImageDataChange = (image: string, data: string) => {
    const newImageData = { ...imageData, [image]: data }
    setImageData(newImageData)
    localStorage.setItem("imageData", JSON.stringify(newImageData))
  }

  const processImageData = (data: string) => {
    if (typeof data !== "string") {
      console.error("Invalid image data:", data)
      return []
    }
    return data
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-grow p-4">
        {selectedImage ? (
          <div className="relative w-full h-full">
            <Image src={selectedImage || "/placeholder.svg"} alt="Selected image" layout="fill" objectFit="contain" />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">No image selected</div>
        )}
      </div>
      <div className="py-0 bg-gray-100 border-t flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => document.getElementById("file-upload")?.click()}>
          <Upload className="h-4 w-4" />
          <span className="sr-only">Upload image</span>
        </Button>
        <input id="file-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        <ScrollArea className="h-16 flex-grow mx-2">
          <div className="flex space-x-2 p-2">
            {uploadedImages.map((image, index) => (
              <div key={index} className="flex flex-col items-center">
                <Button variant="outline" size="icon" onClick={() => handleImageSelect(image)} className="p-0.5 mb-1">
                  <Image
                    src={image || "/placeholder.svg"}
                    alt={`Uploaded image ${index + 1}`}
                    width={24}
                    height={24}
                    objectFit="cover"
                  />
                </Button>
                <Input
                  type="text"
                  placeholder="Image data"
                  value={imageData[image] || ""}
                  onChange={(e) => handleImageDataChange(image, e.target.value)}
                  className="w-20 text-xs"
                />
                <div className="text-xs mt-1">
                  {processImageData(imageData[image] || "").map((item, i) => (
                    <span key={i} className="mr-1">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

