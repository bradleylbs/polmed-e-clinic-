"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MapPin, CalendarIcon, Users, Plus, Route, Shield, School, Building } from "lucide-react"
import { format } from "date-fns"
import { apiService, type Route as ApiRoute } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/hooks/use-toast"

interface RouteLocation {
  id: string
  name: string
  type: "police_station" | "school" | "community_center"
  address: string
  province: string
  coordinates?: { lat: number; lng: number }
  capacity: number
  contactPerson?: string
  contactPhone?: string
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

interface TimeSlot {
  id: string
  startTime: string
  endTime: string
  maxAppointments: number
  bookedAppointments: number
  locationId: string
}

interface RoutePlannerProps {
  userRole: string
  onRouteCreated: (route: RouteSchedule) => void
  routeToEdit?: {
    id?: number
    name: string
    description?: string
    province: string
    scheduled_date: string
    start_time?: string
    end_time?: string
    route_type?: string
    max_appointments?: number
  } | null
  onRouteUpdated?: (route: { id: string; routeName: string; description?: string; startDate: Date; endDate: Date }) => void
}

const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
]

const locationTypes = [
  { value: "police_station", label: "Police Station", icon: Shield, color: "bg-blue-100 text-blue-800" },
  { value: "school", label: "School", icon: School, color: "bg-green-100 text-green-800" },
  { value: "community_center", label: "Community Center", icon: Building, color: "bg-purple-100 text-purple-800" },
]

