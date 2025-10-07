"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { PatientPortalLogin } from "@/components/patient-portal/patient-portal-login"
import { PatientPortalDashboard } from "@/components/patient-portal/patient-portal-dashboard"
import { PatientPortalRegistration } from "@/components/patient-portal/patient-portal-registration"
import { patientPortalService, type PatientDashboardData } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2, ShieldCheck, Mail, CheckCircle2, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type ViewMode = "login" | "register" | "dashboard" | "verify-email" | "loading"

interface PatientSession {
  token: string
  patient_data: PatientDashboardData["patient_info"]
  timestamp: number
  expiresAt: number
}

interface VerificationState {
  status: "idle" | "verifying" | "success" | "error"
  message?: string
}

// Session expiry: 7 days
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000

export default function PatientPortalPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("loading")
  const [session, setSession] = useState<PatientSession | null>(null)
  const [verificationState, setVerificationState] = useState<VerificationState>({ status: "idle" })
  const { toast } = useToast()

  // Session management utilities
  const saveSession = useCallback((sessionData: Omit<PatientSession, "timestamp" | "expiresAt">) => {
    const now = Date.now()
    const fullSession: PatientSession = {
      ...sessionData,
      timestamp: now,
      expiresAt: now + SESSION_EXPIRY_MS,
    }
    
    try {
      localStorage.setItem("patient_portal_session", JSON.stringify(fullSession))
      setSession(fullSession)
    } catch (error) {
      console.error("Failed to save session:", error)
      toast({
        title: "Storage Error",
        description: "Failed to save session. Please check your browser settings.",
        variant: "destructive",
      })
    }
  }, [toast])

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem("patient_portal_session")
      setSession(null)
    } catch (error) {
      console.error("Failed to clear session:", error)
    }
  }, [])

  const isSessionValid = useCallback((sessionData: PatientSession): boolean => {
    if (!sessionData?.patient_data?.id || !sessionData?.token) {
      return false
    }
    
    const now = Date.now()
    if (sessionData.expiresAt && now > sessionData.expiresAt) {
      return false
    }
    
    return true
  }, [])

  // Check for existing session on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Check URL for verification token first
        const urlParams = new URLSearchParams(window.location.search)
        const verifyToken = urlParams.get("verify")
        
        if (verifyToken) {
          setViewMode("verify-email")
          // Remove token from URL without page reload
          const newUrl = window.location.pathname
          window.history.replaceState({}, document.title, newUrl)
          await handleEmailVerification(verifyToken)
          return
        }

        // Check for saved session
        const savedSession = localStorage.getItem("patient_portal_session")
        if (savedSession) {
          try {
            const parsedSession: PatientSession = JSON.parse(savedSession)
            
            if (isSessionValid(parsedSession)) {
              setSession(parsedSession)
              setViewMode("dashboard")
              
              // Show welcome back message
              toast({
                title: "Welcome back!",
                description: `Hello ${parsedSession.patient_data.full_name}`,
              })
            } else {
              // Session expired or invalid
              clearSession()
              setViewMode("login")
              
              if (parsedSession.expiresAt && Date.now() > parsedSession.expiresAt) {
                toast({
                  title: "Session Expired",
                  description: "Please log in again to continue.",
                  variant: "destructive",
                })
              }
            }
          } catch (parseError) {
            console.error("Failed to parse session:", parseError)
            clearSession()
            setViewMode("login")
          }
        } else {
          setViewMode("login")
        }
      } catch (error) {
        console.error("Initialization error:", error)
        setViewMode("login")
      }
    }

    initializeSession()
  }, [isSessionValid, clearSession, toast])

  // Email verification handler
  const handleEmailVerification = async (token: string) => {
    setVerificationState({ status: "verifying" })
    
    try {
      const response = await patientPortalService.verifyPatientEmail(token)

      if (response.success) {
        setVerificationState({
          status: "success",
          message: "Your email has been verified successfully!",
        })
        
        toast({
          title: "Email Verified",
          description: "You can now log in to access your patient portal.",
        })
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          setViewMode("login")
          setVerificationState({ status: "idle" })
        }, 3000)
      } else {
        setVerificationState({
          status: "error",
          message: response.error || "Failed to verify email. The link may have expired.",
        })
        
        toast({
          title: "Verification Failed",
          description: response.error || "Failed to verify email. Please try again or contact support.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Verification error:", error)
      setVerificationState({
        status: "error",
        message: "An unexpected error occurred during verification.",
      })
      
      toast({
        title: "Verification Error",
        description: "An error occurred. Please try again or contact support.",
        variant: "destructive",
      })
    }
  }

  // Login handler with enhanced validation
  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await patientPortalService.loginPatient(email, password)

      if (response.success && response.data) {
        if (!response.data.patient_data?.id) {
          throw new Error("Invalid patient data received")
        }

        const sessionData = {
          token: response.data.token,
          patient_data: response.data.patient_data,
        }

        saveSession(sessionData)
        setViewMode("dashboard")

        toast({
          title: "Welcome Back",
          description: `Hello ${response.data.patient_data.full_name}!`,
        })
      } else {
        toast({
          title: "Login Failed",
          description: response.error || "Invalid email or password. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Login Error",
        description: error instanceof Error ? error.message : "An error occurred during login. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Registration handler with enhanced feedback
  const handleRegistration = async (registrationData: any) => {
    try {
      const response = await patientPortalService.registerPatient(registrationData)

      if (response.success && response.data) {
        if (response.data.requires_verification) {
          toast({
            title: "Registration Successful!",
            description: "Please check your email to verify your account before logging in.",
          })
        } else {
          toast({
            title: "Registration Successful!",
            description: "You can now log in with your credentials.",
          })
        }
        
        setViewMode("login")
      } else {
        toast({
          title: "Registration Failed",
          description: response.error || "Failed to register. Please check your information and try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Registration error:", error)
      toast({
        title: "Registration Error",
        description: error instanceof Error ? error.message : "An error occurred during registration. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Logout handler with cleanup
  const handleLogout = useCallback(() => {
    clearSession()
    setViewMode("login")
    
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    })
  }, [clearSession, toast])

  // Auto-logout on session expiry
  useEffect(() => {
    if (!session || viewMode !== "dashboard") return

    const checkSessionExpiry = () => {
      if (!isSessionValid(session)) {
        handleLogout()
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        })
      }
    }

    // Check every minute
    const interval = setInterval(checkSessionExpiry, 60000)
    return () => clearInterval(interval)
  }, [session, viewMode, isSessionValid, handleLogout, toast])

  // Loading state with professional spinner
  if (viewMode === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full border-4 border-primary/20 mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">Loading Patient Portal</p>
            <p className="text-sm text-muted-foreground">Preparing your secure healthcare dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  // Email verification view
  if (viewMode === "verify-email") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl animate-fade-in-up">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-4">
              {verificationState.status === "verifying" && (
                <>
                  <div className="relative mx-auto w-16 h-16">
                    <Loader2 className="w-16 h-16 animate-spin text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Verifying Email</h2>
                    <p className="text-muted-foreground">Please wait while we verify your email address...</p>
                  </div>
                </>
              )}

              {verificationState.status === "success" && (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-primary">Email Verified!</h2>
                    <p className="text-muted-foreground">{verificationState.message}</p>
                    <p className="text-sm text-muted-foreground">Redirecting to login...</p>
                  </div>
                </>
              )}

              {verificationState.status === "error" && (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-10 h-10 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-destructive">Verification Failed</h2>
                    <p className="text-muted-foreground">{verificationState.message}</p>
                  </div>
                  <Button 
                    onClick={() => setViewMode("login")}
                    className="w-full mt-4"
                  >
                    Go to Login
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Dashboard view
  if (viewMode === "dashboard" && session?.patient_data?.id) {
    return (
      <div className="animate-fade-in">
        <PatientPortalDashboard 
          patientId={session.patient_data.id} 
          onLogout={handleLogout} 
        />
      </div>
    )
  }

  // Registration view
  if (viewMode === "register") {
    return (
      <div className="animate-fade-in">
        <PatientPortalRegistration
          onRegistrationComplete={handleRegistration}
          onBackToLogin={() => setViewMode("login")}
        />
      </div>
    )
  }

  // Login view (default)
  return (
    <div className="animate-fade-in">
      <PatientPortalLogin 
        onLogin={handleLogin} 
        onRegister={() => setViewMode("register")} 
      />
    </div>
  )
}
