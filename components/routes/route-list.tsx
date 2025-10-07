"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Eye,
  Edit,
  Calendar,
  MapPin,
  Users,
  Clock,
  Route,
  Shield,
  School,
  Building,
  Play,
  CheckCircle,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { apiService, type Route as ApiRoute } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/hooks/use-toast"

interface RouteListProps {
  userRole: string
  onRouteSelect: (route: ApiRoute) => void
  onNewRoute: () => void
  onEditRoute?: (route: ApiRoute) => void
  refreshTrigger?: number
}

export function RouteList({ userRole, onRouteSelect, onNewRoute, onEditRoute, refreshTrigger = 0 }: RouteListProps) {
  const [routes, setRoutes] = useState<ApiRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [provinceFilter, setProvinceFilter] = useState<string>("all")
  const { toast } = useToast()

  useEffect(() => {
    fetchRoutes()
  }, [refreshTrigger])

  const fetchRoutes = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      console.log("🔄 Fetching routes...")
      
      let routesData: any[] = []
      
      if (!offlineManager.getConnectionStatus()) {
        console.log("📴 Offline mode - getting from IndexedDB")
        const offlineRoutes = await offlineManager.getData("routes")
        routesData = Array.isArray(offlineRoutes) ? offlineRoutes : []
        console.log("📴 Offline routes found:", routesData.length)
      } else {
        console.log("📡 Online mode - fetching from API")
        const response = await apiService.getRoutes()
        console.log("📡 API Response:", response)
        
        if (response.success && response.data) {
          routesData = response.data as any[]
          console.log("📡 Raw API data:", routesData)
          
          // Robust mapping with proper fallbacks
          routesData = routesData.map(route => ({
            ...route,
            // Ensure all required fields exist with proper fallbacks
            id: route.id,
            name: route.name || route.route_name || "Unnamed Route",
            route_name: route.route_name || route.name || "Unnamed Route",
            description: route.description || "",
            province: route.province || "Unknown Province",
            location: route.location || route.province || "Unknown Location",
            scheduled_date: route.scheduled_date || route.start_date || route.end_date,
            start_date: route.start_date || route.scheduled_date || route.end_date,
            end_date: route.end_date || route.start_date || route.scheduled_date,
            max_appointments: route.max_appointments || route.max_appointments_per_day || 0,
            max_appointments_per_day: route.max_appointments_per_day || route.max_appointments || 0,
            status: route.status || "draft",
            location_type: route.location_type || "mixed",
            start_time: route.start_time || "08:00",
            end_time: route.end_time || "17:00",
            locations: route.locations || []
          }))
          
          console.log("📡 Mapped routes:", routesData)
        } else {
          console.error("❌ API Error:", response.error)
          toast({
            title: "Error",
            description: response.error || "Failed to fetch routes",
            variant: "destructive",
          })
          return
        }
      }
      
      console.log("✅ Final routes to set:", routesData)
      setRoutes(routesData)
      
    } catch (error) {
      console.error("💥 Fetch routes error:", error)
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchRoutes(true)
  }

  // Robust getter functions with proper fallbacks
  const getRouteName = (route: ApiRoute) => 
    route.name || route.route_name || "Unnamed Route"

  const getRouteProvince = (route: ApiRoute) => 
    route.province || route.locations?.[0]?.province || "Unknown Province"

  const getRouteLocation = (route: ApiRoute) => 
    route.location || route.locations?.[0]?.name || route.province || "Unknown Location"

  const getRouteStatus = (route: ApiRoute) => 
    route.status || "draft"

  const getRouteLocationType = (route: ApiRoute) => 
    route.location_type || route.locations?.[0]?.type || "mixed"

  const getRouteDate = (route: ApiRoute) => 
    route.scheduled_date || route.start_date || route.end_date || null

  const getRouteCapacity = (route: ApiRoute) => 
    route.max_appointments || route.max_appointments_per_day || 0

  const getRouteStartTime = (route: ApiRoute) => 
    route.start_time || "08:00"

  const getRouteEndTime = (route: ApiRoute) => 
    route.end_time || "17:00"

  const filteredRoutes = routes.filter((route) => {
    const name = getRouteName(route).toLowerCase()
    const location = getRouteLocation(route).toLowerCase()
    const description = (route.description || "").toLowerCase()
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                         location.includes(searchTerm.toLowerCase()) ||
                         description.includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || getRouteStatus(route) === statusFilter

    const matchesProvince = provinceFilter === "all" || getRouteProvince(route) === provinceFilter

    return matchesSearch && matchesStatus && matchesProvince
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            Draft
          </Badge>
        )
      case "published":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Published
          </Badge>
        )
      case "active":
        return (
          <Badge variant="default" className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            Active
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getLocationTypeIcon = (type?: string) => {
    switch (type) {
      case "police_station":
        return <Shield className="w-4 h-4 text-blue-600" />
      case "school":
        return <School className="w-4 h-4 text-green-600" />
      case "community_center":
        return <Building className="w-4 h-4 text-purple-600" />
      default:
        return <MapPin className="w-4 h-4 text-gray-600" />
    }
  }

  const getLocationTypeLabel = (type?: string) => {
    switch (type) {
      case "police_station":
        return "Police Station"
      case "school":
        return "School"
      case "community_center":
        return "Community Center"
      default:
        return "Mixed Locations"
    }
  }

  const getUniqueProvinces = () => {
    const provinces = new Set<string>()
    routes.forEach((route) => {
      const province = getRouteProvince(route)
      if (province && province !== "Unknown Province") {
        provinces.add(province)
      }
    })
    return Array.from(provinces).sort()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Route Planning & Scheduling</h2>
          <p className="text-muted-foreground">Manage mobile clinic routes and appointment scheduling</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            size="sm"
            disabled={refreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {(userRole === "administrator" || userRole === "doctor") && (
            <Button onClick={onNewRoute} className="flex items-center gap-2">
              <Route className="w-4 h-4" />
              New Route
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search routes, locations, or descriptions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={provinceFilter} onValueChange={setProvinceFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by province" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Provinces</SelectItem>
                {getUniqueProvinces().map((province) => (
                  <SelectItem key={province} value={province}>
                    {province}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Routes</p>
                <p className="text-2xl font-bold">{routes.length}</p>
              </div>
              <Route className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">
                  {routes.filter(r => getRouteStatus(r) === 'active').length}
                </p>
              </div>
              <Play className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Published</p>
                <p className="text-2xl font-bold">
                  {routes.filter(r => getRouteStatus(r) === 'published').length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold">
                  {routes.filter(r => getRouteStatus(r) === 'draft').length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading routes...</p>
            </CardContent>
          </Card>
        ) : filteredRoutes.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Route className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">No routes found</h3>
              <p className="text-muted-foreground mb-4">
                {routes.length === 0 
                  ? "No routes have been created yet." 
                  : "No routes match your search criteria."}
              </p>
              {(userRole === "administrator" || userRole === "doctor") && routes.length === 0 && (
                <Button onClick={onNewRoute} className="flex items-center gap-2 mx-auto">
                  <Route className="w-4 h-4" />
                  Create Your First Route
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredRoutes.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onRouteSelect(route)}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground text-lg">{getRouteName(route)}</h3>
                      {getStatusBadge(getRouteStatus(route))}
                    </div>

                    {route.description && (
                      <p className="text-muted-foreground mb-3">{route.description}</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {(() => {
                            const dateValue = getRouteDate(route)
                            return dateValue ? new Date(dateValue).toLocaleDateString() : "Date TBD"
                          })()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{getRouteLocation(route)}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{getRouteCapacity(route)} appointments</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {getRouteStartTime(route)} - {getRouteEndTime(route)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => onRouteSelect(route)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {(userRole === "administrator" || userRole === "doctor") && (
                      <Button
                        title="Edit route"
                        aria-label="Edit route"
                        variant="outline"
                        size="sm"
                        onClick={() => onEditRoute?.(route)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Location Details */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {getLocationTypeIcon(getRouteLocationType(route))}
                      <span className="text-sm text-muted-foreground">
                        {getLocationTypeLabel(getRouteLocationType(route))}
                      </span>
                    </div>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{getRouteProvince(route) || "Province TBD"}</span>
                    </Badge>
                    {route.locations && route.locations.length > 0 && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Building className="w-3 h-3" />
                        <span>{route.locations.length} location(s)</span>
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
