"use client"

import { useState, useEffect, useMemo } from "react"
import { Calendar, Clock, MapPin, Plus, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface TimeSlot {
  route_location_id: number
  date: string
  start_time: string
  end_time: string
  available_slots: number
  duration: number
  location: {
    id: number
    name: string
    city: string
    province: string
    address: string
  }
  route: {
    id: number
    name: string
    type: string
  }
}

interface Appointment {
  id: number
  booking_reference: string
  appointment_date: string
  appointment_time: string
  location_name: string
  city: string
  province: string
  status: string
  notes?: string
}

interface AppointmentSchedulerProps {
  patientId: number
}

export function AppointmentScheduler({ patientId }: AppointmentSchedulerProps) {
  const { toast } = useToast()
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false)
  const [showNewAppointment, setShowNewAppointment] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load upcoming appointments on component mount
  useEffect(() => {
    loadUpcomingAppointments()
  }, [patientId])

  const loadUpcomingAppointments = async () => {
    setIsLoadingAppointments(true)
    setError(null)
    try {
      const response = await patientPortalService.getPatientDashboard(patientId)
      if (response.success && response.data?.upcoming_appointments) {
        setUpcomingAppointments(response.data.upcoming_appointments)
      } else {
        setError(response.error || "Failed to load appointments")
        toast({
          title: "Error",
          description: response.error || "Failed to load appointments",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load appointments"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsLoadingAppointments(false)
    }
  }

  const slotsByLocation = useMemo(() => {
    return availableSlots.reduce<Record<string, { summary: TimeSlot; slots: TimeSlot[] }>>((acc, slot) => {
      const key = `${slot.location.id}-${slot.date}`
      if (!acc[key]) {
        acc[key] = { summary: slot, slots: [] }
      }
      acc[key].slots.push(slot)
      return acc
    }, {})
  }, [availableSlots])

  const loadAvailableSlots = async () => {
    if (!selectedDate) {
      setError("Please select a date")
      return
    }

    setIsLoadingSlots(true)
    setError(null)
    try {
      // Calculate date range - 30 days from selected date
      const selectedDateObj = new Date(selectedDate)
      const endDate = new Date(selectedDateObj)
      endDate.setDate(endDate.getDate() + 30)
      
      const dateToStr = endDate.toISOString().split("T")[0]
      
      const response = await patientPortalService.getAvailableAppointmentsForPatient(patientId, {
        date_from: selectedDate,
        date_to: dateToStr,
      })
      if (response.success && response.data) {
        setAvailableSlots(response.data)
      } else {
        setError(response.error || "Failed to load available slots")
        toast({
          title: "Error",
          description: response.error || "Failed to load available slots",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load available slots"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsLoadingSlots(false)
    }
  }

  const handleBookAppointment = async (slot: TimeSlot) => {
    try {
      const response = await patientPortalService.bookAppointmentViaPortal(
        patientId,
        slot.route_location_id,
        undefined
      )
      if (response.success) {
        toast({
          title: "Success",
          description: "Appointment booked successfully!",
        })
        setShowNewAppointment(false)
        setSelectedDate("")
        setAvailableSlots([])
        await loadUpcomingAppointments()
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to book appointment",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to book appointment"
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    }
  }

  const handleCancelAppointment = async (appointmentId: number) => {
    try {
      const response = await patientPortalService.cancelAppointmentViaPortal(
        appointmentId,
        "Patient requested cancellation"
      )
      if (response.success) {
        toast({
          title: "Success",
          description: "Appointment cancelled successfully",
        })
        await loadUpcomingAppointments()
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to cancel appointment",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to cancel appointment"
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 text-blue-800"
      case "completed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "rescheduled":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Appointments</h2>
          <p className="text-gray-600">Schedule and manage your appointments</p>
        </div>
        <Button onClick={() => setShowNewAppointment(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Appointment
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showNewAppointment && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule New Appointment</CardTitle>
            <CardDescription>Select your preferred date to view available appointment slots</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Preferred Date</Label>
              <div className="flex gap-2">
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                <Button onClick={loadAvailableSlots} disabled={!selectedDate || isLoadingSlots}>
                  {isLoadingSlots ? "Loading..." : "Find Slots"}
                </Button>
              </div>
            </div>

            {isLoadingSlots && (
              <div className="flex justify-center py-8">
                <div className="text-center">
                  <div className="spinner mb-2">Loading available slots...</div>
                </div>
              </div>
            )}

            {availableSlots.length > 0 && !isLoadingSlots && (
              <div className="space-y-3">
                <Label>Available Time Slots</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <Card key={slot.route_location_id} className="p-3 hover:bg-blue-50">
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-sm">{slot.location.name}</p>
                            <p className="text-xs text-gray-600">
                              {slot.location.city}, {slot.location.province}
                            </p>
                          </div>
                          <Badge variant="outline">{slot.available_slots} slots</Badge>
                        </div>
                        <div className="flex items-center text-sm text-gray-700">
                          <Clock className="w-4 h-4 mr-2" />
                          {slot.start_time} - {slot.end_time}
                        </div>
                        <p className="text-xs text-gray-500">{slot.route.name}</p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleBookAppointment(slot)}
                        >
                          Book Appointment
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {availableSlots.length > 0 && !isLoadingSlots && (
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Slot Overview</CardTitle>
                  <CardDescription>Quick glance at capacity per location and route</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.values(slotsByLocation).map(({ summary, slots }) => {
                    const totalAvailable = slots.reduce((sum, item) => sum + item.available_slots, 0)
                    return (
                      <div key={`${summary.location.id}-${summary.date}`} className="rounded-lg bg-muted/60 p-3 space-y-2">
                        <div className="flex flex-wrap justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{summary.location.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {summary.location.city}, {summary.location.province} • {summary.date}
                            </p>
                          </div>
                          <Badge variant="outline" className="bg-white">
                            {summary.route.name}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {slots.map((slot) => (
                            <span
                              key={`${slot.route_location_id}-${slot.start_time}`}
                              className="rounded-full bg-background px-3 py-1 border"
                            >
                              {slot.start_time} - {slot.end_time} • {slot.available_slots} open
                            </span>
                          ))}
                        </div>
                        <div className="text-xs font-medium text-muted-foreground">
                          Total available slots: {totalAvailable}
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {availableSlots.length === 0 && !isLoadingSlots && selectedDate && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>No available slots for the selected date. Please try another date.</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewAppointment(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Appointments</h3>
        {isLoadingAppointments ? (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">Loading appointments...</p>
            </CardContent>
          </Card>
        ) : upcomingAppointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No appointments scheduled</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowNewAppointment(true)}
              >
                Schedule Your First Appointment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {upcomingAppointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-4 flex-wrap">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-1" />
                          {appointment.appointment_date ? (() => {
                            try {
                              const dateParts = appointment.appointment_date.split('-')
                              if (dateParts.length === 3) {
                                return new Date(appointment.appointment_date + 'T00:00:00Z').toLocaleDateString()
                              }
                              return appointment.appointment_date
                            } catch {
                              return appointment.appointment_date
                            }
                          })() : 'N/A'}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="w-4 h-4 mr-1" />
                          {appointment.appointment_time}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          {appointment.location_name}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {appointment.city}, {appointment.province}
                      </p>
                      <p className="text-xs text-gray-500">Reference: {appointment.booking_reference}</p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge className={getStatusColor(appointment.status)}>
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </Badge>
                      {appointment.status === "scheduled" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancelAppointment(appointment.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
