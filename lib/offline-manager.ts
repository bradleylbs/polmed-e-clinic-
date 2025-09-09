interface SyncData {
  id: string
  type: "patient" | "route" | "inventory" | "appointment"
  action: "create" | "update" | "delete"
  data: any
  timestamp: number
  synced: boolean
}

class OfflineManager {
  private db: IDBDatabase | null = null
  private syncQueue: SyncData[] = []
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true

  async init() {
    if (typeof window === "undefined") return

    // Initialize IndexedDB
    const request = indexedDB.open("palmed-clinic-db", 1)

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
    window.addEventListener("online", () => {
      this.isOnline = true
      this.syncData()
    })

    window.addEventListener("offline", () => {
      this.isOnline = false
    })
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

  private async saveSyncQueue() {
    if (!this.db) return

    const transaction = this.db.transaction(["syncQueue"], "readwrite")
    const store = transaction.objectStore("syncQueue")

    for (const item of this.syncQueue) {
      await store.put(item)
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

    console.log("[v0] Starting data synchronization...")

    for (const item of this.syncQueue) {
      try {
        // Simulate API call - replace with actual API endpoints
        const response = await fetch(`/api/${item.type}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.data),
        })

        if (response.ok) {
          item.synced = true
          console.log(`[v0] Synced ${item.type} data successfully`)
        }
      } catch (error) {
        console.error(`[v0] Failed to sync ${item.type}:`, error)
      }
    }

    // Remove synced items
    this.syncQueue = this.syncQueue.filter((item) => !item.synced)
    this.saveSyncQueue()
  }

  getConnectionStatus() {
    return this.isOnline
  }

  getPendingSyncCount() {
    return this.syncQueue.length
  }
}

export const offlineManager = new OfflineManager()
