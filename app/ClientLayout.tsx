"use client"

import type React from "react"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { offlineManager } from "@/lib/offline-manager"
import { useEffect } from "react"
import "./globals.css"

function OfflineInit() {
  useEffect(() => {
    offlineManager.init()
  }, [])

  return null
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
      <OfflineInit />
      <Suspense fallback={null}>{children}</Suspense>
      <Analytics />
    </body>
  )
}
