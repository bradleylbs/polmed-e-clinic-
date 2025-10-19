"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin, Phone, User, Search, Plus, Edit, CheckCircle, XCircle } from "lucide-react"
import { apiService, type Appointment as ApiAppointment } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"
import { offlineManager } from "@/lib/offline-manager"
import { handleUpdateWithFeedback } from "@/lib/feedback-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Appointment {
  id: string
  patient_name: string
  patient_phone: string
  medical_aid_number: string
  route_id: string
  route_name?: string
  location_name?: string
  location_city?: string
  location_province?: string
  appointment_date: string
  appointment_time?: string
  status: "confirmed" | "cancelled" | "completed" | "pending"
  created_at: string
  notes?: string
  booking_reference?: string
}

// Transform API appointment to component appointment
const transformApiAppointment = (apiAppt: ApiAppointment): Appointment => {
  const normalizedStatus = (apiAppt.status || "").toLowerCase()
  const mappedStatus: Appointment["status"] =
    normalizedStatus === "booked" || normalizedStatus === "confirmed"
      ? "confirmed"
      : normalizedStatus === "available"
        ? "pending"
        : normalizedStatus === "completed"
          ? "completed"
          : normalizedStatus === "cancelled"
            ? "cancelled"
            : "pending"

  return {
    id: apiAppt.id?.toString() || "",
  patient_name: apiAppt.patient_name || apiAppt.booked_by_name || "Unassigned",
  patient_phone: apiAppt.patient_phone || apiAppt.booked_by_phone || "",
    medical_aid_number: apiAppt.patient_medical_aid || "",
    route_id: apiAppt.route_location_id?.toString() || "",
  route_name: apiAppt.route_name,
  location_name: apiAppt.location_name,
  location_city: apiAppt.location_city,
  location_province: apiAppt.location_province,
    appointment_date: apiAppt.appointment_date,
    appointment_time: apiAppt.appointment_time,
    status: mappedStatus,
    created_at: apiAppt.created_at || "",
    notes: apiAppt.special_requirements,
    booking_reference: apiAppt.booking_reference || undefined,
  }
}

interface AppointmentListProps {
  userRole: string
  onNewAppointment?: () => void
  onEditAppointment?: (appointment: Appointment) => void
}

