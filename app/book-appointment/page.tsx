"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { offlineManager } from "@/lib/offline-manager"
import { apiService } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CalendarIcon, Clock, MapPin, Users, CheckCircle, Shield, School, Building, Phone, User, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

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
  visitDate?: string // ISO date (YYYY-MM-DD) for filtering by selected day
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
  booking_reference?: string
}

interface AppointmentBookingProps {
  route: RouteSchedule
  onAppointmentBooked: (appointment: Appointment) => void
  onBack: () => void
  mode?: "internal" | "public"
}

export function AppointmentBooking({ route, onAppointmentBooked, onBack, mode = "internal" }: AppointmentBookingProps) {
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedLocation, setSelectedLocation] = useState<RouteLocation>()
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot>()
  const [patientName, setPatientName] = useState("")
  const [patientPhone, setPatientPhone] = useState("")
  const [patientEmail, setPatientEmail] = useState("")
  const [medicalAidNumber, setMedicalAidNumber] = useState("")
  const [specialRequirements, setSpecialRequirements] = useState("")
  const [isBooking, setIsBooking] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  
  const { toast } = useToast()

  // Validation functions
  const validatePhone = (phone: string): boolean => {
    // Basic South African phone validation
    const phoneRegex = /^(\+27|0)[0-9]{9}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  const validateEmail = (email: string): boolean => {
    if (!email) return true // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Generate available dates between start and end date
  const getAvailableDates = () => {
    const dates: Date[] = []
    const current = new Date(route.startDate)
    const end = new Date(route.endDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to start of day

    while (current <= end) {
      // Only include future dates
      if (current >= today) {
        dates.push(new Date(current))
      }
      current.setDate(current.getDate() + 1)
    }

    return dates
  }

  // Get time slots for selected location and date
  const getAvailableTimeSlots = () => {
    if (!selectedLocation) return []

    const slotsForLocation = route.timeSlots.filter((slot) => slot.locationId === selectedLocation.id)

    // If a date is selected, filter slots matching the selected date
    const slotsForDate = selectedDate
      ? slotsForLocation.filter((slot) => {
          if (!slot.visitDate) return true
          const sel = format(selectedDate, "yyyy-MM-dd")
          return slot.visitDate === sel
        })
      : slotsForLocation

    return slotsForDate
      .filter((slot) => slot.bookedAppointments < slot.maxAppointments)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  const getLocationTypeIcon = (type: RouteLocation["type"]) => {
    switch (type) {
      case "police_station":
        return <Shield className="w-4 h-4 text-blue-600" />
      case "school":
        return <School className="w-4 h-4 text-green-600" />
      case "community_center":
        return <Building className="w-4 h-4 text-purple-600" />
    }
  }

  const getLocationTypeLabel = (type: RouteLocation["type"]) => {
    switch (type) {
      case "police_station":
        return "Police Station"
      case "school":
        return "School"
      case "community_center":
        return "Community Center"
    }
  }

  const handleBookAppointment = async () => {
    // Clear previous errors
    setBookingError(null)

    // Validation
    if (!selectedDate || !selectedLocation || !selectedTimeSlot || !patientName.trim() || !patientPhone.trim()) {
      setBookingError("Please fill in all required fields")
      return
    }

    if (!validatePhone(patientPhone)) {
      setBookingError("Please enter a valid South African phone number")
      return
    }

    if (!validateEmail(patientEmail)) {
      setBookingError("Please enter a valid email address")
      return
    }

    setIsBooking(true)

    try {
      // If offline, save to IndexedDB and queue for sync
      if (!offlineManager.getConnectionStatus()) {
        const appointment: Appointment = {
          id: `apt-${Date.now()}`,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          medicalAidNumber: medicalAidNumber.trim(),
          routeId: route.id,
          locationId: selectedLocation.id,
          timeSlotId: selectedTimeSlot.id,
          appointmentDate: selectedDate,
          status: "pending_sync",
          createdAt: new Date(),
        }
        
        await offlineManager.saveData("appointments", appointment)
        onAppointmentBooked(appointment)
        resetForm()
        toast({
          title: "Appointment saved offline",
          description: "Your appointment will be synced when connection is restored",
        })
        return
      }

      // Online booking
      if (mode === "public") {
        console.log('🎯 Attempting to book appointment:', {
          appointmentId: selectedTimeSlot.id,
          payload: {
            booked_by_name: patientName.trim(),
            booked_by_phone: patientPhone.trim(),
            booked_by_email: patientEmail.trim() || undefined,
            special_requirements: [
              medicalAidNumber.trim() ? `Medical Aid: ${medicalAidNumber.trim()}` : '',
              specialRequirements.trim()
            ].filter(Boolean).join('; ') || undefined
          }
        })

        // Validate appointment ID is numeric for backend
        const appointmentIdNum = parseInt(selectedTimeSlot.id, 10)
        if (isNaN(appointmentIdNum)) {
          throw new Error(`Invalid appointment ID: ${selectedTimeSlot.id}`)
        }

        const response = await apiService.bookAppointmentPublic(appointmentIdNum, {
          booked_by_name: patientName.trim(),
          booked_by_phone: patientPhone.trim(),
          booked_by_email: patientEmail.trim() || undefined,
          special_requirements: [
            medicalAidNumber.trim() ? `Medical Aid: ${medicalAidNumber.trim()}` : '',
            specialRequirements.trim()
          ].filter(Boolean).join('; ') || undefined
        })

        console.log('📡 Booking API response:', response)

        if (!response.success) {
          throw new Error(response.error || "Failed to book appointment")
        }

        // Create appointment object with booking reference
        const confirmedAppointment: Appointment = {
          id: `apt-${Date.now()}`,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          medicalAidNumber: medicalAidNumber.trim(),
          routeId: route.id,
          locationId: selectedLocation.id,
          timeSlotId: selectedTimeSlot.id,
          appointmentDate: selectedDate,
          status: "confirmed",
          createdAt: new Date(),
          booking_reference: response.data?.booking_reference || `REF-${Date.now()}`
        }

        onAppointmentBooked(confirmedAppointment)
        
        toast({
          title: "Appointment booked successfully!",
          description: `Reference: ${confirmedAppointment.booking_reference}`,
        })

      } else {
        // Internal mode - simulate booking
        await new Promise((resolve) => setTimeout(resolve, 500))
        
        const appointment: Appointment = {
          id: `apt-${Date.now()}`,
          patientName: patientName.trim(),
          patientPhone: patientPhone.trim(),
          medicalAidNumber: medicalAidNumber.trim(),
          routeId: route.id,
          locationId: selectedLocation.id,
          timeSlotId: selectedTimeSlot.id,
          appointmentDate: selectedDate,
          status: "confirmed",
          createdAt: new Date(),
          booking_reference: `INT-${Date.now()}`
        }
        
        onAppointmentBooked(appointment)
        
        toast({
          title: "Appointment booked successfully!",
          description: "The appointment has been confirmed",
        })
      }

      resetForm()
      
    } catch (error: any) {
      console.error('❌ Booking error:', error)
      setBookingError(error.message || "Failed to book appointment. Please try again.")
      
      toast({
        title: "Booking failed",
        description: error.message || "Please try again or contact support",
        variant: "destructive",
      })
    } finally {
      setIsBooking(false)
    }
  }

  const resetForm = () => {
    setSelectedDate(undefined)
    setSelectedLocation(undefined)
    setSelectedTimeSlot(undefined)
    setPatientName("")
    setPatientPhone("")
    setPatientEmail("")
    setMedicalAidNumber("")
    setSpecialRequirements("")
    setBookingError(null)
  }

  const availableDates = getAvailableDates()
  const availableTimeSlots = getAvailableTimeSlots()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Book Appointment</h2>
          <p className="text-muted-foreground">{route.routeName}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to Routes
        </Button>
      </div>

      {/* Error Alert */}
      {bookingError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{bookingError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
            <CardDescription>Select your preferred date, location, and time slot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Select Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-start text-left font-normal bg-transparent ${
                      !selectedDate ? "text-muted-foreground" : ""
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Choose appointment date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date)
                      setSelectedTimeSlot(undefined) // Reset time slot when date changes
                    }}
                    disabled={(date) => !availableDates.some((d) => d.toDateString() === date.toDateString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label>Select Location *</Label>
              <Select
                value={selectedLocation?.id}
                onValueChange={(value) => {
                  const location = route.locations.find((loc) => loc.id === value)
                  setSelectedLocation(location)
                  setSelectedTimeSlot(undefined) // Reset time slot when location changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose location" />
                </SelectTrigger>
                <SelectContent>
                  {route.locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex items-center gap-2">
                        {getLocationTypeIcon(location.type)}
                        <div>
                          <div className="font-medium">{location.name}</div>
                          <div className="text-xs text-muted-foreground">{location.address}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Slot Selection */}
            {selectedLocation && selectedDate && (
              <div className="space-y-2">
                <Label>Select Time Slot *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTimeSlots.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-muted-foreground">
                      No available time slots for this date and location
                    </div>
                  ) : (
                    availableTimeSlots.map((slot) => (
                      <Button
                        key={slot.id}
                        variant={selectedTimeSlot?.id === slot.id ? "default" : "outline"}
                        onClick={() => setSelectedTimeSlot(slot)}
                        className="flex flex-col items-center p-3 h-auto"
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span className="text-sm font-medium">
                            {slot.startTime} - {slot.endTime}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {slot.maxAppointments - slot.bookedAppointments} slots left
                        </div>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Patient Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Patient Information</h3>

              <div className="space-y-2">
                <Label htmlFor="patientName">Full Name *</Label>
                <Input
                  id="patientName"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient full name"
                  required
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientPhone">Phone Number *</Label>
                <Input
                  id="patientPhone"
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+27123456789 or 0123456789"
                  required
                  maxLength={15}
                />
                <p className="text-xs text-muted-foreground">
                  Please include country code (+27) or use local format (0xx)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientEmail">Email Address</Label>
                <Input
                  id="patientEmail"
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="patient@example.com (optional)"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalAidNumber">Medical Aid Number</Label>
                <Input
                  id="medicalAidNumber"
                  value={medicalAidNumber}
                  onChange={(e) => setMedicalAidNumber(e.target.value)}
                  placeholder="Enter medical aid number (optional)"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialRequirements">Special Requirements</Label>
                <Input
                  id="specialRequirements"
                  value={specialRequirements}
                  onChange={(e) => setSpecialRequirements(e.target.value)}
                  placeholder="Any special needs or requirements (optional)"
                  maxLength={200}
                />
              </div>
            </div>

            <Button
              onClick={handleBookAppointment}
              className="w-full"
              disabled={
                !selectedDate || 
                !selectedLocation || 
                !selectedTimeSlot || 
                !patientName.trim() || 
                !patientPhone.trim() || 
                isBooking ||
                !validatePhone(patientPhone) ||
                !validateEmail(patientEmail)
              }
            >
              {isBooking ? "Booking Appointment..." : "Book Appointment"}
            </Button>

            <p className="text-xs text-muted-foreground">
              * Required fields. By booking, you agree to attend at the scheduled time.
            </p>
          </CardContent>
        </Card>

        {/* Route Information */}
        <div className="space-y-6">
          {/* Route Details */}
          <Card>
            <CardHeader>
              <CardTitle>Route Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">{route.routeName}</h4>
                <p className="text-sm text-muted-foreground">{route.description}</p>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(route.startDate, "MMM dd")} - {format(route.endDate, "MMM dd, yyyy")}
                </span>
              </div>

              <Badge variant="default" className="w-fit">
                {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
              </Badge>
            </CardContent>
          </Card>

          {/* Selected Location Details */}
          {selectedLocation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getLocationTypeIcon(selectedLocation.type)}
                  Location Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium">{selectedLocation.name}</h4>
                  <Badge variant="outline" className="mt-1">
                    {getLocationTypeLabel(selectedLocation.type)}
                  </Badge>
                </div>

                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <div>{selectedLocation.address}</div>
                    <div className="text-muted-foreground">{selectedLocation.province}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>Daily capacity: {selectedLocation.capacity} patients</span>
                </div>

                {selectedLocation.contactPerson && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>Contact: {selectedLocation.contactPerson}</span>
                    </div>
                    {selectedLocation.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedLocation.contactPhone}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Booking Summary */}
          {selectedDate && selectedLocation && selectedTimeSlot && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{format(selectedDate, "PPP")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium">
                      {selectedTimeSlot.startTime} - {selectedTimeSlot.endTime}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="font-medium">{selectedLocation.name}</span>
                  </div>
                  {patientName.trim() && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patient:</span>
                      <span className="font-medium">{patientName.trim()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Default page component: loads availability (based on URL params) and renders the booking UI
export default function Page() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [routeSchedule, setRouteSchedule] = useState<RouteSchedule | null>(null)

  useEffect(() => {
    const province = (searchParams.get("province") || "").trim()
    const locationType = (searchParams.get("type") || searchParams.get("location_type") || "").trim()
    const dateFrom = (searchParams.get("from") || searchParams.get("date_from") || "").trim()
    const dateTo = (searchParams.get("to") || searchParams.get("date_to") || "").trim()
    const city = (searchParams.get("city") || "").trim()
    const locationName = (searchParams.get("location") || searchParams.get("location_name") || "").trim()

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // Normalize location type to expected DB values when possible
        const normLocationType = (() => {
          const lt = (locationType || "").toLowerCase()
          if (lt.includes("police")) return "Police Stations"
          if (lt.includes("school")) return "Schools"
          if (lt.includes("community")) return "Community Centers"
          return locationType || undefined
        })()

        const resp = await apiService.getAvailableAppointments({
          province: province || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          location_type: normLocationType,
          city: city || undefined,
          location_name: locationName || undefined,
        })

        if (!resp.success) {
          throw new Error(resp.error || "Failed to load availability")
        }

  const rows = (resp.data as any[]) || []

        if (!rows.length) {
          // Build a helpful empty-state schedule using filters
          const mapLocType = (t?: string): RouteLocation["type"] => {
            const v = (t || "").toLowerCase()
            if (v.includes("police")) return "police_station"
            if (v.includes("school")) return "school"
            return "community_center"
          }

          const syntheticLocation: RouteLocation | null = (locationName || city || province)
            ? {
                id: "search-context",
                name: locationName || city || province,
                type: mapLocType(normLocationType),
                address: [locationName, city, province].filter(Boolean).join(", ") || "",
                province: province || "",
                capacity: 0,
              }
            : null

          const sd = dateFrom ? new Date(dateFrom) : new Date()
          const ed = dateTo ? new Date(dateTo) : sd

          const desc = [
            normLocationType && `Type: ${normLocationType}`,
            province && `Province: ${province}`,
            city && `City: ${city}`,
            locationName && `Location: ${locationName}`,
            "No available appointments in the selected window",
          ]
            .filter(Boolean)
            .join(" • ")

          setRouteSchedule({
            id: "public-route",
            routeName: locationName || city || province || "Public Appointments",
            description: desc,
            locations: syntheticLocation ? [syntheticLocation] : [],
            startDate: sd,
            endDate: ed,
            timeSlots: [],
            status: "published",
          })
          setLoading(false)
          return
        }

        // Helper to map location_type string to union type
        const mapLocType = (t?: string): RouteLocation["type"] => {
          const v = (t || "").toLowerCase()
          if (v.includes("police")) return "police_station"
          if (v.includes("school")) return "school"
          return "community_center"
        }

        // Helper to add minutes to HH:MM:SS
        const addMinutes = (time: string, minutesToAdd: number) => {
          const [h = "0", m = "0", s = "0"] = time.split(":")
          const d = new Date()
          d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, parseInt(s, 10) || 0, 0)
          d.setMinutes(d.getMinutes() + (Number.isFinite(minutesToAdd) ? minutesToAdd : 0))
          const hh = String(d.getHours()).padStart(2, "0")
          const mm = String(d.getMinutes()).padStart(2, "0")
          return `${hh}:${mm}`
        }

  // Unique locations keyed by a stable id derived from name+city+province
        const locMap = new Map<string, RouteLocation>()
        const timeSlots: TimeSlot[] = []

        let minDate: Date | null = null
        let maxDate: Date | null = null

  const routeNameSet = new Set<string>()
  const routeTypeSet = new Set<string>()

        rows.forEach((r: any) => {
          const visitDateStr: string = r.visit_date || r.rl_visit_date || ""
          const appointmentTime: string = r.appointment_time || "00:00:00"
          const duration: number = Number(r.duration_minutes || 30)
          const name: string = r.location_name || "Location"
          const prov: string = r.province || province || ""
          const cty: string = r.city || city || ""
          const locTypeStr: string = r.location_type || locationType || "Community Center"
          const routeName: string = r.route_name || ""
          const routeType: string = r.route_type || ""
          if (routeName) routeNameSet.add(routeName)
          if (routeType) routeTypeSet.add(routeType)

          const locId = `${name}|${cty}|${prov}`
          if (!locMap.has(locId)) {
            locMap.set(locId, {
              id: locId,
              name,
              type: mapLocType(locTypeStr),
              address: [name, cty, prov].filter(Boolean).join(", "),
              province: prov,
              capacity: 100,
            })
          }

          // Track date range
          if (visitDateStr) {
            const d = new Date(visitDateStr)
            if (!minDate || d < minDate) minDate = d
            if (!maxDate || d > maxDate) maxDate = d
          }

          // Build timeslot
          const startHHMM = (appointmentTime || "00:00:00").slice(0, 5)
          const endHHMM = addMinutes(appointmentTime || "00:00:00", duration)
          timeSlots.push({
            id: String(r.id),
            startTime: startHHMM,
            endTime: endHHMM,
            maxAppointments: 1,
            bookedAppointments: 0,
            locationId: locId,
            visitDate: visitDateStr ? String(visitDateStr) : undefined,
          })
        })

        const firstRouteName = rows[0]?.route_name || ""
        const resolvedRouteName = routeNameSet.size === 1
          ? Array.from(routeNameSet)[0]
          : (firstRouteName || (rows.length > 1 ? "Multiple Routes" : "Public Appointments"))
        const routeTypeDesc = routeTypeSet.size === 1 ? Array.from(routeTypeSet)[0] : undefined

        const routeSchedule: RouteSchedule = {
          id: "public-route",
          routeName: resolvedRouteName,
          description:
            [
              routeTypeDesc && `Type: ${routeTypeDesc}`,
              province && `Province: ${province}`,
              city && `City: ${city}`,
              locationName && `Location: ${locationName}`,
              `${locMap.size} location${locMap.size === 1 ? "" : "s"}`,
              `${timeSlots.length} slot${timeSlots.length === 1 ? "" : "s"}`,
            ]
              .filter(Boolean)
              .join(" • ") || "Available appointment slots",
          locations: Array.from(locMap.values()),
          startDate: minDate || new Date(),
          endDate: maxDate || minDate || new Date(),
          timeSlots,
          status: "published",
        }

        setRouteSchedule(routeSchedule)
      } catch (err: any) {
        setError(err?.message || "Failed to load availability")
      } finally {
        setLoading(false)
      }
    }

    load()
    // We intentionally depend on the search param string to reload when it changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams?.toString()])

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading availability…</CardTitle>
            <CardDescription>Please wait while we fetch available appointment slots.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!routeSchedule) {
    return (
      <div className="p-6">
        <Alert>
          <AlertDescription>No data available.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleBooked = () => {
    // After booking, navigate to a simple thank-you or back to home
    router.push("/")
  }

  return (
    <div className="p-6">
      <AppointmentBooking
        route={routeSchedule}
        onAppointmentBooked={handleBooked as any}
        onBack={() => router.push("/")}
        mode="public"
      />
    </div>
  )
}