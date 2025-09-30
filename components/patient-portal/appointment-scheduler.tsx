"use client"

import { useState, useEffect } from "react"
import { Calendar, Clock, MapPin, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

interface TimeSlot {
  id: string
  time: string
  available: boolean
  doctor: string
  location: string
}

interface Appointment {
  id: string
  date: string
  time: string
  doctor: string
  service: string
  location: string
  status: "scheduled" | "completed" | "cancelled" | "rescheduled"
  notes?: string
}

export function AppointmentScheduler() {
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedService, setSelectedService] = useState("")
  const [selectedDoctor, setSelectedDoctor] = useState("")
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showNewAppointment, setShowNewAppointment] = useState(false)

  const services = [
    "General Consultation",
    "Preventive Care",
    "Chronic Disease Management",
    "Mental Health Counseling",
    "Vaccination",
    "Health Screening",
    "Follow-up Visit",
  ]

  const doctors = [
    { id: "dr1", name: "Dr. Sarah Johnson", specialty: "Family Medicine" },
    { id: "dr2", name: "Dr. Michael Chen", specialty: "Internal Medicine" },
    { id: "dr3", name: "Dr. Emily Rodriguez", specialty: "Pediatrics" },
    { id: "dr4", name: "Dr. James Wilson", specialty: "Mental Health" },
  ]

  useEffect(() => {
    // Load existing appointments
    const mockAppointments: Appointment[] = [
      {
        id: "1",
        date: "2024-01-15",
        time: "10:00 AM",
        doctor: "Dr. Sarah Johnson",
        service: "General Consultation",
        location: "Mobile Unit A",
        status: "scheduled",
      },
      {
        id: "2",
        date: "2024-01-08",
        time: "2:30 PM",
        doctor: "Dr. Michael Chen",
        service: "Follow-up Visit",
        location: "Mobile Unit B",
        status: "completed",
      },
    ]
    setAppointments(mockAppointments)
  }, [])

  const loadAvailableSlots = async (date: string, service: string, doctor: string) => {
    if (!date || !service || !doctor) return

    setIsLoading(true)
    // Simulate API call
    setTimeout(() => {
      const mockSlots: TimeSlot[] = [
        { id: "1", time: "9:00 AM", available: true, doctor: "Dr. Sarah Johnson", location: "Mobile Unit A" },
        { id: "2", time: "10:00 AM", available: false, doctor: "Dr. Sarah Johnson", location: "Mobile Unit A" },
        { id: "3", time: "11:00 AM", available: true, doctor: "Dr. Sarah Johnson", location: "Mobile Unit A" },
        { id: "4", time: "2:00 PM", available: true, doctor: "Dr. Sarah Johnson", location: "Mobile Unit A" },
        { id: "5", time: "3:00 PM", available: true, doctor: "Dr. Sarah Johnson", location: "Mobile Unit A" },
      ]
      setAvailableSlots(mockSlots)
      setIsLoading(false)
    }, 1000)
  }

  useEffect(() => {
    if (selectedDate && selectedService && selectedDoctor) {
      loadAvailableSlots(selectedDate, selectedService, selectedDoctor)
    }
  }, [selectedDate, selectedService, selectedDoctor])

  const handleBookAppointment = (slot: TimeSlot) => {
    const newAppointment: Appointment = {
      id: Date.now().toString(),
      date: selectedDate,
      time: slot.time,
      doctor: slot.doctor,
      service: selectedService,
      location: slot.location,
      status: "scheduled",
    }

    setAppointments((prev) => [...prev, newAppointment])
    setShowNewAppointment(false)
    setSelectedDate("")
    setSelectedService("")
    setSelectedDoctor("")
    setAvailableSlots([])
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

      {showNewAppointment && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule New Appointment</CardTitle>
            <CardDescription>Select your preferred date, service, and healthcare provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Preferred Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="service">Service Type</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service} value={service}>
                        {service}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="doctor">Healthcare Provider</Label>
                <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.name}>
                        <div>
                          <div className="font-medium">{doctor.name}</div>
                          <div className="text-sm text-gray-500">{doctor.specialty}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner text="Loading available time slots..." />
              </div>
            )}

            {availableSlots.length > 0 && !isLoading && (
              <div className="space-y-3">
                <Label>Available Time Slots</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.id}
                      variant={slot.available ? "outline" : "secondary"}
                      disabled={!slot.available}
                      onClick={() => slot.available && handleBookAppointment(slot)}
                      className="h-auto p-3 flex flex-col items-start"
                    >
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {slot.time}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{slot.location}</div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowNewAppointment(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Appointments</h3>
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No appointments scheduled</p>
              <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setShowNewAppointment(true)}>
                Schedule Your First Appointment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {appointments.map((appointment) => (
              <Card key={appointment.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(appointment.date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="w-4 h-4 mr-1" />
                          {appointment.time}
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          {appointment.location}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{appointment.doctor}</span>
                      </div>
                      <p className="text-sm text-gray-600">{appointment.service}</p>
                      {appointment.notes && <p className="text-sm text-gray-500 italic">{appointment.notes}</p>}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge className={getStatusColor(appointment.status)}>
                        {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                      </Badge>
                      {appointment.status === "scheduled" && (
                        <div className="flex space-x-1">
                          <Button size="sm" variant="outline">
                            Reschedule
                          </Button>
                          <Button size="sm" variant="outline">
                            Cancel
                          </Button>
                        </div>
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
