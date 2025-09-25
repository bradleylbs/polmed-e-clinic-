"use client"

import { useState } from "react"
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
import { CalendarIcon, Clock, MapPin, Users, CheckCircle, Shield, School, Building, Phone, User } from "lucide-react"
import { format } from "date-fns"

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
  const [medicalAidNumber, setMedicalAidNumber] = useState("")
  const [isBooking, setIsBooking] = useState(false)

  // Generate available dates between start and end date
  const getAvailableDates = () => {
    const dates: Date[] = []
    const current = new Date(route.startDate)
    const end = new Date(route.endDate)

    while (current <= end) {
      dates.push(new Date(current))
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
    if (!selectedDate || !selectedLocation || !selectedTimeSlot || !patientName || !patientPhone) {
      return
    }

    setIsBooking(true)

    // If offline, save to IndexedDB and queue for sync
    if (!offlineManager.getConnectionStatus()) {
      const appointment: Appointment = {
        id: `apt-${Date.now()}`,
        patientName,
        patientPhone,
        medicalAidNumber,
        routeId: route.id,
        locationId: selectedLocation.id,
        timeSlotId: selectedTimeSlot.id,
        appointmentDate: selectedDate,
        status: "pending_sync",
        createdAt: new Date(),
      }
      await offlineManager.saveData("appointments", appointment)
      onAppointmentBooked(appointment)
      setIsBooking(false)
      // Reset form
      setSelectedDate(undefined)
      setSelectedLocation(undefined)
      setSelectedTimeSlot(undefined)
      setPatientName("")
      setPatientPhone("")
      setMedicalAidNumber("")
      return
    }

    // Online
    if (mode === "public") {
      // Call public booking endpoint using selected slot id
      const resp = await apiService.bookAppointmentPublic(Number(selectedTimeSlot.id), {
        booked_by_name: patientName,
        booked_by_phone: patientPhone,
        booked_by_email: "",
        special_requirements: medicalAidNumber ? `MedicalAid:${medicalAidNumber}` : undefined,
      })
      const confirmed: Appointment = {
        id: `apt-${Date.now()}`,
        patientName,
        patientPhone,
        medicalAidNumber,
        routeId: route.id,
        locationId: selectedLocation.id,
        timeSlotId: selectedTimeSlot.id,
        appointmentDate: selectedDate,
        status: resp.success ? "confirmed" : "pending_sync",
        createdAt: new Date(),
      }
      // Attach booking reference if available
      if (resp.success && (resp as any).data && (resp as any).data.booking_reference) {
        (confirmed as any).booking_reference = (resp as any).data.booking_reference
      }
      onAppointmentBooked(confirmed)
    } else {
      // Internal (same behavior as previous simulated success)
      await new Promise((resolve) => setTimeout(resolve, 500))
      const appointment: Appointment = {
        id: `apt-${Date.now()}`,
        patientName,
        patientPhone,
        medicalAidNumber,
        routeId: route.id,
        locationId: selectedLocation.id,
        timeSlotId: selectedTimeSlot.id,
        appointmentDate: selectedDate,
        status: "confirmed",
        createdAt: new Date(),
      }
      onAppointmentBooked(appointment)
    }
    setIsBooking(false)
    // Reset form
    setSelectedDate(undefined)
    setSelectedLocation(undefined)
    setSelectedTimeSlot(undefined)
    setPatientName("")
    setPatientPhone("")
    setMedicalAidNumber("")
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
              <Label>Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Choose appointment date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => !availableDates.some((d) => d.toDateString() === date.toDateString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Location Selection */}
            <div className="space-y-2">
              <Label>Select Location</Label>
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
            {selectedLocation && (
              <div className="space-y-2">
                <Label>Select Time Slot</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTimeSlots.length === 0 ? (
                    <div className="col-span-2 text-center py-4 text-muted-foreground">
                      No available time slots for this location
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
                <Label htmlFor="patientName">Full Name</Label>
                <Input
                  id="patientName"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patientPhone">Phone Number</Label>
                <Input
                  id="patientPhone"
                  type="tel"
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+27123456789"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="medicalAidNumber">Medical Aid Number (Optional)</Label>
                <Input
                  id="medicalAidNumber"
                  value={medicalAidNumber}
                  onChange={(e) => setMedicalAidNumber(e.target.value)}
                  placeholder="Enter medical aid number"
                />
              </div>
            </div>

            <Button
              onClick={handleBookAppointment}
              className="w-full"
              disabled={
                !selectedDate || !selectedLocation || !selectedTimeSlot || !patientName || !patientPhone || isBooking
              }
            >
              {isBooking ? "Booking Appointment..." : "Book Appointment"}
            </Button>
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
                  {patientName && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patient:</span>
                      <span className="font-medium">{patientName}</span>
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
