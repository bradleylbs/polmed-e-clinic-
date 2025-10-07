"use client"

import type React from "react"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Suspense, useEffect, useState } from "react"
import { offlineManager } from "@/lib/offline-manager"
import "./globals.css"

// Offline initialization component
function OfflineInit() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Initialize offline manager
    offlineManager.init()

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Set initial status
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <>
      {/* Offline indicator banner */}
      <div
        className={`fixed top-0 left-0 right-0 z-[9999] transform transition-all duration-300 ${
          isOnline ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium shadow-lg">
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-pulse"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            You're currently offline. Some features may be limited.
          </span>
        </div>
      </div>
    </>
  )
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full border-4 border-primary/20" />
        </div>
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">Loading POLMED</p>
          <p className="text-sm text-muted-foreground">Preparing your healthcare platform...</p>
        </div>
      </div>
    </div>
  )
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <body 
      className={`font-sans antialiased ${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <OfflineInit />
      <Suspense fallback={<LoadingFallback />}>
        {children}
      </Suspense>
      <Analytics />
      <SpeedInsights />
    </body>
  )
}
