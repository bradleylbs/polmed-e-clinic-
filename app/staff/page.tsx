"use client"

import { useState, useEffect, useCallback } from "react"
import type { ReactElement } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { AppShell } from "@/components/layout/app-shell"
import { PatientList } from "@/components/patients/patient-list"
import { PatientRegistration } from "@/components/patients/patient-registration"
import { ClinicalWorkflow } from "@/components/patients/clinical-workflow"
import { RouteList } from "@/components/routes/route-list"
import { RoutePlanner } from "@/components/routes/route-planner"
import { AppointmentBooking } from "@/components/routes/appointment-booking"
import { AppointmentList } from "@/components/appointments/appointment-list"
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard"
import { RoleDashboard } from "@/components/dashboard/role-dashboard"
import { UserManagement } from "@/components/admin/user-management"
import { SyncManager } from "@/components/offline/sync-manager"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/hooks/use-toast"
import { usePersistentAuth } from "@/hooks/use-persistent-auth"
import { authPersistence } from "@/lib/auth-persistence"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, RefreshCcw, Home, ShieldAlert } from "lucide-react"
import type { Patient as ApiPatient, Route as ApiRoute } from "@/lib/api-service"
import { ErrorFallback } from "@/components/ui/error-fallback" // Import ErrorFallback component

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface User {
  username: string
  role: UserRole
  mpNumber?: string
  assignedLocation?: string
  province?: string
  loginTime?: number
  sessionId?: string
}

interface Patient {
  id: string
  fullName: string
  medicalAidNumber: string
  telephone: string
  email: string
  dateOfBirth: string
  gender: string
  isMember: boolean
  membershipStatus?: "active" | "inactive" | "pending"
  lastVisit?: string
  workflowStatus: "registered" | "in-progress" | "completed"
  assignedTo?: string
}

interface RouteLocation {
  id: string
  name: string
  type: "police_station" | "school" | "community_center"
  address: string
  province: string
  capacity: number
  contactPerson?: string
  contactPhone?: string
}

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  maxAppointments: number
  bookedAppointments: number
  locationId: string
}

interface RouteSchedule {
  id: string
  routeName: string
  description: string
  locations: RouteLocation[]
  startDate: Date
  endDate: Date
  timeSlots: TimeSlot[]
  status: "draft" | "published" | "active" | "completed"
  createdBy: string
  createdAt: Date
}

interface Appointment {
  id: string
  patientName: string
  patientPhone: string
  medicalAidNumber: string
  routeId: string
  locationId: string
  timeSlotId: string
  appointmentDate: Date
  status: "confirmed" | "cancelled" | "completed" | "pending_sync"
  createdAt: Date
}

type ViewMode =
  | "dashboard"
  | "patients"
  | "patient-register"
  | "patient-workflow"
  | "routes"
  | "route-planner"
  | "appointment-booking"
  | "appointments"
  | "inventory"
  | "user-management"
  | "sync-manager"

type InitializationStatus = "initializing" | "ready" | "error"

interface AppError {
  title: string
  message: string
  action?: () => void
  actionLabel?: string
}

const VALID_ROLES: UserRole[] = ["administrator", "doctor", "nurse", "clerk", "social_worker"]
const SESSION_STORAGE_KEY = "staff_session"
const PERSISTENT_SESSION_KEY = "staff_session_persistent" // For persistent login across browser closures
const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000 // 8 hours

const roleConfig: Record<UserRole, { label: string }> = {
  administrator: { label: "Administrator" },
  doctor: { label: "Doctor" },
  nurse: { label: "Nurse" },
  clerk: { label: "Clerk" },
  social_worker: { label: "Social Worker" },
}

const ROLE_PRIMARY_VIEW: Record<UserRole, ViewMode> = {
  administrator: "dashboard",
  doctor: "patients",
  nurse: "patients",
  clerk: "patient-register",
  social_worker: "patients",
}

const NAV_SYNC_MAP: Partial<Record<ViewMode, string>> = {
  patients: "patients",
  routes: "routes",
  appointments: "appointments",
  inventory: "inventory",
}

