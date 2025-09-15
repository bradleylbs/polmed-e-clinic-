"use client"

import { useState, useEffect } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { AppShell } from "@/components/layout/app-shell"
import { PatientList } from "@/components/patients/patient-list"
import { PatientRegistration } from "@/components/patients/patient-registration"
import { ClinicalWorkflow } from "@/components/patients/clinical-workflow"
import { RouteList } from "@/components/routes/route-list"
import { RoutePlanner } from "@/components/routes/route-planner"
import { AppointmentBooking } from "@/components/routes/appointment-booking"
import { InventoryDashboard } from "@/components/inventory/inventory-dashboard"
import { RoleDashboard } from "@/components/dashboard/role-dashboard"
import { UserManagement } from "@/components/admin/user-management"
import { SyncManager } from "@/components/offline/sync-manager"
import { offlineManager } from "@/lib/offline-manager"
import type { Patient as ApiPatient, Route as ApiRoute } from "@/lib/api-service"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface User {
  username: string
  role: UserRole
  mpNumber?: string
  assignedLocation?: string
  province?: string
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
  | "inventory"
  | "user-management"
  | "sync-manager"

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard")
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<RouteSchedule | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await offlineManager.init()
        console.log('Offline manager initialized successfully')
      } catch (error) {
        console.error('Failed to initialize offline manager:', error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeApp()
  }, [])

  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      try {
        if (event?.detail?.view) {
          const view = event.detail.view
          console.log('Navigation event received:', view)
          
          // Map navigation items to view modes
          switch (view) {
            case "patients":
              setViewMode("patients")
              setSelectedPatient(null) // Reset selected patient
              break
            case "routes":
              setViewMode("routes")
              setSelectedRoute(null) // Reset selected route
              break
            case "appointments":
              setViewMode("routes") // Appointments are handled in routes
              break
            case "inventory":
              setViewMode("inventory")
              break
            case "reports":
              setViewMode("dashboard") // For now, show dashboard for reports
              break
            case "settings":
              if (user?.role === "administrator") {
                setViewMode("user-management")
              } else {
                setViewMode("dashboard")
              }
              break
            case "sync":
              setViewMode("sync-manager")
              break
            default:
              setViewMode("dashboard")
          }
        }
      } catch (error) {
        console.error('Navigation error:', error)
        setViewMode("dashboard") // Fallback to dashboard on error
      }
    }

    window.addEventListener("navigate", handleNavigationEvent as EventListener)
    return () => window.removeEventListener("navigate", handleNavigationEvent as EventListener)
  }, [user])

  const handleLogin = (credentials: { email: string; password: string; role: UserRole; mpNumber?: string }) => {
    try {
      // Validate the role before setting user
      const validRoles: UserRole[] = ["administrator", "doctor", "nurse", "clerk", "social_worker"]
      
      if (!credentials.email || !credentials.password || !credentials.role) {
        console.error('Missing required credentials')
        return
      }

      if (!validRoles.includes(credentials.role)) {
        console.error('Invalid role:', credentials.role)
        return
      }

      const displayName = credentials.email.split('@')[0]

      const newUser: User = {
        username: displayName,
        role: credentials.role,
        mpNumber: credentials.mpNumber,
        assignedLocation: credentials.role === "doctor" ? `${displayName} Region` : "Mobile Clinic Unit 1",
        province: "Gauteng", // Default province, in real app this would come from backend
      }

      console.log('User logged in:', newUser)
      setUser(newUser)
      setViewMode("dashboard") // Start with dashboard
      
      // Clear any previous selections
      setSelectedPatient(null)
      setSelectedRoute(null)
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  const handleLogout = () => {
    try {
      console.log('User logged out')
      setUser(null)
      setViewMode("dashboard")
      setSelectedPatient(null)
      setSelectedRoute(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Patient Management Handlers
  const handlePatientSelect = (patient: ApiPatient) => {
    try {
      if (!patient || !patient.id) {
        console.error('Invalid patient selected:', patient)
        return
      }
      
      console.log('Patient selected:', patient)
      // Map API patient to local Patient model used by workflow screens
      const mappedPatient: Patient = {
        id: String(patient.id),
        fullName: patient.full_name,
        medicalAidNumber: patient.medical_aid_number,
        telephone: patient.telephone_number,
        email: patient.email || "",
        dateOfBirth: "",
        gender: "",
        isMember: !!patient.medical_aid_number && patient.medical_aid_number.startsWith('PAL'),
        workflowStatus: "registered",
      }
      setSelectedPatient(mappedPatient)
      setViewMode("patient-workflow")
    } catch (error) {
      console.error('Patient selection error:', error)
    }
  }

  const handleNewPatient = () => {
    try {
      console.log('Creating new patient')
      setSelectedPatient(null)
      setViewMode("patient-register")
    } catch (error) {
      console.error('New patient error:', error)
    }
  }

  const handlePatientRegistered = async (patient: any) => {
    try {
      console.log("Patient registered:", patient)

      if (!patient) {
        console.error('No patient data provided')
        return
      }

      // Save to offline storage
      const patientData = {
        ...patient,
        id: patient.id || `patient-${Date.now()}`,
        createdAt: new Date().toISOString(),
        synced: false,
      }

      await offlineManager.saveData("patients", patientData)
      console.log('Patient saved to offline storage')
      
      setViewMode("patients")
    } catch (error) {
      console.error('Failed to register patient:', error)
      // Still navigate back to patients list even if save failed
      setViewMode("patients")
    }
  }

  const handleWorkflowComplete = () => {
    try {
      console.log('Clinical workflow completed')
      setViewMode("patients")
      setSelectedPatient(null)
    } catch (error) {
      console.error('Workflow completion error:', error)
      setViewMode("patients")
      setSelectedPatient(null)
    }
  }

  // Route Management Handlers
  const handleRouteSelect = (route: ApiRoute) => {
    try {
      if (!route || !route.id) {
        console.error('Invalid route selected:', route)
        return
      }
      
      console.log('Route selected:', route)
      // Map API route to local RouteSchedule model
      const mappedRoute: RouteSchedule = {
        id: String(route.id),
        routeName: route.name,
        description: `${route.location} - ${route.province}`,
        locations: [],
        startDate: new Date(route.scheduled_date),
        endDate: new Date(route.scheduled_date),
        timeSlots: [],
        status: (['draft','published','active','completed'] as const).includes(route.status as any) ? (route.status as any) : 'draft',
        createdBy: 'system',
        createdAt: new Date(),
      }
      setSelectedRoute(mappedRoute)
      setViewMode("appointment-booking")
    } catch (error) {
      console.error('Route selection error:', error)
    }
  }

  const handleNewRoute = () => {
    try {
      console.log('Creating new route')
      setSelectedRoute(null)
      setViewMode("route-planner")
    } catch (error) {
      console.error('New route error:', error)
    }
  }

  const handleRouteCreated = async (route: RouteSchedule) => {
    try {
      console.log("Route created:", route)

      if (!route) {
        console.error('No route data provided')
        return
      }

      // Save to offline storage
      const routeData = {
        ...route,
        id: route.id || `route-${Date.now()}`,
        createdAt: new Date().toISOString(),
        synced: false,
      }

      await offlineManager.saveData("routes", routeData)
      console.log('Route saved to offline storage')
      
      setViewMode("routes")
    } catch (error) {
      console.error('Failed to create route:', error)
      // Still navigate back to routes list even if save failed
      setViewMode("routes")
    }
  }

  const handleAppointmentBooked = (appointment: Appointment) => {
    try {
      console.log("Appointment booked:", appointment)

      if (!appointment) {
        console.error('No appointment data provided')
        return
      }

      // Save to offline storage
      const appointmentData = {
        ...appointment,
        id: appointment.id || `appointment-${Date.now()}`,
        createdAt: new Date().toISOString(),
        synced: false,
      }

      // Fire and forget; handler is sync to match child prop type
      void offlineManager.saveData("appointments", appointmentData)
      console.log('Appointment saved to offline storage')
      
      setViewMode("routes")
      setSelectedRoute(null)
    } catch (error) {
      console.error('Failed to book appointment:', error)
      // Still navigate back to routes list even if save failed
      setViewMode("routes")
      setSelectedRoute(null)
    }
  }

  const handleBackToRoutes = () => {
    try {
      console.log('Navigating back to routes')
      setViewMode("routes")
      setSelectedRoute(null)
    } catch (error) {
      console.error('Back to routes error:', error)
      setViewMode("routes")
      setSelectedRoute(null)
    }
  }

  // Loading state
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing application...</p>
        </div>
      </div>
    )
  }

  // Login screen
  if (!user) {
    return <LoginForm onLogin={handleLogin} />
  }

  // Add error boundary for rendering
  const renderContent = () => {
    try {
      switch (viewMode) {
        case "dashboard":
          return <RoleDashboard user={user} />
          
        case "patient-register":
          return <PatientRegistration onPatientRegistered={handlePatientRegistered} userRole={user.role} />
          
        case "patient-workflow":
          return selectedPatient ? (
            <ClinicalWorkflow
              patientId={selectedPatient.id}
              patientName={selectedPatient.fullName}
              userRole={user.role}
              username={user.username}
              onWorkflowComplete={handleWorkflowComplete}
            />
          ) : (
            <div className="p-4 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800">No patient selected for workflow</p>
              </div>
              <button 
                onClick={() => setViewMode("patients")} 
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Go back to patients
              </button>
            </div>
          )
          
        case "routes":
          return <RouteList userRole={user.role} onRouteSelect={handleRouteSelect} onNewRoute={handleNewRoute} />
          
        case "route-planner":
          return <RoutePlanner userRole={user.role} onRouteCreated={handleRouteCreated} />
          
        case "appointment-booking":
          return selectedRoute ? (
            <AppointmentBooking
              route={selectedRoute}
              onAppointmentBooked={handleAppointmentBooked}
              onBack={handleBackToRoutes}
            />
          ) : (
            <div className="p-4 text-center">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-yellow-800">No route selected for appointment booking</p>
              </div>
              <button 
                onClick={() => setViewMode("routes")} 
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Go back to routes
              </button>
            </div>
          )
          
        case "inventory":
          return <InventoryDashboard userRole={user.role} />
          
        case "user-management":
          return user.role === "administrator" ? (
            <UserManagement currentUser={user} />
          ) : (
            <div className="p-4 text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-red-800">Access denied. Administrator privileges required.</p>
              </div>
              <button 
                onClick={() => setViewMode("dashboard")} 
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Go to dashboard
              </button>
            </div>
          )
          
        case "sync-manager":
          return <SyncManager />
          
        case "patients":
          return (
            <PatientList 
              userRole={user.role} 
              onPatientSelect={handlePatientSelect} 
              onNewPatient={handleNewPatient} 
            />
          )
          
        default:
          console.warn('Unknown view mode:', viewMode)
          return <RoleDashboard user={user} />
      }
    } catch (error) {
      console.error('Rendering error:', error)
      return (
        <div className="p-4 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <h3 className="text-red-800 font-semibold mb-2">Error Loading Content</h3>
            <p className="text-red-700">Something went wrong while loading this page.</p>
            <p className="text-red-600 text-sm mt-1">Please try refreshing or contact support if the problem persists.</p>
          </div>
          <div className="space-x-2">
            <button 
              onClick={() => setViewMode("dashboard")} 
              className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
            >
              Go to dashboard
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }
  }

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <div className="p-4">{renderContent()}</div>
    </AppShell>
  )
}