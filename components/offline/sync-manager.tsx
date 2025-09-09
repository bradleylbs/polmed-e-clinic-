"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { offlineManager } from "@/lib/offline-manager"

interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  lastSync: Date | null
  isSyncing: boolean
}

export function SyncManager() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    lastSync: null,
    isSyncing: false,
  })

  useEffect(() => {
    const updateStatus = () => {
      setSyncStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        pendingCount: offlineManager.getPendingSyncCount(),
      }))
    }

    updateStatus()
    const interval = setInterval(updateStatus, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleManualSync = async () => {
    if (!syncStatus.isOnline) return

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }))

    try {
      await offlineManager.syncData()
      setSyncStatus((prev) => ({
        ...prev,
        lastSync: new Date(),
        pendingCount: 0,
        isSyncing: false,
      }))
    } catch (error) {
      console.error("Manual sync failed:", error)
      setSyncStatus((prev) => ({ ...prev, isSyncing: false }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Data Synchronization
        </CardTitle>
        <CardDescription>Manage offline data and synchronization with the server</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status</span>
          <Badge variant={syncStatus.isOnline ? "default" : "secondary"}>
            {syncStatus.isOnline ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
            {syncStatus.isOnline ? "Online" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Pending Changes</span>
          <Badge variant={syncStatus.pendingCount > 0 ? "destructive" : "outline"}>
            {syncStatus.pendingCount} items
          </Badge>
        </div>

        {syncStatus.lastSync && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Last Sync</span>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {syncStatus.lastSync.toLocaleTimeString()}
            </div>
          </div>
        )}

        <Button
          onClick={handleManualSync}
          disabled={!syncStatus.isOnline || syncStatus.isSyncing || syncStatus.pendingCount === 0}
          className="w-full"
        >
          {syncStatus.isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Now
            </>
          )}
        </Button>

        {!syncStatus.isOnline && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              You're currently offline. Changes will be saved locally and synced when connection is restored.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
