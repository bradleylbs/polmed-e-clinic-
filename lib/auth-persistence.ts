/**
 * Authentication Persistence Utility
 * Handles persistent login across browser sessions and page reloads
 */

export interface PersistentAuthSession {
  type: "patient" | "staff"
  data: any
  token?: string
  expiresAt?: number
  lastValidated?: number
}

class AuthPersistenceManager {
  private readonly STORAGE_KEY = "auth_persistent_session"
  private readonly VALIDATION_INTERVAL = 5 * 60 * 1000 // Validate every 5 minutes

  /**
   * Save authentication session persistently
   */
  saveSession(type: "patient" | "staff", data: any, token?: string, expiryMs?: number): void {
    try {
      const now = Date.now()
      const session: PersistentAuthSession = {
        type,
        data,
        token,
        expiresAt: expiryMs ? now + expiryMs : now + 7 * 24 * 60 * 60 * 1000, // Default 7 days
        lastValidated: now,
      }

      // Save to localStorage for persistence across browser sessions
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session))
      
      // Also save type-specific key for quick access
      const typeKey = `auth_${type}_session`
      localStorage.setItem(typeKey, JSON.stringify(session))
    } catch (error) {
      console.error("Failed to save persistent auth session:", error)
    }
  }

  /**
   * Get persisted authentication session
   */
  getSession(type?: "patient" | "staff"): PersistentAuthSession | null {
    try {
      const key = type ? `auth_${type}_session` : this.STORAGE_KEY
      const stored = localStorage.getItem(key)

      if (!stored) {
        return null
      }

      const session: PersistentAuthSession = JSON.parse(stored)

      // Check if session has expired
      if (session.expiresAt && Date.now() > session.expiresAt) {
        this.clearSession(session.type)
        return null
      }

      // Check if session needs validation (older than validation interval)
      if (!session.lastValidated || Date.now() - session.lastValidated > this.VALIDATION_INTERVAL) {
        session.lastValidated = Date.now()
        // Update the validation timestamp
        localStorage.setItem(key, JSON.stringify(session))
      }

      return session
    } catch (error) {
      console.error("Failed to retrieve persistent auth session:", error)
      return null
    }
  }

  /**
   * Clear authentication session
   */
  clearSession(type?: "patient" | "staff"): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      
      if (type) {
        localStorage.removeItem(`auth_${type}_session`)
      } else {
        localStorage.removeItem("auth_patient_session")
        localStorage.removeItem("auth_staff_session")
      }
    } catch (error) {
      console.error("Failed to clear persistent auth session:", error)
    }
  }

  /**
   * Check if a persisted session is valid
   */
  isSessionValid(type?: "patient" | "staff"): boolean {
    const session = this.getSession(type)
    return session !== null
  }

  /**
   * Get auth token from persisted session
   */
  getAuthToken(type?: "patient" | "staff"): string | null {
    const session = this.getSession(type)
    return session?.token || null
  }

  /**
   * Refresh session expiry time without modifying data
   */
  refreshSessionExpiry(type: "patient" | "staff", expiryMs: number): void {
    try {
      const session = this.getSession(type)
      if (session) {
        session.expiresAt = Date.now() + expiryMs
        session.lastValidated = Date.now()
        this.saveSession(session.type, session.data, session.token, expiryMs)
      }
    } catch (error) {
      console.error("Failed to refresh session expiry:", error)
    }
  }

  /**
   * Get all persisted sessions
   */
  getAllSessions(): PersistentAuthSession[] {
    const sessions: PersistentAuthSession[] = []
    
    try {
      const patientSession = this.getSession("patient")
      if (patientSession) sessions.push(patientSession)

      const staffSession = this.getSession("staff")
      if (staffSession) sessions.push(staffSession)
    } catch (error) {
      console.error("Failed to retrieve all sessions:", error)
    }

    return sessions
  }

  /**
   * Check and auto-login if valid session exists
   */
  async autoLogin(type: "patient" | "staff"): Promise<PersistentAuthSession | null> {
    try {
      const session = this.getSession(type)
      
      if (!session) {
        return null
      }

      // Optional: Validate token with backend before auto-login
      if (session.token) {
        // This could be extended to call an API endpoint to verify token validity
        console.log(`Auto-login attempt for ${type} user`)
      }

      return session
    } catch (error) {
      console.error("Failed to auto-login:", error)
      return null
    }
  }

  /**
   * Clear all expired sessions
   */
  clearExpiredSessions(): void {
    try {
      const sessions = this.getAllSessions()
      
      sessions.forEach((session) => {
        if (session.expiresAt && Date.now() > session.expiresAt) {
          this.clearSession(session.type)
        }
      })
    } catch (error) {
      console.error("Failed to clear expired sessions:", error)
    }
  }
}

// Export singleton instance
export const authPersistence = new AuthPersistenceManager()
