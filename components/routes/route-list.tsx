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
} from "lucide-react"
import { apiService, type Route as ApiRoute } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/hooks/use-toast"

interface RouteListProps {
  userRole: string
  onRouteSelect: (route: ApiRoute) => void
  onNewRoute: () => void
  onEditRoute?: (route: ApiRoute) => void
}

export function RouteList({ userRole, onRouteSelect, onNewRoute, onEditRoute }: RouteListProps) {
  const [routes, setRoutes] = useState<ApiRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [provinceFilter, setProvinceFilter] = useState<string>("all")
  const { toast } = useToast()

  useEffect(() => {
    fetchRoutes()
  }, [])

  const fetchRoutes = async () => {
    try {
      setLoading(true)
      let routesData: any[] = []
      if (!offlineManager.getConnectionStatus()) {
        // Offline: get routes from IndexedDB
  const offlineRoutes = await offlineManager.getData("routes")
  routesData = Array.isArray(offlineRoutes) ? offlineRoutes : []
      } else {
        // Online: get routes from API
        const response = await apiService.getRoutes()
        if (response.success && response.data) {
          routesData = response.data as any[]
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to fetch routes",
            variant: "destructive",
          })
        }
      }
      setRoutes(routesData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredRoutes = routes.filter((route) => {
    const matchesSearch =
      route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.location.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || route.status === statusFilter

    const matchesProvince = provinceFilter === "all" || route.province === provinceFilter

    return matchesSearch && matchesStatus && matchesProvince
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline">
            <FileText className="w-3 h-3 mr-1" />
            Draft
          </Badge>
        )
      case "published":
        return (
          <Badge variant="secondary">
            <Calendar className="w-3 h-3 mr-1" />
            Published
          </Badge>
        )
      case "active":
        return (
          <Badge variant="default">
            <Play className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getLocationTypeIcon = (type: string) => {
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

  const getUniqueProvinces = () => {
    const provinces = new Set<string>()
    routes.forEach((route) => provinces.add(route.province))
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
        {(userRole === "administrator" || userRole === "doctor") && (
          <Button onClick={onNewRoute} className="flex items-center gap-2">
            <Route className="w-4 h-4" />
            New Route
          </Button>
        )}
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
              <p className="text-muted-foreground">No routes found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          filteredRoutes.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground text-lg">{route.name}</h3>
                      {getStatusBadge(route.status)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{new Date(route.scheduled_date).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{route.location}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{route.max_appointments} capacity</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {route.start_time} - {route.end_time}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
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
                  <div className="flex items-center gap-2">
                    {getLocationTypeIcon(route.location_type)}
                    <Badge variant="outline" className="flex items-center gap-1">
                      <span>{route.province}</span>
                    </Badge>
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
