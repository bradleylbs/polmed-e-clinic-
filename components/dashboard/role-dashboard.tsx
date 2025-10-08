"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Calendar,
  Package,
  Activity,
  TrendingUp,
  Clock,
  MapPin,
  Stethoscope,
  Heart,
  UserCheck,
  Shield,
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  ClipboardCheck,
  UserPlus,
  BookOpen,
  MessageCircle,
} from "lucide-react"
import { apiService } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface User {
  username: string
  role: UserRole
  mpNumber?: string
  assignedLocation?: string
  province?: string
}

interface DashboardStats {
  todayPatients: number
  weeklyPatients: number
  monthlyPatients: number
  pendingAppointments: number
  completedWorkflows: number
  activeRoutes: number
  lowStockAlerts: number
  maintenanceAlerts: number
  recentActivity: ActivityItem[]
  upcomingTasks: TaskItem[]
  roleSpecificMetrics: {
    metricType: string
    todayBookings?: number
    weekBookings?: number
    monthBookings?: number
    todayAssessments?: number
    weekAssessments?: number
    monthAssessments?: number
    todayDiagnoses?: number
    todayTreatments?: number
    todayReferrals?: number
    weekReferrals?: number
  }
}

interface ActivityItem {
  id: string
  type: "patient" | "appointment" | "inventory" | "route"
  description: string
  timestamp: string
  location?: string
  status: "completed" | "pending" | "alert"
}

interface TaskItem {
  id: string
  title: string
  description: string
  dueDate: Date
  priority: "high" | "medium" | "low"
  type: "maintenance" | "appointment" | "inventory" | "review"
}

interface RoleDashboardProps {
  user: User
}

const roleConfig = {
  administrator: {
    icon: Shield,
    label: "Administrator",
    color: "bg-primary text-primary-foreground",
    description: "Full system access and configuration",
  },
  doctor: {
    icon: Stethoscope,
    label: "Doctor",
    color: "bg-chart-1 text-white",
    description: "Patient diagnosis and treatment",
  },
  nurse: {
    icon: Heart,
    label: "Nurse",
    color: "bg-chart-2 text-white",
    description: "Vital signs and medical screening",
  },
  clerk: {
    icon: UserCheck,
    label: "Clerk",
    color: "bg-muted text-muted-foreground",
    description: "Patient registration and scheduling",
  },
  social_worker: {
    icon: Users,
    label: "Social Worker",
    color: "bg-accent text-accent-foreground",
    description: "Counseling and mental health support",
  },
}

const getRoleSpecificLabels = (role: UserRole, metricType: string) => {
  switch (role) {
    case "clerk":
      return {
        today: "Registrations Today",
        weekly: "Registrations This Week",
        monthly: "Registrations This Month",
        completed: "Bookings Made",
        todayIcon: UserPlus,
        weekIcon: TrendingUp,
        completedIcon: Calendar,
      }
    case "nurse":
      return {
        today: "Vitals Recorded Today",
        weekly: "Vitals This Week",
        monthly: "Vitals This Month",
        completed: "Assessments Done",
        todayIcon: Heart,
        weekIcon: Activity,
        completedIcon: ClipboardCheck,
      }
    case "doctor":
      return {
        today: "Patients Treated Today",
        weekly: "Patients This Week",
        monthly: "Patients This Month",
        completed: "Clinical Notes",
        todayIcon: Stethoscope,
        weekIcon: TrendingUp,
        completedIcon: FileText,
      }
    case "social_worker":
      return {
        today: "Counseling Sessions Today",
        weekly: "Sessions This Week",
        monthly: "Sessions This Month",
        completed: "Referrals Made",
        todayIcon: MessageCircle,
        weekIcon: Users,
        completedIcon: BookOpen,
      }
    default:
      return {
        today: "System Visits Today",
        weekly: "Visits This Week",
        monthly: "Visits This Month",
        completed: "Total Workflows",
        todayIcon: Users,
        weekIcon: TrendingUp,
        completedIcon: CheckCircle,
      }
  }
}

