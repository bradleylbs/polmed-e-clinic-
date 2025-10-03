interface SyncData {
  id: string
  type: "patient" | "route" | "inventory" | "appointment"
  action: "create" | "update" | "delete"
  data: any
  timestamp: number
  synced: boolean
  endpoint?: string
  method?: string
}

// Resolve API base for Azure deployments: prefer build-time env, else fall back to same-origin /api
const API_BASE =
  (typeof process !== "undefined" && (process as any).env && (process as any).env.NEXT_PUBLIC_API_URL) ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "")

class OfflineManager {
  private db: IDBDatabase | null = null
  private syncQueue: SyncData[] = []
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true
  private hasBoundOnlineOffline = false
  private deviceId: string | null = null

  async init() {
    if (typeof window === "undefined") return

    // Initialize IndexedDB
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open("palmed-clinic-db", 1)
    } catch (e) {
      console.error("IndexedDB init failed:", e)
      return
    }

  request.onerror = () => console.error("Failed to open IndexedDB")

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result
      this.loadSyncQueue()
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object stores
      if (!db.objectStoreNames.contains("patients")) {
        db.createObjectStore("patients", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("routes")) {
        db.createObjectStore("routes", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("inventory")) {
        db.createObjectStore("inventory", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("appointments")) {
        db.createObjectStore("appointments", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("syncQueue")) {
        db.createObjectStore("syncQueue", { keyPath: "id" })
      }
    }

    // Listen for online/offline events
    if (!this.hasBoundOnlineOffline) {
      window.addEventListener("online", () => {
        this.isOnline = true
        this.syncData()
      })

      window.addEventListener("offline", () => {
        this.isOnline = false
      })
      this.hasBoundOnlineOffline = true
    }

    // Ensure device id
    try {
      const existing = localStorage.getItem("device_id")
      if (existing) {
        this.deviceId = existing
      } else if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
        this.deviceId = (crypto as any).randomUUID()
        localStorage.setItem("device_id", this.deviceId as string)
      } else {
        const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        this.deviceId = id
        localStorage.setItem("device_id", id)
      }
    } catch (e) {
      // non-fatal if localStorage unavailable
      this.deviceId = this.deviceId || null
    }
  }

  async saveData(storeName: string, data: any) {
    if (!this.db) return

    const transaction = this.db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    try {
      await store.put(data)

      // Add to sync queue if offline
      if (!this.isOnline) {
        this.addToSyncQueue({
          id: `${storeName}-${data.id}-${Date.now()}`,
          type: storeName as any,
          action: "create",
          data,
          timestamp: Date.now(),
          synced: false,
        })
      }
    } catch (error) {
      console.error("Failed to save data offline:", error)
    }
  }

  async getData(storeName: string, id?: string) {
    if (!this.db) return null

    const transaction = this.db.transaction([storeName], "readonly")
    const store = transaction.objectStore(storeName)

    try {
      if (id) {
        const request = store.get(id)
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve(null)
        })
      } else {
        const request = store.getAll()
        return new Promise((resolve) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => resolve([])
        })
      }
    } catch (error) {
      console.error("Failed to get data offline:", error)
      return null
    }
  }

  private addToSyncQueue(syncData: SyncData) {
    this.syncQueue.push(syncData)
    this.saveSyncQueue()
  }

  // Public API to queue an operation when offline or for deferred sync
  queueOperation(params: {
    type: SyncData["type"]
    action: SyncData["action"]
    data: any
    id?: string
    endpoint?: string
    method?: string
  }) {
    const opId = params.id || `${params.type}-${(params.data?.id ?? "local")}-${Date.now()}`
    this.addToSyncQueue({
      id: opId,
      type: params.type,
      action: params.action,
      data: params.data,
      timestamp: Date.now(),
      synced: false,
      endpoint: params.endpoint,
      method: params.method,
    })
    return opId
  }

  private async saveSyncQueue() {
    if (!this.db) return

    const transaction = this.db.transaction(["syncQueue"], "readwrite")
    const store = transaction.objectStore("syncQueue")

    for (const item of this.syncQueue) {
      try {
        await store.put(item)
      } catch (e) {
        console.error("Failed to persist syncQueue item", item?.id, e)
      }
    }
  }

  private async loadSyncQueue() {
    if (!this.db) return

    const transaction = this.db.transaction(["syncQueue"], "readonly")
    const store = transaction.objectStore("syncQueue")
    const request = store.getAll()

    request.onsuccess = () => {
      this.syncQueue = request.result.filter((item: SyncData) => !item.synced)
    }
  }

  async syncData() {
    if (!this.isOnline || this.syncQueue.length === 0) return

    // Option A: envelope submit to server and clear local queue on success
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : ""
    const url = base ? `${base}/sync/pending` : "/api/sync/pending"

    const records = this.getPendingRecordsForServer()
    if (!records.length) return

    // Include auth token if present (sync endpoints require auth)
    let token: string | null = null
    try {
      token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    } catch {}

    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ device_id: this.deviceId || "unknown-device", records }),
      })

      if (resp.ok) {
        // Mark items as synced and clear them locally
        this.syncQueue.forEach((i) => (i.synced = true))
        this.syncQueue = []
        await this.saveSyncQueue()
        console.log(`[sync] Uploaded ${records.length} pending records; local queue cleared`)
      } else {
        const text = await resp.text().catch(() => "")
        console.warn(`[sync] Server returned ${resp.status}: ${text}`)
      }
    } catch (e) {
      console.error("[sync] Failed to submit pending records:", e)
    }
  }

  getConnectionStatus() {
    return this.isOnline
  }

  getPendingSyncCount() {
    return this.syncQueue.length
  }

  // Provide a stable snapshot suitable for server handoff during "pending sync" API
  getPendingRecordsForServer() {
    return this.syncQueue.map((item) => ({
      table_name: item.type,
      record_id: (item.data && (item.data.id || item.id)) ?? item.id,
      operation_type: item.action,
      timestamp: item.timestamp,
    }))
  }
}

export const offlineManager = new OfflineManager()
