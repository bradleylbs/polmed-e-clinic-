"use client"

import { useState, useEffect } from "react"
import { PatientPortalLogin } from "@/components/patient-portal/patient-portal-login"
import { PatientPortalDashboard } from "@/components/patient-portal/patient-portal-dashboard"
import { PatientPortalRegistration } from "@/components/patient-portal/patient-portal-registration"
import { patientPortalService, type PatientDashboardData } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

type ViewMode = "login" | "register" | "dashboard" | "verify-email"

interface PatientSession {
  token: string
  patient_data: PatientDashboardData["patient_info"]
}

export default function PatientPortalPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("login")
  const [session, setSession] = useState<PatientSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Check for existing session
    const checkSession = () => {
      try {
        const savedSession = localStorage.getItem("patient_portal_session")
        if (savedSession) {
          const parsedSession = JSON.parse(savedSession)
          if (parsedSession?.patient_data?.id) {
            setSession(parsedSession)
            setViewMode("dashboard")
          } else {
            // Invalid session data, remove it
            localStorage.removeItem("patient_portal_session")
          }
        }
      } catch (error) {
        console.error("Failed to parse saved session:", error)
        localStorage.removeItem("patient_portal_session")
      } finally {
        setLoading(false)
      }
    }

    // Check for email verification token in URL
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get("verify")
    if (token) {
      setVerificationToken(token)
      setViewMode("verify-email")
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }

    checkSession()
  }, [])

  useEffect(() => {
    // Handle email verification
    if (verificationToken && viewMode === "verify-email") {
      handleEmailVerification(verificationToken)
    }
  }, [verificationToken, viewMode])

  const handleEmailVerification = async (token: string) => {
    try {
      setLoading(true)
      const response = await patientPortalService.verifyPatientEmail(token)

      if (response.success) {
        toast({
          title: "Email Verified",
          description: "Your email has been verified successfully. You can now log in.",
        })
        setViewMode("login")
      } else {
        toast({
          title: "Verification Failed",
          description: response.error || "Failed to verify email. Please try again.",
          variant: "destructive",
        })
        setViewMode("login")
      }
    } catch (error) {
      toast({
        title: "Verification Error",
        description: "An error occurred during verification. Please try again.",
        variant: "destructive",
      })
      setViewMode("login")
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (email: string, password: string) => {
    try {
      setLoading(true)
      const response = await patientPortalService.loginPatient(email, password)

      if (response.success && response.data) {
        if (!response.data.patient_data?.id) {
          toast({
            title: "Login Error",
            description: "Invalid patient data received. Please try again.",
            variant: "destructive",
          })
          return
        }

        const sessionData = {
          token: response.data.token,
          patient_data: response.data.patient_data,
        }

        setSession(sessionData)
        localStorage.setItem("patient_portal_session", JSON.stringify(sessionData))
        setViewMode("dashboard")

        toast({
          title: "Welcome Back",
          description: `Hello ${response.data.patient_data.full_name}!`,
        })
      } else {
        toast({
          title: "Login Failed",
          description: response.error || "Invalid email or password.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Login Error",
        description: "An error occurred during login. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRegistration = async (registrationData: any) => {
    try {
      setLoading(true)
      const response = await patientPortalService.registerPatient(registrationData)

      if (response.success && response.data) {
        if (response.data.requires_verification) {
          toast({
            title: "Registration Successful",
            description: "Please check your email to verify your account before logging in.",
          })
          setViewMode("login")
        } else {
          toast({
            title: "Registration Successful",
            description: "You can now log in with your credentials.",
          })
          setViewMode("login")
        }
      } else {
        toast({
          title: "Registration Failed",
          description: response.error || "Failed to register. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Registration Error",
        description: "An error occurred during registration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    setSession(null)
    localStorage.removeItem("patient_portal_session")
    setViewMode("login")
    toast({
      title: "Logged Out",
      description: "You have been logged out successfully.",
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (viewMode === "dashboard" && session?.patient_data?.id) {
    return <PatientPortalDashboard patientId={session.patient_data.id} onLogout={handleLogout} />
  }

  if (viewMode === "register") {
    return (
      <PatientPortalRegistration
        onRegistrationComplete={handleRegistration}
        onBackToLogin={() => setViewMode("login")}
      />
    )
  }

  return <PatientPortalLogin onLogin={handleLogin} onRegister={() => setViewMode("register")} />
}
