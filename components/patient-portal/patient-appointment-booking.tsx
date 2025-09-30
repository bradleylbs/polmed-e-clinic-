"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Calendar, Clock, MapPin, Search, CheckCircle, AlertCircle, Loader2, X } from "lucide-react"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface PatientAppointmentBookingProps {
  patientId: number
}

interface AvailableAppointment {
  appointment_id: number
  route_location_id: number
  location_name: string
  address: string
  city: string
  province: string
  appointment_date: string
  appointment_time: string
  distance_km: number
  available_slots: number
}

interface BookingFilters {
  province: string
  city: string
  date_from: string
  date_to: string
  max_distance_km: number
}

export function PatientAppointmentBooking({ patientId }: PatientAppointmentBookingProps) {
  const [availableAppointments, setAvailableAppointments] = useState<AvailableAppointment[]>([])
  const [loading, setLoading] = useState(false)
  const [bookingLoading, setBookingLoading] = useState<number | null>(null)
  const [filters, setFilters] = useState<BookingFilters>({
    province: "Any Province",
    city: "",
    date_from: "",
    date_to: "",
    max_distance_km: 50,
  })
  const [selectedAppointment, setSelectedAppointment] = useState<AvailableAppointment | null>(null)
  const [bookingNotes, setBookingNotes] = useState("")
  const [showBookingForm, setShowBookingForm] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Set default date range (next 30 days)
    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setDate(today.getDate() + 30)

    setFilters((prev) => ({
      ...prev,
      date_from: today.toISOString().split("T")[0],
      date_to: nextMonth.toISOString().split("T")[0],
    }))
  }, [])

  useEffect(() => {
    if (filters.date_from && filters.date_to) {
      searchAppointments()
    }
  }, [filters.date_from, filters.date_to])

  const searchAppointments = async () => {
    setLoading(true)
    try {
      const response = await patientPortalService.getAvailableAppointmentsForPatient(patientId, {
        province: filters.province === "Any Province" ? undefined : filters.province,
        city: filters.city || undefined,
        date_from: filters.date_from,
        date_to: filters.date_to,
        max_distance_km: filters.max_distance_km,
      })

      if (response.success && response.data) {
        setAvailableAppointments(response.data)
      } else {
        toast({
          title: "Search Failed",
          description: response.error || "Failed to search appointments",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Search Error",
        description: "An error occurred while searching for appointments",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBookAppointment = async () => {
    if (!selectedAppointment) return

    setBookingLoading(selectedAppointment.appointment_id)
    try {
      const response = await patientPortalService.bookAppointmentViaPortal(
        patientId,
        selectedAppointment.appointment_id,
        bookingNotes || undefined,
      )

      if (response.success && response.data) {
        toast({
          title: "Appointment Booked Successfully",
          description: `Your booking reference is ${response.data.booking_reference}`,
        })

        // Reset form and refresh appointments
        setShowBookingForm(false)
        setSelectedAppointment(null)
        setBookingNotes("")
        searchAppointments()
      } else {
        toast({
          title: "Booking Failed",
          description: response.error || "Failed to book appointment",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Booking Error",
        description: "An error occurred while booking the appointment",
        variant: "destructive",
      })
    } finally {
      setBookingLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      weekday: "short",
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

  const getDistanceColor = (distance: number) => {
    if (distance === 0) return "text-green-600"
    if (distance <= 25) return "text-blue-600"
    if (distance <= 50) return "text-orange-600"
    return "text-red-600"
  }

  const getAvailabilityColor = (slots: number) => {
    if (slots >= 10) return "text-green-600"
    if (slots >= 5) return "text-orange-600"
    return "text-red-600"
  }

  if (showBookingForm && selectedAppointment) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Confirm Appointment Booking</CardTitle>
              <CardDescription>Review your appointment details and confirm booking</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowBookingForm(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Appointment Details */}
          <div className="p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-3">Appointment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Location</Label>
                <p className="text-sm">{selectedAppointment.location_name}</p>
                <p className="text-xs text-muted-foreground">{selectedAppointment.address}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAppointment.city}, {selectedAppointment.province}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Date & Time</Label>
                <p className="text-sm">{formatDate(selectedAppointment.appointment_date)}</p>
                <p className="text-sm">{formatTime(selectedAppointment.appointment_time)}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Distance</Label>
                <p className={`text-sm ${getDistanceColor(selectedAppointment.distance_km)}`}>
                  {selectedAppointment.distance_km === 0 ? "Your area" : `~${selectedAppointment.distance_km}km away`}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium">Availability</Label>
                <p className={`text-sm ${getAvailabilityColor(selectedAppointment.available_slots)}`}>
                  {selectedAppointment.available_slots} slots remaining
                </p>
              </div>
            </div>
          </div>

          {/* Optional Notes */}
          <div className="space-y-2">
            <Label htmlFor="booking_notes">Special Requirements or Notes (Optional)</Label>
            <Textarea
              id="booking_notes"
              value={bookingNotes}
              onChange={(e) => setBookingNotes(e.target.value)}
              placeholder="Any special requirements, accessibility needs, or additional information..."
              rows={3}
            />
          </div>

          {/* Important Information */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Please arrive 15 minutes before your appointment time. Bring your POLMED card
              and a valid ID. You will receive a confirmation SMS and email with your booking reference.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleBookAppointment}
              disabled={bookingLoading === selectedAppointment.appointment_id}
              className="flex-1"
            >
              {bookingLoading === selectedAppointment.appointment_id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Booking
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowBookingForm(false)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Find Available Appointments
          </CardTitle>
          <CardDescription>Search for available appointments at mobile clinic locations near you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="province">Province</Label>
              <Select
                value={filters.province}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, province: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Any Province">Any Province</SelectItem>
                  <SelectItem value="Gauteng">Gauteng</SelectItem>
                  <SelectItem value="Western Cape">Western Cape</SelectItem>
                  <SelectItem value="KwaZulu-Natal">KwaZulu-Natal</SelectItem>
                  <SelectItem value="Eastern Cape">Eastern Cape</SelectItem>
                  <SelectItem value="Free State">Free State</SelectItem>
                  <SelectItem value="Limpopo">Limpopo</SelectItem>
                  <SelectItem value="Mpumalanga">Mpumalanga</SelectItem>
                  <SelectItem value="North West">North West</SelectItem>
                  <SelectItem value="Northern Cape">Northern Cape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={filters.city}
                onChange={(e) => setFilters((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Enter city name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_from">From Date</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_to">To Date</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                min={filters.date_from}
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="max_distance">Max Distance:</Label>
              <Select
                value={filters.max_distance_km.toString()}
                onValueChange={(value) => setFilters((prev) => ({ ...prev, max_distance_km: Number.parseInt(value) }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25km</SelectItem>
                  <SelectItem value="50">50km</SelectItem>
                  <SelectItem value="100">100km</SelectItem>
                  <SelectItem value="200">200km</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={searchAppointments} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search Appointments
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      <Card>
        <CardHeader>
          <CardTitle>Available Appointments</CardTitle>
          <CardDescription>
            {availableAppointments.length > 0
              ? `Found ${availableAppointments.length} available appointments`
              : "No appointments found matching your criteria"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Searching for appointments...</p>
            </div>
          ) : availableAppointments.length > 0 ? (
            <div className="space-y-4">
              {availableAppointments.map((appointment) => (
                <div
                  key={appointment.appointment_id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{appointment.location_name}</h3>
                          <p className="text-sm text-muted-foreground">{appointment.address}</p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.city}, {appointment.province}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{formatDate(appointment.appointment_date)}</p>
                          <p className="text-sm text-muted-foreground">{formatTime(appointment.appointment_time)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <span className={`flex items-center gap-1 ${getDistanceColor(appointment.distance_km)}`}>
                          <MapPin className="w-3 h-3" />
                          {appointment.distance_km === 0 ? "Your area" : `~${appointment.distance_km}km away`}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${getAvailabilityColor(appointment.available_slots)}`}
                        >
                          <Clock className="w-3 h-3" />
                          {appointment.available_slots} slots available
                        </span>
                      </div>
                    </div>

                    <div className="ml-4">
                      <Button
                        onClick={() => {
                          setSelectedAppointment(appointment)
                          setShowBookingForm(true)
                        }}
                        disabled={appointment.available_slots === 0}
                      >
                        {appointment.available_slots === 0 ? "Fully Booked" : "Book Appointment"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">No appointments found</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search criteria or check back later for new appointments
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