export default function StaffHomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteSchedule | null>(null)
  const [routeToEdit, setRouteToEdit] = useState<{
    id?: number
    name: string
    description?: string
    province: string
    scheduled_date: string
    start_time?: string
    end_time?: string
    route_type?: string
    max_appointments?: number
  } | null>(null)
  const [initStatus, setInitStatus] = useState<InitializationStatus>("initializing")
  const [appError, setAppError] = useState<AppError | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const { toast } = useToast()

  const syncNavigationTab = useCallback((view: ViewMode) => {
    const navTarget = NAV_SYNC_MAP[view]
    if (!navTarget) return

    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("navigate", { detail: { view: navTarget } }))
      }
    } catch (eventError) {
      console.warn("Failed to sync navigation tab:", eventError)
    }
  }, [])

  const applyRoleLandingPage = useCallback(
    (role: UserRole | null | undefined) => {
      if (!role) return

      const normalizedRole = String(role).toLowerCase().replace(/\s+/g, "_") as UserRole
      const defaultView = ROLE_PRIMARY_VIEW[normalizedRole] || "dashboard"

      setViewMode(defaultView)
      syncNavigationTab(defaultView)
    },
    [syncNavigationTab],
  )

  // Session management utilities
  const saveSession = useCallback(
    (userData: User) => {
      try {
        const sessionData = {
          ...userData,
          loginTime: Date.now(),
          sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }
        // Save to both sessionStorage and localStorage for persistence
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
        localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(sessionData))
        setUser(sessionData)
      } catch (error) {
        console.error("Failed to save session:", error)
        toast({
          title: "Session Error",
          description: "Failed to save session. Your session may not persist.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const clearSession = useCallback(() => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      localStorage.removeItem(PERSISTENT_SESSION_KEY) // Also remove persistent session
      setUser(null)
      setViewMode("dashboard")
      setSelectedPatient(null)
      setSelectedRoute(null)
      setRouteToEdit(null)
    } catch (error) {
      console.error("Failed to clear session:", error)
    }
  }, [])

  const isSessionValid = useCallback((sessionData: User): boolean => {
    if (!sessionData?.username || !sessionData?.role) {
      return false
    }

    if (sessionData.loginTime) {
      const now = Date.now()
      if (now - sessionData.loginTime > SESSION_EXPIRY_MS) {
        return false
      }
    }

    return VALID_ROLES.includes(sessionData.role)
  }, [])

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setInitStatus("initializing")

        // Initialize offline manager
        await offlineManager.init()
        console.log("Offline manager initialized successfully")

        // Check for existing session (in order of priority: sessionStorage first, then persistent storage)
        try {
          let savedSession = sessionStorage.getItem(SESSION_STORAGE_KEY)
          
          // If no session in sessionStorage, check persistent storage
          if (!savedSession) {
            savedSession = localStorage.getItem(PERSISTENT_SESSION_KEY)
          }

          if (savedSession) {
            const sessionData: User = JSON.parse(savedSession)

            if (isSessionValid(sessionData)) {
              // Restore session to both storages
              sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
              localStorage.setItem(PERSISTENT_SESSION_KEY, JSON.stringify(sessionData))
              
              setUser(sessionData)
              applyRoleLandingPage(sessionData.role)
              toast({
                title: "Welcome back!",
                description: `Hello ${sessionData.username}`,
              })
            } else {
              clearSession()
              if (sessionData.loginTime && Date.now() - sessionData.loginTime > SESSION_EXPIRY_MS) {
                toast({
                  title: "Session Expired",
                  description: "Please log in again to continue.",
                  variant: "destructive",
                })
              }
            }
          }
        } catch (sessionError) {
          console.error("Failed to restore session:", sessionError)
          clearSession()
        }

        // Check for deep-link view parameter
        try {
          const urlParams = new URLSearchParams(window.location.search)
          const viewParam = urlParams.get("view")?.toLowerCase()

          if (viewParam) {
            const viewMap: Record<string, ViewMode> = {
              appointments: "appointments",
              routes: "routes",
              "route-planner": "route-planner",
              patients: "patients",
              inventory: "inventory",
              dashboard: "dashboard",
            }

            const mappedView = viewMap[viewParam]
            if (mappedView && user) {
              setViewMode(mappedView)
            }
          }
        } catch (urlError) {
          console.warn("Failed to parse view parameter:", urlError)
        }

        setInitStatus("ready")
      } catch (error) {
        console.error("Failed to initialize application:", error)
        setInitStatus("error")
        setAppError({
          title: "Initialization Failed",
          message: "Failed to initialize the application. Please refresh the page to try again.",
          action: () => window.location.reload(),
          actionLabel: "Refresh Page",
        })
      }
    }

    initializeApp()
  }, [isSessionValid, clearSession, toast, applyRoleLandingPage])

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      toast({
        title: "Back Online",
        description: "Your connection has been restored.",
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast({
        title: "You're Offline",
        description: "Changes will be saved locally and synced when you're back online.",
        variant: "destructive",
      })
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [toast])

  // Session expiry check
  useEffect(() => {
    if (!user) return

    const checkSessionExpiry = () => {
      if (!isSessionValid(user)) {
        handleLogout()
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        })
      }
    }

    // Check every 5 minutes
    const interval = setInterval(checkSessionExpiry, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [user, isSessionValid, toast])

  // Navigation event handler
  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      try {
        const view = event?.detail?.view
        if (!view) return

        console.log("Navigation event received:", view)

        const navigationMap: Record<string, () => void> = {
          patients: () => {
            setViewMode("patients")
            setSelectedPatient(null)
          },
          routes: () => {
            setViewMode("routes")
            setSelectedRoute(null)
          },
          appointments: () => {
            setViewMode("appointments")
          },
          inventory: () => {
            setViewMode("inventory")
          },
          reports: () => {
            setViewMode("dashboard")
          },
          settings: () => {
            if (user?.role === "administrator") {
              setViewMode("user-management")
            } else {
              setViewMode("dashboard")
              toast({
                title: "Access Denied",
                description: "Administrator privileges required.",
                variant: "destructive",
              })
            }
          },
          sync: () => {
            setViewMode("sync-manager")
          },
        }

        const handler = navigationMap[view] || (() => setViewMode("dashboard"))
        handler()
      } catch (error) {
        console.error("Navigation error:", error)
        setViewMode("dashboard")
        toast({
          title: "Navigation Error",
          description: "Failed to navigate. Returning to dashboard.",
          variant: "destructive",
        })
      }
    }

    window.addEventListener("navigate", handleNavigationEvent as EventListener)
    return () => window.removeEventListener("navigate", handleNavigationEvent as EventListener)
  }, [user, toast])

  // Login handler with validation
  const handleLogin = useCallback(
    (credentials: {
      email: string
      password: string
      role: UserRole
      mpNumber?: string
      userData?: any // Add userData from backend
      token?: string // Add token from backend
    }) => {
      try {
        console.log("[v0] Processing login with credentials:", { email: credentials.email, role: credentials.role })

        // Validate credentials
        if (!credentials.email || !credentials.password || !credentials.role) {
          toast({
            title: "Invalid Credentials",
            description: "Please provide all required information.",
            variant: "destructive",
          })
          return
        }

        const normalizedRole = String(credentials.role).toLowerCase().replace(/\s+/g, "_") as UserRole

        if (!VALID_ROLES.includes(normalizedRole)) {
          console.error("[v0] Invalid role after normalization:", normalizedRole, "Valid roles:", VALID_ROLES)
          toast({
            title: "Invalid Role",
            description: `The role "${credentials.role}" is not valid. Please contact support.`,
            variant: "destructive",
          })
          return
        }

        const displayName = credentials.userData?.first_name
          ? `${credentials.userData.first_name} ${credentials.userData.last_name}`
          : credentials.email.split("@")[0]

        const newUser: User = {
          username: displayName,
          role: normalizedRole, // Use normalized role
          mpNumber: credentials.mpNumber || credentials.userData?.mp_number,
          assignedLocation: credentials.userData?.assigned_location || "Mobile Clinic Unit 1",
          province: credentials.userData?.assigned_province || "Gauteng",
        }

        console.log("[v0] User object created with normalized role:", JSON.stringify(newUser, null, 2))

        // Save to both local session and persistent storage
        saveSession(newUser)
        
        // Also save to persistent auth manager for cross-session persistence
        authPersistence.saveSession("staff", newUser, credentials.token, SESSION_EXPIRY_MS)
        
        applyRoleLandingPage(newUser.role)

        toast({
          title: "Login Successful",
          description: `Welcome, ${displayName}! You are logged in as ${roleConfig[normalizedRole]?.label || normalizedRole}.`,
        })

        // Clear previous selections
        setSelectedPatient(null)
        setSelectedRoute(null)
        setRouteToEdit(null)
      } catch (error) {
        console.error("[v0] Login error:", error)
        toast({
          title: "Login Failed",
          description: "An error occurred during login. Please try again.",
          variant: "destructive",
        })
      }
    },
    [saveSession, toast, applyRoleLandingPage],
  )

  // Logout handler
  const handleLogout = useCallback(() => {
    try {
      console.log("User logged out")
      clearSession()

      toast({
        title: "Logged Out",
        description: "You have been logged out successfully.",
      })
    } catch (error) {
      console.error("Logout error:", error)
      toast({
        title: "Logout Error",
        description: "An error occurred during logout.",
        variant: "destructive",
      })
    }
  }, [clearSession, toast])

  // Patient management handlers
  const handlePatientSelect = useCallback(
    (patient: ApiPatient) => {
      try {
        if (!patient?.id) {
          throw new Error("Invalid patient data")
        }

        console.log("Patient selected:", patient)

        const mappedPatient: Patient = {
          id: String(patient.id),
          fullName: patient.full_name,
          medicalAidNumber: patient.medical_aid_number,
          telephone: patient.telephone_number,
          email: patient.email || "",
          dateOfBirth: "",
          gender: "",
          isMember: !!patient.medical_aid_number && patient.medical_aid_number.startsWith(" POL"),
          workflowStatus: "registered",
        }

        setSelectedPatient(mappedPatient)
        setViewMode("patient-workflow")
      } catch (error) {
        console.error("Patient selection error:", error)
        toast({
          title: "Selection Error",
          description: "Failed to select patient. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const handleNewPatient = useCallback(() => {
    console.log("Creating new patient")
    setSelectedPatient(null)
    setViewMode("patient-register")
  }, [])

  const handlePatientRegistered = useCallback(
    async (patient: any) => {
      try {
        if (!patient) {
          throw new Error("No patient data provided")
        }

        console.log("Patient registered:", patient)

        const patientData = {
          ...patient,
          id: patient.id || `patient-${Date.now()}`,
          createdAt: new Date().toISOString(),
          synced: false,
        }

        await offlineManager.saveData("patients", patientData)
        console.log("Patient saved to offline storage")

        toast({
          title: "Patient Registered",
          description: "Patient has been successfully registered.",
        })

        setViewMode("patients")
      } catch (error) {
        console.error("Failed to register patient:", error)
        toast({
          title: "Registration Error",
          description: "Failed to save patient data. Please try again.",
          variant: "destructive",
        })
        setViewMode("patients")
      }
    },
    [toast],
  )

  const handleWorkflowComplete = useCallback(() => {
    console.log("Clinical workflow completed")

    toast({
      title: "Workflow Complete",
      description: "Patient workflow has been completed successfully.",
    })

    setViewMode("patients")
    setSelectedPatient(null)
  }, [toast])

  // Route management handlers
  const handleRouteSelect = useCallback(
    (route: ApiRoute) => {
      try {
        if (!route?.id) {
          throw new Error("Invalid route data")
        }

        console.log("Route selected:", route)

        const mappedRoute: RouteSchedule = {
          id: String(route.id),
          routeName: route.name || route.route_name || "Unnamed Route",
          description: `${route.location || "Unknown Location"} - ${route.province || "Unknown Province"}`,
          locations: [],
          startDate: new Date(route.scheduled_date || route.start_date || new Date().toISOString()),
          endDate: new Date(route.scheduled_date || route.end_date || new Date().toISOString()),
          timeSlots: [],
          status: (["draft", "published", "active", "completed"] as const).includes(route.status as any)
            ? (route.status as any)
            : "draft",
          createdBy: "system",
          createdAt: new Date(),
        }

        setSelectedRoute(mappedRoute)
        setViewMode("appointment-booking")
      } catch (error) {
        console.error("Route selection error:", error)
        toast({
          title: "Selection Error",
          description: "Failed to select route. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const handleNewRoute = useCallback(() => {
    console.log("Creating new route")
    setSelectedRoute(null)
    setRouteToEdit(null)
    setViewMode("route-planner")
  }, [])

  const handleEditRoute = useCallback(
    (route: ApiRoute) => {
      try {
        if (!route?.id) {
          throw new Error("Invalid route data")
        }

        // Transform ApiRoute to RoutePlanner expected format
        const transformedRoute = {
          id: typeof route.id === 'string' ? parseInt(route.id, 10) : route.id,
          name: route.name || route.route_name || "Unnamed Route",
          description: route.description || `${route.location || "Unknown Location"} - ${route.province || "Unknown Province"}`,
          province: route.province || "Gauteng",
          scheduled_date: route.scheduled_date || route.start_date || new Date().toISOString().split('T')[0],
          start_time: route.start_time,
          end_time: route.end_time,
          route_type: route.route_type,
          max_appointments: route.max_appointments || route.max_appointments_per_day,
        }

        setRouteToEdit(transformedRoute)
        setViewMode("route-planner")
      } catch (error) {
        console.error("Edit route error:", error)
        toast({
          title: "Edit Error",
          description: "Failed to load route for editing.",
          variant: "destructive",
        })
      }
    },
    [toast],
  )

  const handleRouteCreated = useCallback(
    async (route: RouteSchedule) => {
      try {
        if (!route) {
          throw new Error("No route data provided")
        }

        console.log("Route created:", route)

        const routeData = {
          ...route,
          id: route.id || `route-${Date.now()}`,
          createdAt: new Date().toISOString(),
          synced: false,
        }

        await offlineManager.saveData("routes", routeData)
        console.log("Route saved to offline storage")

        toast({
          title: "Route Created",
          description: "Route has been successfully created.",
        })

        setViewMode("routes")
      } catch (error) {
        console.error("Failed to create route:", error)
        toast({
          title: "Creation Error",
          description: "Failed to save route data. Please try again.",
          variant: "destructive",
        })
        setViewMode("routes")
      }
    },
    [toast],
  )

  const handleAppointmentBooked = useCallback(
    async (appointment: Appointment) => {
      try {
        if (!appointment) {
          throw new Error("No appointment data provided")
        }

        console.log("Appointment booked:", appointment)

        const appointmentData = {
          ...appointment,
          id: appointment.id || `appointment-${Date.now()}`,
          createdAt: new Date().toISOString(),
          synced: false,
        }

        await offlineManager.saveData("appointments", appointmentData)
        console.log("Appointment saved to offline storage")

        toast({
          title: "Appointment Booked",
          description: "Appointment has been successfully booked.",
        })

        setViewMode("routes")
        setSelectedRoute(null)
      } catch (error) {
        console.error("Failed to book appointment:", error)
        toast({
          title: "Booking Error",
          description: "Failed to save appointment data. Please try again.",
          variant: "destructive",
        })
        setViewMode("routes")
        setSelectedRoute(null)
      }
    },
    [toast],
  )

  const handleBackToRoutes = useCallback(() => {
    console.log("Navigating back to routes")
    setViewMode("routes")
    setSelectedRoute(null)
  }, [])

  // Error boundary renderer
  const renderError = useCallback(
    (error: AppError) => (
      <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl animate-fade-in">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-destructive">{error.title}</h2>
                <p className="text-muted-foreground">{error.message}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                {error.action && error.actionLabel && (
                  <Button onClick={error.action} className="flex-1">
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    {error.actionLabel}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewMode("dashboard")} className="flex-1">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    [],
  )

  // Content renderer with error handling
  const renderContent = useCallback(() => {
    try {
      const viewComponents: Record<ViewMode, ReactElement> = {
        dashboard: <RoleDashboard user={user!} />,
        "patient-register": <PatientRegistration onPatientRegistered={handlePatientRegistered} userRole={user!.role} />,
        "patient-workflow": selectedPatient ? (
          <ClinicalWorkflow
            patientId={selectedPatient.id}
            patientName={selectedPatient.fullName}
            userRole={user!.role}
            username={user!.username}
            onWorkflowComplete={handleWorkflowComplete}
          />
        ) : (
          <ErrorFallback
            title="No Patient Selected"
            message="Please select a patient from the patient list to continue."
            onAction={() => setViewMode("patients")}
            actionLabel="Go to Patients"
          />
        ),
        patients: (
          <PatientList userRole={user!.role} onPatientSelect={handlePatientSelect} onNewPatient={handleNewPatient} />
        ),
        routes: (
          <RouteList
            userRole={user!.role}
            onRouteSelect={handleRouteSelect}
            onNewRoute={handleNewRoute}
            onEditRoute={handleEditRoute}
          />
        ),
        "route-planner": (
          <RoutePlanner
            userRole={user!.role}
            onRouteCreated={handleRouteCreated}
            routeToEdit={routeToEdit}
            onRouteUpdated={() => {
              setViewMode("routes")
              setRouteToEdit(null)
            }}
          />
        ),
        "appointment-booking": selectedRoute ? (
          <AppointmentBooking
            route={selectedRoute}
            onAppointmentBooked={handleAppointmentBooked}
            onBack={handleBackToRoutes}
          />
        ) : (
          <ErrorFallback
            title="No Route Selected"
            message="Please select a route from the routes list to book appointments."
            onAction={() => setViewMode("routes")}
            actionLabel="Go to Routes"
          />
        ),
        appointments: <AppointmentList userRole={user!.role} />,
        inventory: <InventoryDashboard userRole={user!.role} />,
        "user-management":
          user!.role === "administrator" ? (
            <UserManagement currentUser={user!} />
          ) : (
            <ErrorFallback
              title="Access Denied"
              message="Administrator privileges required to access user management."
              onAction={() => setViewMode("dashboard")}
              actionLabel="Go to Dashboard"
              icon={<ShieldAlert className="w-10 h-10 text-destructive" />}
            />
          ),
        "sync-manager": <SyncManager />,
      }

      return viewComponents[viewMode] || <RoleDashboard user={user!} />
    } catch (error) {
      console.error("Rendering error:", error)
      return (
        <ErrorFallback
          title="Error Loading Content"
          message="Something went wrong while loading this page. Please try refreshing or contact support if the problem persists."
          onAction={() => window.location.reload()}
          actionLabel="Refresh Page"
          secondaryAction={() => setViewMode("dashboard")}
          secondaryActionLabel="Go to Dashboard"
        />
      )
    }
  }, [
    viewMode,
    user,
    selectedPatient,
    selectedRoute,
    routeToEdit,
    handlePatientRegistered,
    handleWorkflowComplete,
    handlePatientSelect,
    handleNewPatient,
    handleRouteSelect,
    handleNewRoute,
    handleEditRoute,
    handleRouteCreated,
    handleAppointmentBooked,
    handleBackToRoutes,
  ])

  // Loading state
  if (initStatus === "initializing") {
    return (
      <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
        <div className="text-center space-y-6 animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <div className="absolute inset-0 h-16 w-16 animate-pulse rounded-full border-4 border-primary/20 mx-auto" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-medium text-foreground">Initializing Application</p>
            <p className="text-sm text-muted-foreground">Setting up your workspace...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (initStatus === "error" && appError) {
    return renderError(appError)
  }

  // Login screen
  if (!user) {
    return (
      <div className="animate-fade-in">
        <LoginForm onLogin={handleLogin} />
      </div>
    )
  }

  // Main application
  return (
    <AppShell user={user} onLogout={handleLogout}>
      {/* Offline indicator */}
      <div
        className={`fixed top-0 left-0 right-0 z-9998 transform transition-all duration-300 ${
          isOnline ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>You're Offline</AlertTitle>
          <AlertDescription>Changes will be saved locally and synced when you're back online.</AlertDescription>
        </Alert>
      </div>

      <div className="p-4 animate-fade-in">{renderContent()}</div>
    </AppShell>
  )
}
