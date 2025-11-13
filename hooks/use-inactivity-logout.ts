/**
 * Hook for detecting user inactivity and auto-logout
 * Tracks mouse movement, keyboard input, and clicks
 * Triggers logout after specified timeout (default 15 minutes)
 */

import { useEffect, useRef, useCallback } from "react"

interface UseInactivityLogoutOptions {
  /**
   * Inactivity timeout in milliseconds
   * @default 900000 (15 minutes)
   */
  timeout?: number
  /**
   * Callback function to execute on inactivity timeout
   */
  onTimeout: () => void
  /**
   * Whether to enable the inactivity detection
   * @default true
   */
  enabled?: boolean
  /**
   * Array of event types to track for activity
   * @default ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
   */
  events?: string[]
  /**
   * Throttle time for activity tracking in milliseconds
   * @default 1000 (1 second)
   */
  throttle?: number
}

export function useInactivityLogout(options: UseInactivityLogoutOptions) {
  const {
    timeout = 15 * 60 * 1000, // 15 minutes
    onTimeout,
    enabled = true,
    events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'],
    throttle = 1000,
  } = options

  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    // Clear existing timeout
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current)
    }

    // Update last activity timestamp
    lastActivityRef.current = Date.now()

    // Set new timeout
    timeoutIdRef.current = setTimeout(() => {
      console.log('[Inactivity Logout] User inactive for', timeout / 1000, 'seconds')
      onTimeout()
    }, timeout)
  }, [timeout, onTimeout])

  // Throttled activity handler
  const handleActivity = useCallback(() => {
    // Skip if throttle timer is active
    if (throttleTimerRef.current) {
      return
    }

    // Reset timer and set throttle
    resetTimer()

    // Set throttle timer
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null
    }, throttle)
  }, [resetTimer, throttle])

  // Setup and cleanup
  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      return
    }

    console.log('[Inactivity Logout] Starting inactivity detection with', timeout / 1000, 'seconds timeout')

    // Start timer immediately
    resetTimer()

    // Attach event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    // Cleanup function
    return () => {
      // Remove event listeners
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })

      // Clear timers
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current)
      }
    }
  }, [enabled, events, handleActivity, resetTimer, timeout])

  // Return utility functions
  return {
    /**
     * Manually reset the inactivity timer
     */
    resetTimer,
    /**
     * Get the last activity timestamp
     */
    getLastActivity: () => lastActivityRef.current,
    /**
     * Get time remaining until timeout in milliseconds
     */
    getTimeRemaining: () => {
      const elapsed = Date.now() - lastActivityRef.current
      return Math.max(0, timeout - elapsed)
    },
  }
}