export function RoleDashboard({ user }: RoleDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const normalizedRole = String(user.role).toLowerCase().replace(/\s+/g, "_") as UserRole
  const roleInfo = roleConfig[normalizedRole] || roleConfig["clerk"]

  console.log("[v0] RoleDashboard user role:", user.role, "Normalized:", normalizedRole)
  console.log("[v0] Role info found:", roleInfo ? "Yes" : "No", roleInfo)

  const RoleIcon = roleInfo.icon

  const labels = getRoleSpecificLabels(normalizedRole, dashboardData?.roleSpecificMetrics?.metricType || "")

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await apiService.getDashboardStats()
      if (response.success && response.data) {
        const raw: any = response.data
        const normalizedUpcoming: TaskItem[] = (raw.upcomingTasks ?? []).map((t: any) => ({
          id: String(t.id),
          title: String(t.title ?? ""),
          description: String(t.description ?? ""),
          // Convert string to Date for typing
          dueDate: t.dueDate ? new Date(t.dueDate) : new Date(),
          priority: (t.priority as TaskItem["priority"]) ?? "low",
          type: (t.type as TaskItem["type"]) ?? "review",
        }))

        const normalizedActivity: ActivityItem[] = (raw.recentActivity ?? []).map((a: any) => ({
          id: String(a.id),
          type: (a.type as ActivityItem["type"]) ?? "patient",
          description: String(a.description ?? ""),
          timestamp: String(a.timestamp ?? new Date().toISOString()),
          location: a.location ? String(a.location) : undefined,
          status: (a.status as ActivityItem["status"]) ?? "pending",
        }))

        setDashboardData({
          todayPatients: Number(raw.todayPatients ?? 0),
          weeklyPatients: Number(raw.weeklyPatients ?? 0),
          monthlyPatients: Number(raw.monthlyPatients ?? 0),
          pendingAppointments: Number(raw.pendingAppointments ?? 0),
          completedWorkflows: Number(raw.completedWorkflows ?? 0),
          activeRoutes: Number(raw.activeRoutes ?? 0),
          lowStockAlerts: Number(raw.lowStockAlerts ?? 0),
          maintenanceAlerts: Number(raw.maintenanceAlerts ?? 0),
          recentActivity: normalizedActivity,
          upcomingTasks: normalizedUpcoming,
          roleSpecificMetrics: raw.roleSpecificMetrics ?? { metricType: "" },
        })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to fetch dashboard data",
          variant: "destructive",
        })
      }
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

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "patient":
        return <Users className="w-4 h-4" />
      case "appointment":
        return <Calendar className="w-4 h-4" />
      case "inventory":
        return <Package className="w-4 h-4" />
      case "route":
        return <MapPin className="w-4 h-4" />
    }
  }

  const getActivityStatusColor = (status: ActivityItem["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600"
      case "pending":
        return "text-blue-600"
      case "alert":
        return "text-red-600"
    }
  }

  const getPriorityColor = (priority: TaskItem["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-green-100 text-green-800"
    }
  }

  const getTaskIcon = (type: TaskItem["type"]) => {
    switch (type) {
      case "maintenance":
        return <Activity className="w-4 h-4" />
      case "appointment":
        return <Calendar className="w-4 h-4" />
      case "inventory":
        return <Package className="w-4 h-4" />
      case "review":
        return <FileText className="w-4 h-4" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const formatDueDate = (date: Date) => {
    const now = new Date()
    const diffInHours = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return `Due in ${diffInHours}h`
    } else {
      return `Due in ${Math.floor(diffInHours / 24)}d`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load dashboard data</p>
        <Button onClick={fetchDashboardData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl border border-primary/20">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user.username}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${roleInfo.color} shadow-sm`}>
              <RoleIcon className="w-3 h-3 mr-1" />
              {roleInfo.label}
            </Badge>
            {user.assignedLocation && (
              <Badge variant="outline" className="shadow-sm">
                <MapPin className="w-3 h-3 mr-1" />
                {user.assignedLocation}
              </Badge>
            )}
            {user.mpNumber && (
              <Badge variant="outline" className="shadow-sm">
                MP: {user.mpNumber}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-2">{roleInfo.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-all duration-300 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{labels.today}</CardTitle>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {labels.todayIcon && <labels.todayIcon className="h-5 w-5 text-primary" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{dashboardData.todayPatients ?? 0}</div>
            {normalizedRole === "clerk" && dashboardData.roleSpecificMetrics.todayBookings !== undefined && (
              <p className="text-xs text-muted-foreground">
                +{dashboardData.roleSpecificMetrics.todayBookings} bookings
              </p>
            )}
            {normalizedRole === "doctor" && dashboardData.roleSpecificMetrics.todayDiagnoses !== undefined && (
              <p className="text-xs text-muted-foreground">
                {dashboardData.roleSpecificMetrics.todayDiagnoses} diagnoses,{" "}
                {dashboardData.roleSpecificMetrics.todayTreatments || 0} treatments
              </p>
            )}
            {normalizedRole === "nurse" && dashboardData.roleSpecificMetrics.todayAssessments !== undefined && (
              <p className="text-xs text-muted-foreground">
                {dashboardData.roleSpecificMetrics.todayAssessments} assessments
              </p>
            )}
            {normalizedRole === "social_worker" && dashboardData.roleSpecificMetrics.todayReferrals !== undefined && (
              <p className="text-xs text-muted-foreground">
                {dashboardData.roleSpecificMetrics.todayReferrals} referrals made
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-secondary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{labels.weekly}</CardTitle>
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              {labels.weekIcon && <labels.weekIcon className="h-5 w-5 text-secondary" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">{dashboardData.weeklyPatients ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{dashboardData.pendingAppointments ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{dashboardData.upcomingTasks?.length ?? 0} due today</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{labels.completed}</CardTitle>
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              {labels.completedIcon && <labels.completedIcon className="h-5 w-5 text-green-600" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{dashboardData.completedWorkflows ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific Alerts */}
      {(normalizedRole === "administrator" || normalizedRole === "doctor" || normalizedRole === "nurse") &&
        (dashboardData.lowStockAlerts > 0 || dashboardData.maintenanceAlerts > 0) && (
          <Card className="border-orange-500/30 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                System Alerts
              </CardTitle>
              <CardDescription>Items requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.lowStockAlerts > 0 && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-600" />
                      </div>
                      <span className="text-sm font-medium">Low Stock Items</span>
                    </div>
                    <Badge className="bg-orange-500 text-white shadow-sm">{dashboardData.lowStockAlerts} items</Badge>
                  </div>
                )}

                {dashboardData.maintenanceAlerts > 0 && (
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-yellow-100/50 border border-yellow-200 rounded-xl hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-yellow-600" />
                      </div>
                      <span className="text-sm font-medium">Maintenance Due</span>
                    </div>
                    <Badge className="bg-yellow-500 text-white shadow-sm">
                      {dashboardData.maintenanceAlerts} items
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest actions and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.recentActivity.length > 0 ? (
                dashboardData.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-4 border rounded-xl hover:shadow-md hover:border-primary/30 transition-all"
                  >
                    <div className={`p-2 rounded-full bg-muted ${getActivityStatusColor(activity.status)}`}>
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeAgo(activity.timestamp)}</span>
                        {activity.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3 h-3" />
                            <span>{activity.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity to display</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Upcoming Tasks</CardTitle>
            <CardDescription>Tasks and deadlines requiring your attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.upcomingTasks && dashboardData.upcomingTasks.length > 0 ? (
                dashboardData.upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 border rounded-xl hover:shadow-md hover:border-primary/30 transition-all"
                  >
                    <div className="p-2 rounded-full bg-muted">{getTaskIcon(task.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium">{task.title}</h4>
                        <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDueDate(task.dueDate)}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming tasks</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-specific Performance Metrics */}
      {normalizedRole === "doctor" && (
        <Card>
          <CardHeader>
            <CardTitle>Clinical Performance</CardTitle>
            <CardDescription>Your clinical workflow metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Patients Treated Today</span>
                <span>{dashboardData.todayPatients ?? 0}/15</span>
              </div>
              <Progress value={Math.min(((dashboardData.todayPatients ?? 0) / 15) * 100, 100)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Target Progress</span>
                <span>{dashboardData.weeklyPatients ?? 0}/75</span>
              </div>
              <Progress value={Math.min(((dashboardData.weeklyPatients ?? 0) / 75) * 100, 100)} />
            </div>

            {dashboardData.roleSpecificMetrics.todayDiagnoses !== undefined && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData.roleSpecificMetrics.todayDiagnoses}
                  </div>
                  <p className="text-sm text-muted-foreground">Diagnoses Today</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData.roleSpecificMetrics.todayTreatments || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Treatments Today</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {normalizedRole === "nurse" && (
        <Card>
          <CardHeader>
            <CardTitle>Nursing Metrics</CardTitle>
            <CardDescription>Your patient care statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vital Signs Recorded Today</span>
                <span>{dashboardData.todayPatients ?? 0}/25</span>
              </div>
              <Progress value={Math.min(((dashboardData.todayPatients ?? 0) / 25) * 100, 100)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Target Progress</span>
                <span>{dashboardData.weeklyPatients ?? 0}/150</span>
              </div>
              <Progress value={Math.min(((dashboardData.weeklyPatients ?? 0) / 150) * 100, 100)} />
            </div>

            {dashboardData.roleSpecificMetrics.todayAssessments !== undefined && (
              <div className="text-center pt-2">
                <div className="text-2xl font-bold text-blue-600">
                  {dashboardData.roleSpecificMetrics.todayAssessments}
                </div>
                <p className="text-sm text-muted-foreground">Patient Assessments Today</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {normalizedRole === "clerk" && (
        <Card>
          <CardHeader>
            <CardTitle>Registration Metrics</CardTitle>
            <CardDescription>Your patient registration statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Patients Registered Today</span>
                <span>{dashboardData.todayPatients ?? 0}/30</span>
              </div>
              <Progress value={Math.min(((dashboardData.todayPatients ?? 0) / 30) * 100, 100)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Target Progress</span>
                <span>{dashboardData.weeklyPatients ?? 0}/200</span>
              </div>
              <Progress value={Math.min(((dashboardData.weeklyPatients ?? 0) / 200) * 100, 100)} />
            </div>

            {dashboardData.roleSpecificMetrics.todayBookings !== undefined && (
              <div className="text-center pt-2">
                <div className="text-2xl font-bold text-green-600">
                  {dashboardData.roleSpecificMetrics.todayBookings}
                </div>
                <p className="text-sm text-muted-foreground">Appointments Booked Today</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {normalizedRole === "social_worker" && (
        <Card>
          <CardHeader>
            <CardTitle>Counseling Metrics</CardTitle>
            <CardDescription>Your counseling and support statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Counseling Sessions Today</span>
                <span>{dashboardData.todayPatients ?? 0}/12</span>
              </div>
              <Progress value={Math.min(((dashboardData.todayPatients ?? 0) / 12) * 100, 100)} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Target Progress</span>
                <span>{dashboardData.weeklyPatients ?? 0}/60</span>
              </div>
              <Progress value={Math.min(((dashboardData.weeklyPatients ?? 0) / 60) * 100, 100)} />
            </div>

            {dashboardData.roleSpecificMetrics.todayReferrals !== undefined && (
              <div className="text-center pt-2">
                <div className="text-2xl font-bold text-purple-600">
                  {dashboardData.roleSpecificMetrics.todayReferrals}
                </div>
                <p className="text-sm text-muted-foreground">Referrals Made Today</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