export function AppointmentList({ userRole, onNewAppointment, onEditAppointment }: AppointmentListProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadAppointments()
  }, [])

  useEffect(() => {
    filterAppointments()
  }, [appointments, searchTerm, statusFilter, dateFilter])

  const loadAppointments = async () => {
    try {
      setLoading(true)

      // Try to load from API first
      try {
        const response = await apiService.getAppointments()
        const transformedAppointments = (response.data || []).map(transformApiAppointment)
        setAppointments(transformedAppointments)
      } catch (apiError) {
        // Fallback to offline data
        const offlineData = await offlineManager.getData("appointments")
        setAppointments((offlineData as Appointment[]) || [])
      }
    } catch (error) {
      console.error("Failed to load appointments:", error)
      toast({
        title: "Error",
        description: "Failed to load appointments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAppointments = () => {
    let filtered = [...appointments]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (apt) =>
          apt.patient_name?.toLowerCase().includes(term) ||
          apt.medical_aid_number?.toLowerCase().includes(term) ||
          apt.patient_phone?.includes(term) ||
          apt.route_name?.toLowerCase().includes(term) ||
          apt.booking_reference?.toLowerCase().includes(term),
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((apt) => apt.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== "all") {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      filtered = filtered.filter((apt) => {
        const aptDate = new Date(apt.appointment_date)
        aptDate.setHours(0, 0, 0, 0)

        switch (dateFilter) {
          case "today":
            return aptDate.getTime() === today.getTime()
          case "upcoming":
            return aptDate >= today
          case "past":
            return aptDate < today
          default:
            return true
        }
      })
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())

    setFilteredAppointments(filtered)
  }

  const handleUpdateStatus = async (appointmentId: string, newStatus: "confirmed" | "cancelled" | "completed") => {
    const statusMessages = {
      confirmed: "Confirming appointment...",
      cancelled: "Cancelling appointment...",
      completed: "Marking appointment as completed...",
    }

    await handleUpdateWithFeedback(
      async () => {
        const numericId = parseInt(appointmentId, 10)
        if (isNaN(numericId)) {
          throw new Error("Invalid appointment ID")
        }

        // Map component status to API status
        const apiStatus =
          newStatus === "confirmed"
            ? "booked"
            : newStatus === "completed"
              ? "completed"
              : newStatus === "cancelled"
                ? "cancelled"
                : "available"

        const result = await apiService.updateAppointment(numericId, { status: apiStatus as any })

        if (!result.success) {
          throw new Error(result.error || "Failed to update appointment")
        }

        return result
      },
      toast,
      {
        loadingMessage: statusMessages[newStatus],
        successMessage: `✅ Appointment ${newStatus}!`,
        errorMessage: `❌ Failed to ${newStatus} appointment`,
        onSuccess: () => {
          loadAppointments()
        },
      }
    )
  }

  const handleDeleteAppointment = async () => {
    if (!appointmentToDelete) return

    try {
      const numericId = parseInt(appointmentToDelete.id, 10)
      if (isNaN(numericId)) {
        throw new Error('Invalid appointment ID')
      }
      
      await apiService.cancelAppointment(numericId)

      toast({
        title: "Appointment Deleted",
        description: "The appointment has been successfully deleted.",
      })

      setAppointmentToDelete(null)
      loadAppointments()
    } catch (error) {
      console.error("Failed to delete appointment:", error)
      toast({
        title: "Error",
        description: "Failed to delete appointment.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      confirmed: { variant: "default", label: "Confirmed" },
      pending: { variant: "secondary", label: "Pending" },
      completed: { variant: "outline", label: "Completed" },
      cancelled: { variant: "destructive", label: "Cancelled" },
    }

    const config = variants[status] || variants.pending
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const canManageAppointments = ["administrator", "clerk", "nurse"].includes(userRole)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading appointments...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Appointments</h2>
          <p className="text-muted-foreground">Manage patient appointments and schedules</p>
        </div>
        {canManageAppointments && onNewAppointment && (
          <Button onClick={onNewAppointment}>
            <Plus className="w-4 h-4 mr-2" />
            New Appointment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, or medical aid..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="past">Past</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {filteredAppointments.length} of {appointments.length} appointments
            </span>
            {(searchTerm || statusFilter !== "all" || dateFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("")
                  setStatusFilter("all")
                  setDateFilter("all")
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      {filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Appointments Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm || statusFilter !== "all" || dateFilter !== "all"
                ? "Try adjusting your filters to see more results."
                : "Get started by creating your first appointment."}
            </p>
            {canManageAppointments && onNewAppointment && (
              <Button onClick={onNewAppointment}>
                <Plus className="w-4 h-4 mr-2" />
                Create Appointment
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAppointments.map((appointment) => (
            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold text-lg">{appointment.patient_name}</span>
                        </div>
                        {appointment.booking_reference && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="uppercase tracking-wide">Reference</span>
                            <Badge variant="outline" className="font-mono">
                              {appointment.booking_reference}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {appointment.patient_phone || "Not provided"}
                          </span>
                          <span>Medical Aid: {appointment.medical_aid_number || "N/A"}</span>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(appointment.appointment_date)}</span>
                      </div>
                      {appointment.appointment_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>{appointment.appointment_time}</span>
                        </div>
                      )}
                      {appointment.location_name && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {appointment.location_name}
                            {appointment.location_city && `, ${appointment.location_city}`}
                            {appointment.location_province && ` (${appointment.location_province})`}
                          </span>
                        </div>
                      )}
                      {appointment.route_name && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{appointment.route_name}</span>
                        </div>
                      )}
                    </div>

                    {appointment.notes && <p className="text-sm text-muted-foreground italic">{appointment.notes}</p>}
                  </div>

                  {canManageAppointments && (
                    <div className="flex flex-wrap gap-2">
                      {appointment.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(appointment.id, "confirmed")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Confirm
                        </Button>
                      )}
                      {appointment.status === "confirmed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(appointment.id, "completed")}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      )}
                      {onEditAppointment && appointment.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={() => onEditAppointment(appointment)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      {appointment.status !== "completed" && (
                        <Button size="sm" variant="outline" onClick={() => setAppointmentToDelete(appointment)}>
                          <XCircle className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!appointmentToDelete} onOpenChange={() => setAppointmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the appointment for {appointmentToDelete?.patient_name}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancel Appointment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
