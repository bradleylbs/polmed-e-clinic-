interface SyncData {
  id: string
  type: "patient" | "route" | "inventory" | "appointment" | "billing" | "user" | "report"
  action: "create" | "update" | "delete"
  data: any
  timestamp: number
  synced: boolean
  endpoint?: string
  method?: string
  retryCount?: number
  lastError?: string
  version?: number
}

interface ConflictResolution {
  strategy: "server-wins" | "client-wins" | "merge" | "manual"
  mergeFields?: string[]
}

const API_BASE =
  (typeof process !== "undefined" && (process as any).env && (process as any).env.NEXT_PUBLIC_API_URL) ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "")

const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 5000

class OfflineManager {
  private db: IDBDatabase | null = null
  private syncQueue: SyncData[] = []
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true
  private hasBoundOnlineOffline = false
  private deviceId: string | null = null
  private syncInProgress = false
  private searchIndex: Map<string, any[]> = new Map()

  async init() {
    if (typeof window === "undefined") return

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open("palmed-clinic-db", 2)
    } catch (e) {
      console.error("IndexedDB init failed:", e)
      return
    }

    request.onerror = () => console.error("Failed to open IndexedDB")

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result
      this.loadSyncQueue()
      this.buildSearchIndex()
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      const stores = [
        "patients",
        "routes",
        "inventory",
        "appointments",
        "syncQueue",
        "billing",
        "users",
        "reports",
        "conflicts",
      ]

      stores.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" })

