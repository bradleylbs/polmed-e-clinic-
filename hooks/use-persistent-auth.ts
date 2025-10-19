/**
 * Hook for managing persistent authentication
 * Automatically restores user session on page reload or browser restart
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { authPersistence, type PersistentAuthSession } from "@/lib/auth-persistence"

export interface UsePersistentAuthOptions {
  type?: "patient" | "staff"
  onAutoLogin?: (session: PersistentAuthSession) => void
  onSessionExpired?: () => void
  enableAutoRefresh?: boolean
  refreshInterval?: number
}

export function usePersistentAuth(options: UsePersistentAuthOptions = {}) {
  const {
    type,
    onAutoLogin,
    onSessionExpired,
    enableAutoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
  } = options

  const [session, setSession] = useState<PersistentAuthSession | null>(null)
  const [isRestoring, setIsRestoring] = useState(true)
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Save session persistently
   */
  const saveSession = useCallback(
    (sessionData: Omit<PersistentAuthSession, "lastValidated">, expiryMs?: number) => {
      const fullSession = {
        ...sessionData,
        lastValidated: Date.now(),
      }

      authPersistence.saveSession(
        sessionData.type,
        sessionData.data,
        sessionData.token,
        expiryMs
      )

      setSession(fullSession as PersistentAuthSession)
    },
    []
  )

  /**
   * Clear session
   */
  const clearSession = useCallback(() => {
    authPersistence.clearSession(type)
    setSession(null)

    // Clear refresh timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [type])

  /**
   * Restore session from persistent storage
   */
  const restoreSession = useCallback(async () => {
    setIsRestoring(true)
    try {
      const persistedSession = await authPersistence.autoLogin(type || "patient")

      if (persistedSession) {
        setSession(persistedSession)

        // Call auto-login callback if provided
        if (onAutoLogin) {
          onAutoLogin(persistedSession)
        }

        // Start auto-refresh if enabled
        if (enableAutoRefresh && !refreshTimerRef.current) {
          refreshTimerRef.current = setInterval(() => {
            const current = authPersistence.getSession(type)
            if (current) {
              setSession(current)
            } else if (onSessionExpired) {
              onSessionExpired()
              clearSession()
            }
          }, refreshInterval)
        }
      }
    } catch (error) {
      console.error("Failed to restore session:", error)
    } finally {
      setIsRestoring(false)
    }
  }, [type, onAutoLogin, enableAutoRefresh, refreshInterval, onSessionExpired, clearSession])

  /**
   * Initialize on mount
   */
  useEffect(() => {
    restoreSession()

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
    }
  }, [restoreSession])

  /**
   * Refresh session expiry
   */
  const refreshSessionExpiry = useCallback(
    (expiryMs: number) => {
      if (type) {
        authPersistence.refreshSessionExpiry(type, expiryMs)
        const updated = authPersistence.getSession(type)
        if (updated) {
          setSession(updated)
        }
      }
    },
    [type]
  )

  /**
   * Check if session is valid
   */
  const isAuthenticated = useCallback(() => {
    return session !== null && authPersistence.isSessionValid(type)
  }, [session, type])

  return {
    session,
    isRestoring,
    isAuthenticated: isAuthenticated(),
    saveSession,
    clearSession,
    restoreSession,
    refreshSessionExpiry,
    getToken: () => session?.token || null,
  }
}
