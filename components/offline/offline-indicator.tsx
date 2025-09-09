"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, CloudUpload } from "lucide-react"
import { offlineManager } from "@/lib/offline-manager"

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingSync, setPendingSync] = useState(0)

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(navigator.onLine)
      setPendingSync(offlineManager.getPendingSyncCount())
    }

    // Initial status
    updateStatus()

    // Listen for connection changes
    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)

    // Update pending sync count periodically
    const interval = setInterval(updateStatus, 5000)

    return () => {
      window.removeEventListener("online", updateStatus)
      window.removeEventListener("offline", updateStatus)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="flex items-center gap-2 text-sm">
      {isOnline ? (
        <div className="flex items-center gap-1 text-emerald-600">
          <Wifi className="h-4 w-4" />
          <span>Online</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-amber-600">
          <WifiOff className="h-4 w-4" />
          <span>Offline</span>
        </div>
      )}

      {pendingSync > 0 && (
        <div className="flex items-center gap-1 text-blue-600">
          <CloudUpload className="h-4 w-4" />
          <span>{pendingSync} pending</span>
        </div>
      )}
    </div>
  )
}