          // Add indexes for search
          if (storeName === "patients") {
            store.createIndex("name", "name", { unique: false })
            store.createIndex("mrn", "mrn", { unique: false })
          } else if (storeName === "appointments") {
            store.createIndex("date", "date", { unique: false })
            store.createIndex("patientId", "patientId", { unique: false })
          } else if (storeName === "billing") {
            store.createIndex("status", "status", { unique: false })
            store.createIndex("patientId", "patientId", { unique: false })
          }
        }
      })
    }

    if (!this.hasBoundOnlineOffline) {
      window.addEventListener("online", () => {
        this.isOnline = true
        this.syncData()
        this.registerBackgroundSync()
      })

      window.addEventListener("offline", () => {
        this.isOnline = false
      })
      this.hasBoundOnlineOffline = true
    }

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
      this.deviceId = this.deviceId || null
    }

    this.registerServiceWorker()
  }

  private async registerServiceWorker() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js")
      console.log("[OfflineManager] Service worker registered:", registration.scope)

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "SYNC_COMPLETE") {
          console.log(`[OfflineManager] Background sync completed: ${event.data.count} items`)
          this.loadSyncQueue()
        } else if (event.data.type === "GET_AUTH_TOKEN") {
          const token = localStorage.getItem("token")
          event.ports[0].postMessage({ token })
        } else if (event.data.type === "GET_DEVICE_ID") {
          event.ports[0].postMessage({ deviceId: this.deviceId })
        }
      })
    } catch (error) {
      console.error("[OfflineManager] Service worker registration failed:", error)
    }
  }

  private async registerBackgroundSync() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    try {
      const registration = await navigator.serviceWorker.ready
      if ("sync" in registration) {
        await (registration as any).sync.register("sync-pending-data")
        console.log("[OfflineManager] Background sync registered")
      }
    } catch (error) {
      console.error("[OfflineManager] Background sync registration failed:", error)
    }
  }

  private async buildSearchIndex() {
    if (!this.db) return

    const stores = ["patients", "appointments", "inventory", "billing"]

    for (const storeName of stores) {
      try {
        const data = await this.getData(storeName)
        if (Array.isArray(data)) {
          this.searchIndex.set(storeName, data)
        }
      } catch (error) {
        console.error(`Failed to build search index for ${storeName}:`, error)
      }
    }
  }

  async searchOffline(storeName: string, query: string, filters?: Record<string, any>) {
    const data = this.searchIndex.get(storeName) || []

    let results = data.filter((item: any) => {
      const searchableText = JSON.stringify(item).toLowerCase()
      return searchableText.includes(query.toLowerCase())
    })

    if (filters) {
      results = results.filter((item: any) => {
        return Object.entries(filters).every(([key, value]) => {
          return item[key] === value
        })
      })
    }

    return results
  }

  async saveData(storeName: string, data: any, conflictResolution?: ConflictResolution) {
    if (!this.db) return

    const transaction = this.db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    try {
      const dataWithVersion = {
        ...data,
        version: (data.version || 0) + 1,
        lastModified: Date.now(),
      }

      await store.put(dataWithVersion)

      // Update search index
      const indexData = this.searchIndex.get(storeName) || []
      const existingIndex = indexData.findIndex((item: any) => item.id === data.id)
      if (existingIndex >= 0) {
        indexData[existingIndex] = dataWithVersion
      } else {
        indexData.push(dataWithVersion)
      }
      this.searchIndex.set(storeName, indexData)

      if (!this.isOnline) {
        this.addToSyncQueue({
          id: `${storeName}-${data.id}-${Date.now()}`,
          type: storeName as any,
          action: data.id ? "update" : "create",
          data: dataWithVersion,
          timestamp: Date.now(),
          synced: false,
          version: dataWithVersion.version,
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

  async deleteData(storeName: string, id: string) {
    if (!this.db) return

    const transaction = this.db.transaction([storeName], "readwrite")
    const store = transaction.objectStore(storeName)

    try {
      await store.delete(id)

      // Update search index
      const indexData = this.searchIndex.get(storeName) || []
      const filtered = indexData.filter((item: any) => item.id !== id)
      this.searchIndex.set(storeName, filtered)

      if (!this.isOnline) {
        this.addToSyncQueue({
          id: `${storeName}-${id}-${Date.now()}`,
          type: storeName as any,
          action: "delete",
          data: { id },
          timestamp: Date.now(),
          synced: false,
        })
      }
    } catch (error) {
      console.error("Failed to delete data offline:", error)
    }
  }

  private addToSyncQueue(syncData: SyncData) {
    this.syncQueue.push(syncData)
    this.saveSyncQueue()
  }

  queueOperation(params: {
    type: SyncData["type"]
    action: SyncData["action"]
    data: any
    id?: string
    endpoint?: string
    method?: string
  }) {
    const opId = params.id || `${params.type}-${params.data?.id ?? "local"}-${Date.now()}`
    this.addToSyncQueue({
      id: opId,
      type: params.type,
      action: params.action,
      data: params.data,
      timestamp: Date.now(),
      synced: false,
      endpoint: params.endpoint,
      method: params.method,
      retryCount: 0,
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
    if (!this.isOnline || this.syncQueue.length === 0 || this.syncInProgress) return

    this.syncInProgress = true

    const base = API_BASE ? API_BASE.replace(/\/$/, "") : ""
    const url = base ? `${base}/sync/pending` : "/api/sync/pending"

    const records = this.getPendingRecordsForServer()
    if (!records.length) {
      this.syncInProgress = false
      return
    }

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
        this.syncQueue.forEach((i) => (i.synced = true))
        this.syncQueue = []
        await this.saveSyncQueue()
        console.log(`[sync] Uploaded ${records.length} pending records; local queue cleared`)
      } else if (resp.status === 409) {
        const conflicts = await resp.json()
        await this.handleConflicts(conflicts)
      } else {
        const text = await resp.text().catch(() => "")
        console.warn(`[sync] Server returned ${resp.status}: ${text}`)

        this.syncQueue.forEach((item) => {
          item.retryCount = (item.retryCount || 0) + 1
          item.lastError = text
        })

        // Remove items that exceeded retry limit
        this.syncQueue = this.syncQueue.filter((item) => (item.retryCount || 0) < MAX_RETRY_ATTEMPTS)
        await this.saveSyncQueue()
      }
    } catch (e) {
      console.error("[sync] Failed to submit pending records:", e)

      // Schedule retry
      setTimeout(() => this.syncData(), RETRY_DELAY)
    } finally {
      this.syncInProgress = false
    }
  }

  private async handleConflicts(conflicts: any[]) {
    if (!this.db) return

    const transaction = this.db.transaction(["conflicts"], "readwrite")
    const store = transaction.objectStore("conflicts")

    for (const conflict of conflicts) {
      try {
        await store.put({
          id: `conflict-${Date.now()}-${Math.random()}`,
          ...conflict,
          timestamp: Date.now(),
          resolved: false,
        })
      } catch (error) {
        console.error("Failed to save conflict:", error)
      }
    }

    console.warn(`[sync] ${conflicts.length} conflicts detected and saved for manual resolution`)
  }

  async getConflicts() {
    if (!this.db) return []

    const transaction = this.db.transaction(["conflicts"], "readonly")
    const store = transaction.objectStore("conflicts")
    const request = store.getAll()

    return new Promise<any[]>((resolve) => {
      request.onsuccess = () => {
        const conflicts = request.result.filter((c: any) => !c.resolved)
        resolve(conflicts)
      }
      request.onerror = () => resolve([])
    })
  }

  async resolveConflict(conflictId: string, resolution: "server" | "client" | "merge", mergedData?: any) {
    if (!this.db) return

    const transaction = this.db.transaction(["conflicts"], "readwrite")
    const store = transaction.objectStore("conflicts")

    try {
      const conflict = await new Promise<any>((resolve) => {
        const request = store.get(conflictId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      })

      if (conflict) {
        conflict.resolved = true
        conflict.resolution = resolution
        conflict.resolvedAt = Date.now()

        if (resolution === "merge" && mergedData) {
          conflict.mergedData = mergedData
        }

        await store.put(conflict)
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error)
    }
  }

  getConnectionStatus() {
    return this.isOnline
  }

  getPendingSyncCount() {
    return this.syncQueue.length
  }

  getPendingRecordsForServer() {
    return this.syncQueue.map((item) => ({
      table_name: item.type,
      record_id: (item.data && (item.data.id || item.id)) ?? item.id,
      operation_type: item.action,
      timestamp: item.timestamp,
      version: item.version,
    }))
  }

  async clearAllData() {
    if (!this.db) return

    const stores = [
      "patients",
      "routes",
      "inventory",
      "appointments",
      "billing",
      "users",
      "reports",
      "syncQueue",
      "conflicts",
    ]

    for (const storeName of stores) {
      try {
        const transaction = this.db.transaction([storeName], "readwrite")
        const store = transaction.objectStore(storeName)
        await store.clear()
      } catch (error) {
        console.error(`Failed to clear ${storeName}:`, error)
      }
    }

    this.syncQueue = []
    this.searchIndex.clear()
  }
}

export const offlineManager = new OfflineManager()