export function RoutePlanner({ userRole, onRouteCreated, routeToEdit, onRouteUpdated }: RoutePlannerProps) {
  const [routeName, setRouteName] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState<Date>()
  const [endDate, setEndDate] = useState<Date>()
  const [selectedProvince, setSelectedProvince] = useState("")
  const [locations, setLocations] = useState<RouteLocation[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const [currentLocation, setCurrentLocation] = useState<Partial<RouteLocation>>({
    name: "",
    type: "police_station",
    address: "",
    province: "",
    capacity: 50,
    contactPerson: "",
    contactPhone: "",
  })
  const [timeSlots, setTimeSlots] = useState<Omit<TimeSlot, "id" | "locationId">[]>([
    { startTime: "08:00", endTime: "08:30", maxAppointments: 10, bookedAppointments: 0 },
    { startTime: "08:30", endTime: "09:00", maxAppointments: 10, bookedAppointments: 0 },
    { startTime: "09:00", endTime: "09:30", maxAppointments: 10, bookedAppointments: 0 },
    { startTime: "09:30", endTime: "10:00", maxAppointments: 10, bookedAppointments: 0 },
  ])

  // Prefill when editing
  useEffect(() => {
    if (routeToEdit) {
      setRouteName(routeToEdit.name || "")
      setDescription(routeToEdit.description || "")
      try {
        const d = new Date(routeToEdit.scheduled_date)
        setStartDate(d)
        setEndDate(d)
      } catch {}
      setSelectedProvince(routeToEdit.province || "")
    }
  }, [routeToEdit])

  const addLocation = () => {
    if (currentLocation.name && currentLocation.address && currentLocation.province) {
      const newLocation: RouteLocation = {
        id: `loc-${Date.now()}`,
        name: currentLocation.name,
        type: currentLocation.type as RouteLocation["type"],
        address: currentLocation.address,
        province: currentLocation.province,
        capacity: currentLocation.capacity || 50,
        contactPerson: currentLocation.contactPerson,
        contactPhone: currentLocation.contactPhone,
      }

      setLocations([...locations, newLocation])
      setCurrentLocation({
        name: "",
        type: "police_station",
        address: "",
        province: selectedProvince,
        capacity: 50,
        contactPerson: "",
        contactPhone: "",
      })
    }
  }

  const removeLocation = (locationId: string) => {
    setLocations(locations.filter((loc) => loc.id !== locationId))
  }

  const addTimeSlot = () => {
    setTimeSlots([...timeSlots, { startTime: "10:00", endTime: "10:30", maxAppointments: 10, bookedAppointments: 0 }])
  }

  const updateTimeSlot = (index: number, field: keyof Omit<TimeSlot, "id" | "locationId">, value: string | number) => {
    const updatedSlots = [...timeSlots]
    updatedSlots[index] = { ...updatedSlots[index], [field]: value }
    setTimeSlots(updatedSlots)
  }

  const removeTimeSlot = (index: number) => {
    setTimeSlots(timeSlots.filter((_, i) => i !== index))
  }

 const createRoute = async () => {
  const isEditing = !!routeToEdit?.id
  const missingLocations = locations.length === 0
  if (!routeName || !startDate || !endDate || (!isEditing && missingLocations) || !selectedProvince) {
    toast({
      title: "Missing information",
      description: isEditing
        ? "Please fill in route name, dates, and province."
        : "Please fill in route name, dates, province, and at least one location.",
      variant: "destructive",
    })
    return
  }

  try {
    setSubmitting(true)

    // Determine route type based on locations selected
    const typeSet = new Set(locations.map((l) => l.type))
    const singleType = typeSet.size === 1 ? Array.from(typeSet)[0] : undefined
    const routeType: 'Police Stations' | 'Schools' | 'Community Centers' | 'Mixed' =
      singleType === 'police_station'
        ? 'Police Stations'
        : singleType === 'school'
          ? 'Schools'
          : singleType === 'community_center'
            ? 'Community Centers'
            : 'Mixed'

    // Estimate capacity per day: sum of slot capacities times number of locations
    const perLocationCapacity = timeSlots.reduce((sum, s) => sum + Number(s.maxAppointments || 0), 0)
    const maxPerDay = Math.max(1, perLocationCapacity * locations.length)

    const payload = {
      route_name: routeName,
      description: description || undefined,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      province: selectedProvince,
      route_type: routeType,
      max_appointments_per_day: maxPerDay,
    }

    if (!offlineManager.getConnectionStatus()) {
      // Offline: save route to IndexedDB and queue for sync
      const mapped: RouteSchedule = {
        id: `route-${Date.now()}`,
        routeName,
        description: description || `${selectedProvince} route`,
        locations,
        startDate,
        endDate,
        timeSlots: timeSlots.flatMap((slot) =>
          locations.map((location) => ({
            ...slot,
            id: `slot-${Date.now()}-${location.id}`,
            locationId: location.id,
          }))
        ),
        status: "draft",
        createdBy: 'system',
        createdAt: new Date(),
      }
      await offlineManager.saveData("routes", { ...mapped, timestamp: Date.now() })
      toast({ title: 'Route saved offline', description: `${routeName} will sync when online` })
      onRouteCreated(mapped)
      // Reset form AFTER success
      setRouteName("")
      setDescription("")
      setStartDate(undefined)
      setEndDate(undefined)
      setSelectedProvince("")
      setLocations([])
      setTimeSlots([
        { startTime: "08:00", endTime: "08:30", maxAppointments: 10, bookedAppointments: 0 },
        { startTime: "08:30", endTime: "09:00", maxAppointments: 10, bookedAppointments: 0 },
        { startTime: "09:00", endTime: "09:30", maxAppointments: 10, bookedAppointments: 0 },
        { startTime: "09:30", endTime: "10:00", maxAppointments: 10, bookedAppointments: 0 },
      ])
      setSubmitting(false)
      return
    }

    // If editing, call update and return
    if (isEditing) {
      const updateResp = await apiService.updateRoute(Number(routeToEdit.id), {
        name: routeName,
        description: description || undefined,
        province: selectedProvince,
        scheduled_date: format(startDate, 'yyyy-MM-dd'),
        max_appointments: Math.max(1, timeSlots.reduce((sum, s) => sum + Number(s.maxAppointments || 0), 0) * Math.max(1, locations.length)),
      } as any)
      if (!updateResp.success || !updateResp.data) {
        throw new Error(updateResp.error || 'Failed to update route')
      }
      onRouteUpdated?.({ id: String(routeToEdit.id), routeName, description, startDate, endDate })
      toast({ title: 'Route updated', description: `${routeName} updated successfully` })
      setSubmitting(false)
      return
    }

    // Create new route
    const resp = await apiService.createRoute(payload)
    if (!resp.success || !resp.data) {
      throw new Error(resp.error || 'Failed to create route')
    }

    const apiRoute: ApiRoute = resp.data

    // Convert API response to frontend RouteSchedule format
    const mapped: RouteSchedule = {
      id: String(apiRoute.id ?? `route-${Date.now()}`),
      routeName: apiRoute.name || apiRoute.route_name || routeName,
      description: apiRoute.description || `${selectedProvince} route`,
      locations: (apiRoute.locations || []).map((loc: any) => ({
        id: String(loc.id || `loc-${Date.now()}`),
        name: loc.name || loc.location_name || 'Unknown Location',
        type: (loc.type || loc.location_type || 'community_center') as RouteLocation["type"],
        address: loc.address || loc.city || selectedProvince,
        province: loc.province || selectedProvince,
        capacity: loc.capacity || 50,
        contactPerson: loc.contact_person,
        contactPhone: loc.contact_phone,
      })),
      startDate: new Date(apiRoute.scheduled_date || apiRoute.start_date || startDate),
      endDate: new Date(apiRoute.end_date || apiRoute.scheduled_date || endDate),
      timeSlots: timeSlots.flatMap((slot) =>
        locations.map((location) => ({
          ...slot,
          id: `slot-${Date.now()}-${location.id}`,
          locationId: location.id,
        })),
      ),
      status: (['draft','published','active','completed'] as const).includes(apiRoute.status as any) 
        ? (apiRoute.status as any) 
        : 'draft',
      createdBy: 'system',
      createdAt: new Date(),
    }

    toast({ 
      title: 'Route created', 
      description: `${apiRoute.name || routeName} created successfully` 
    })
    onRouteCreated(mapped)

    // Reset form AFTER success
    setRouteName("")
    setDescription("")
    setStartDate(undefined)
    setEndDate(undefined)
    setSelectedProvince("")
    setLocations([])
    setTimeSlots([
      { startTime: "08:00", endTime: "08:30", maxAppointments: 10, bookedAppointments: 0 },
      { startTime: "08:30", endTime: "09:00", maxAppointments: 10, bookedAppointments: 0 },
      { startTime: "09:00", endTime: "09:30", maxAppointments: 10, bookedAppointments: 0 },
      { startTime: "09:30", endTime: "10:00", maxAppointments: 10, bookedAppointments: 0 },
    ])
  } catch (err: any) {
    toast({
      title: 'Failed to create route',
      description: err?.message || 'Please try again',
      variant: 'destructive',
    })
  } finally {
    setSubmitting(false)
  }
}

  const getLocationTypeConfig = (type: RouteLocation["type"]) => {
    return locationTypes.find((lt) => lt.value === type) || locationTypes[0]
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            {routeToEdit ? 'Edit Mobile Clinic Route' : 'Create Mobile Clinic Route'}
          </CardTitle>
          <CardDescription>
            Plan mobile clinic deployment routes and automatically generate appointment slots
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Route Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">Route Name</Label>
              <Input
                id="routeName"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g., Durban Police Parade & Roadshow"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">Primary Province</Label>
              <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {southAfricanProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Route Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose and objectives of this mobile clinic route..."
              rows={3}
            />
          </div>

          <Separator />

          {/* Add Locations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Route Locations</h3>

            <Card className="bg-muted/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Add Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Location Type</Label>
                    <Select
                      value={currentLocation.type}
                      onValueChange={(value) =>
                        setCurrentLocation({ ...currentLocation, type: value as RouteLocation["type"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {locationTypes.map((type) => {
                          const Icon = type.icon
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Location Name</Label>
                    <Input
                      value={currentLocation.name}
                      onChange={(e) => setCurrentLocation({ ...currentLocation, name: e.target.value })}
                      placeholder="e.g., Durban Central Police Station"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Address</Label>
                    <Input
                      value={currentLocation.address}
                      onChange={(e) => setCurrentLocation({ ...currentLocation, address: e.target.value })}
                      placeholder="Complete physical address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Province</Label>
                    <Select
                      value={currentLocation.province}
                      onValueChange={(value) => setCurrentLocation({ ...currentLocation, province: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {southAfricanProvinces.map((province) => (
                          <SelectItem key={province} value={province}>
                            {province}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Daily Capacity</Label>
                    <Input
                      type="number"
                      value={currentLocation.capacity}
                      onChange={(e) =>
                        setCurrentLocation({ ...currentLocation, capacity: Number.parseInt(e.target.value) })
                      }
                      placeholder="50"
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Person (Optional)</Label>
                    <Input
                      value={currentLocation.contactPerson}
                      onChange={(e) => setCurrentLocation({ ...currentLocation, contactPerson: e.target.value })}
                      placeholder="Contact person name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Phone (Optional)</Label>
                    <Input
                      value={currentLocation.contactPhone}
                      onChange={(e) => setCurrentLocation({ ...currentLocation, contactPhone: e.target.value })}
                      placeholder="+27123456789"
                    />
                  </div>
                </div>

                <Button onClick={addLocation} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location to Route
                </Button>
              </CardContent>
            </Card>

            {/* Display Added Locations */}
            {locations.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Added Locations ({locations.length})</h4>
                {locations.map((location) => {
                  const typeConfig = getLocationTypeConfig(location.type)
                  const Icon = typeConfig.icon
                  return (
                    <Card key={location.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-medium">{location.name}</h5>
                                <Badge className={typeConfig.color}>{typeConfig.label}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {location.address}, {location.province}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  Capacity: {location.capacity} patients/day
                                </div>
                                {location.contactPerson && (
                                  <div>
                                    Contact: {location.contactPerson} {location.contactPhone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => removeLocation(location.id)}>
                            Remove
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Time Slots Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Appointment Time Slots</h3>
              <Button variant="outline" onClick={addTimeSlot}>
                <Plus className="w-4 h-4 mr-2" />
                Add Slot
              </Button>
            </div>

            <div className="space-y-3">
              {timeSlots.map((slot, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => updateTimeSlot(index, "startTime", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => updateTimeSlot(index, "endTime", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Max Appointments</Label>
                        <Input
                          type="number"
                          value={slot.maxAppointments}
                          onChange={(e) => updateTimeSlot(index, "maxAppointments", Number.parseInt(e.target.value))}
                          min="1"
                        />
                      </div>

                      <Button variant="outline" onClick={() => removeTimeSlot(index)}>
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <Button
            onClick={createRoute}
            className="w-full"
            disabled={submitting || !routeName || !startDate || !endDate || (!routeToEdit && locations.length === 0)}
          >
            <Route className="w-4 h-4 mr-2" />
            {routeToEdit ? (submitting ? 'Updating...' : 'Update Route') : (submitting ? 'Creating...' : 'Create Route & Generate Appointment Slots')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
