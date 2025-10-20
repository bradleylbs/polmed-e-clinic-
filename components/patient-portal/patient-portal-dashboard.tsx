"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Calendar,
  Clock,
  MapPin,
  Heart,
  Activity,
  FileText,
  Bell,
  Settings,
  AlertCircle,
  Loader2,
  Plus,
  Eye,
} from "lucide-react"
import { patientPortalService, type PatientDashboardData } from "@/lib/patient-portal-service"
import { PatientAppointmentBooking } from "./patient-appointment-booking"
import { PatientHealthRecords } from "./patient-health-records"
import { PatientMedicalReports } from "./patient-medical-reports"
import { PatientNotifications } from "./patient-notifications"
import { PatientProfile } from "./patient-profile"
import { PatientFeedback } from "./patient-feedback"
import { useToast } from "@/hooks/use-toast"

interface PatientPortalDashboardProps {
  patientId: number
  onLogout: () => void
}

export function PatientPortalDashboard({ patientId, onLogout }: PatientPortalDashboardProps) {
  const [dashboardData, setDashboardData] = useState<PatientDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const { toast } = useToast()

  useEffect(() => {
    fetchDashboardData()
  }, [patientId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await patientPortalService.getPatientDashboard(patientId)

      if (response.success && response.data) {
        setDashboardData(response.data)
      } else {
        setError(response.error || "Failed to load dashboard data")
      }
    } catch (err) {
      setError("Network error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Failed to load dashboard"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const { patient_info, upcoming_appointments, recent_visits, health_summary, notifications } = dashboardData

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-4 flex-1">
              <Avatar className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm sm:text-lg">
                  {getInitials(patient_info.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold truncate">Welcome, {patient_info.full_name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant={patient_info.is_palmed_member ? "default" : "secondary"} className="text-xs sm:text-sm">
                    {patient_info.is_palmed_member ? `POLMED ${patient_info.member_type}` : "Non-member"}
                  </Badge>
                  <span className="text-xs sm:text-sm text-muted-foreground">{patient_info.medical_aid_number}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => setActiveTab("profile")} className="flex-1 sm:flex-none">
                <Settings className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Settings</span>
              </Button>
              <Button variant="outline" size="sm" onClick={onLogout} className="flex-1 sm:flex-none">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-6 space-y-4 sm:space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          {/* Mobile: Tabs in 3-column grid that wraps, Desktop: Full 7-column */}
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1 sm:gap-0 h-auto p-1 bg-muted/50">
            <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger value="appointments" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">Appointments</span>
              <span className="sm:hidden">Appts</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">Health Records</span>
              <span className="sm:hidden">Health</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">Medical Reports</span>
              <span className="sm:hidden">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm py-2">
              <div className="flex items-center gap-1">
                <span className="hidden sm:inline">Notifications</span>
                <span className="sm:hidden">Alert</span>
                {notifications && notifications.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1 py-0 min-w-[1.25rem] h-4 ml-0.5">
                    {notifications.length}
                  </Badge>
                )}
              </div>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs sm:text-sm py-2 hidden sm:inline-flex">
              <span>Feedback</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm py-2">
              <span className="hidden sm:inline">Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 sm:space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card className="shadow-sm">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold">{upcoming_appointments?.length || 0}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Upcoming Appts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Activity className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold">{health_summary.total_visits}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Visits</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Heart className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold">{health_summary.recent_diagnoses?.length || 0}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Diagnoses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Bell className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xl sm:text-2xl font-bold">{notifications?.length || 0}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Notifications</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Appointments */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Upcoming Appointments
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("appointments")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Book New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upcoming_appointments && upcoming_appointments.length > 0 ? (
                  <div className="space-y-4">
                    {upcoming_appointments.slice(0, 3).map((appointment) => (
                      <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <p className="text-lg font-semibold">
                              {formatDate(appointment.appointment_date).split(" ")[0]}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(appointment.appointment_date).split(" ")[1]}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">{appointment.location_name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(appointment.appointment_time)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {appointment.city}, {appointment.province}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{appointment.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">Ref: {appointment.booking_reference}</p>
                        </div>
                      </div>
                    ))}
                    {upcoming_appointments.length > 3 && (
                      <Button variant="ghost" className="w-full" onClick={() => setActiveTab("appointments")}>
                        View All {upcoming_appointments.length} Appointments
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                    <Button onClick={() => setActiveTab("appointments")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Book Your First Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Visits */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Recent Visits
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("health")}>
                    <Eye className="w-4 h-4 mr-2" />
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {recent_visits && recent_visits.length > 0 ? (
                  <div className="space-y-4">
                    {recent_visits.slice(0, 3).map((visit) => (
                      <div key={visit.visit_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{visit.location_name}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(visit.visit_date)}</p>
                          {visit.chief_complaint && <p className="text-sm mt-1">{visit.chief_complaint}</p>}
                        </div>
                        <div className="text-right">
                          <Badge variant={visit.is_completed ? "default" : "secondary"}>
                            {visit.is_completed ? "Completed" : "In Progress"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {visit.completed_stages}/{visit.total_stages} stages
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No recent visits</p>
                )}
              </CardContent>
            </Card>

            {/* Health Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Health Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {health_summary.chronic_conditions && health_summary.chronic_conditions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Chronic Conditions</h4>
                    <div className="flex flex-wrap gap-2">
                      {health_summary.chronic_conditions.map((condition, index) => (
                        <Badge key={index} variant="outline">
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {health_summary.allergies && health_summary.allergies.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Allergies</h4>
                    <div className="flex flex-wrap gap-2">
                      {health_summary.allergies.map((allergy, index) => (
                        <Badge key={index} variant="destructive">
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {health_summary.current_medications && health_summary.current_medications.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Current Medications</h4>
                    <div className="flex flex-wrap gap-2">
                      {health_summary.current_medications.map((medication, index) => (
                        <Badge key={index} variant="secondary">
                          {medication}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(!health_summary.chronic_conditions || health_summary.chronic_conditions.length === 0) &&
                  (!health_summary.allergies || health_summary.allergies.length === 0) &&
                  (!health_summary.current_medications || health_summary.current_medications.length === 0) && (
                    <p className="text-muted-foreground text-center py-4">No health conditions recorded</p>
                  )}
              </CardContent>
            </Card>

            {/* Medical Reports */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Medical Reports
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("reports")}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Reports
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Medical reports from your completed visits are available for download, printing, and sharing.
                </p>
                <Button 
                  onClick={() => setActiveTab("reports")}
                  className="w-full"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Access Your Medical Reports
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <PatientAppointmentBooking patientId={patientId} />
          </TabsContent>

          <TabsContent value="health">
            <PatientHealthRecords patientId={patientId} />
          </TabsContent>

          <TabsContent value="reports">
            <PatientMedicalReports 
              patientId={patientId} 
              patientName={patient_info?.full_name || "Patient"} 
            />
          </TabsContent>

          <TabsContent value="notifications">
            <PatientNotifications patientId={patientId} />
          </TabsContent>

          <TabsContent value="feedback">
            <PatientFeedback patientId={patientId} />
          </TabsContent>

          <TabsContent value="profile">
            <PatientProfile patientId={patientId} patientData={patient_info} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default PatientPortalDashboard
