import "./globals.css"
import type { Metadata } from "next"
import { Inter, Spectral, Spectral_SC } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog"
import type React from "react"

const inter = Inter({ subsets: ["latin"] })
// The jade HUD's faces: Spectral for text, its small caps for labels and plaques.
const spectral = Spectral({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-spectral" })
const spectralSc = Spectral_SC({ subsets: ["latin"], weight: ["600"], variable: "--font-spectral-sc" })

export const metadata: Metadata = {
  title: "The Job System",
  description: "A virtual tabletop for The Job System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${spectral.variable} ${spectralSc.variable}`}>
        {children}
        <Toaster />
        <ConfirmDialogHost />
      </body>
    </html>
  )
}
