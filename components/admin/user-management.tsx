"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { apiService } from "@/lib/api-service"
import {
  Search,
  Edit,
  Shield,
  Stethoscope,
  Heart,
  UserCheck,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  UserPlus,
  X,
  Sparkles,
  TrendingUp,
  Activity,
  Filter,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MoreVertical,
  ChevronRight,
} from "lucide-react"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"
type UserStatus = "active" | "pending" | "suspended" | "inactive"

interface SystemUser {
  id: string
  username: string
  email: string
  fullName: string
  role: UserRole
  status: UserStatus
  mpNumber?: string
  assignedLocation?: string
  province?: string
  phoneNumber: string
  createdAt: Date
  lastLogin?: Date
  permissions: string[]
  approvedBy?: string
  notes?: string
}

interface UserManagementProps {
  currentUser: {
    username: string
    role: UserRole
  }
}

const roleConfig = {
  administrator: {
    icon: Shield,
    label: "Administrator",
    color: "bg-gradient-to-br from-primary to-primary/70",
    textColor: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    permissions: ["all"],
  },
  doctor: {
    icon: Stethoscope,
    label: "Doctor",
    color: "bg-gradient-to-br from-blue-500 to-blue-600",
    textColor: "text-blue-600",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    permissions: ["patient_full", "clinical_notes", "prescriptions", "referrals"],
  },
  nurse: {
    icon: Heart,
    label: "Nurse",
    color: "bg-gradient-to-br from-pink-500 to-pink-600",
    textColor: "text-pink-600",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/20",
    permissions: ["patient_vitals", "medical_history", "nursing_notes"],
  },
  clerk: {
    icon: UserCheck,
    label: "Clerk",
    color: "bg-gradient-to-br from-slate-500 to-slate-600",
    textColor: "text-slate-600",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-500/20",
    permissions: ["patient_registration", "appointments", "demographics"],
  },
  social_worker: {
    icon: Users,
    label: "Social Worker",
    color: "bg-gradient-to-br from-purple-500 to-purple-600",
    textColor: "text-purple-600",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    permissions: ["counseling_records", "mental_health", "psychosocial"],
  },
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

export function UserManagement({ currentUser }: UserManagementProps) {
  const { toast } = useToast()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState<Partial<SystemUser>>({
    username: "",
    email: "",
    fullName: "",
    role: "clerk",
    phoneNumber: "",
    assignedLocation: "",
    province: "",
    mpNumber: "",
    notes: "",
  })

  const normalizeRole = (name: string | undefined): UserRole => {
    if (!name) return "clerk"
    const key = name.toLowerCase().replace(/\s+/g, "_") as UserRole
    return (Object.keys(roleConfig) as Array<UserRole>).includes(key) ? key : "clerk"
  }

  const loadUsers = async () => {
    setLoading(true)
    const res = await apiService.getUsers()
    if (res.success && Array.isArray(res.data)) {
      const mapped: SystemUser[] = res.data.map((u: any) => {
        const role = normalizeRole(u.role_name)
        const status: UserStatus = u.requires_approval && !u.approved_at ? "pending" : (u.is_active ? "active" : "suspended")
        let province: string | undefined
        try {
          if (u.geographic_restrictions) {
            const arr = typeof u.geographic_restrictions === "string" ? JSON.parse(u.geographic_restrictions) : u.geographic_restrictions
            province = Array.isArray(arr) && arr.length ? arr[0] : undefined
          }
        } catch {}
        return {
          id: String(u.id),
          username: u.username,
          email: u.email,
          fullName: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
          role,
          status,
          mpNumber: u.mp_number || undefined,
          assignedLocation: u.assigned_location || undefined,
          province,
          phoneNumber: u.phone_number || "",
          createdAt: u.created_at ? new Date(u.created_at) : new Date(),
          lastLogin: u.last_login ? new Date(u.last_login) : undefined,
          permissions: roleConfig[role].permissions,
          approvedBy: u.approved_by || undefined,
          notes: u.notes || undefined,
        }
      })
      setUsers(mapped)
    } else {
      toast({ title: "Failed to load users", description: res.error || "Unknown error", variant: "destructive" })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.mpNumber && user.mpNumber.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesRole = roleFilter === "all" || user.role === roleFilter
    const matchesStatus = statusFilter === "all" || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20 transition-colors">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case "suspended":
        return (
          <Badge className="bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20 transition-colors">
            <XCircle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="outline" className="hover:bg-muted transition-colors">
            <XCircle className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        )
    }
  }

  const getRoleConfig = (role: UserRole) => {
    return roleConfig[role]
  }

  const addUser = async () => {
    if (!(newUser.username && newUser.email && newUser.fullName && newUser.role)) return
    const [first_name, ...rest] = String(newUser.fullName).trim().split(/\s+/)
    const last_name = rest.join(" ") || "N/A"
    const payload: any = {
      username: newUser.username,
      email: newUser.email,
      first_name,
      last_name,
      role: newUser.role,
      phone_number: newUser.phoneNumber,
      mp_number: newUser.mpNumber,
      assigned_province: newUser.province,
    }
    const res = await apiService.createUser(payload)
    if (res.success) {
      toast({ 
        title: "User created successfully", 
        description: `Account for ${newUser.fullName} has been created`,
      })
      setShowAddForm(false)
      setNewUser({ username: "", email: "", fullName: "", role: "clerk", phoneNumber: "", assignedLocation: "", province: "", mpNumber: "", notes: "" })
      loadUsers()
    } else {
      toast({ title: "Failed to create user", description: res.error || "Unknown error", variant: "destructive" })
    }
  }

  const approveUser = async (userId: string) => {
    const res = await apiService.updateUser(Number(userId), { approve: true, status: "active" })
    if (res.success) {
      toast({ title: "User approved successfully" })
      loadUsers()
    } else {
      toast({ title: "Approval failed", description: res.error || "Unknown error", variant: "destructive" })
    }
  }

  const suspendUser = async (userId: string) => {
    const res = await apiService.updateUser(Number(userId), { status: "suspended" })
    if (res.success) {
      toast({ title: "User suspended successfully" })
      loadUsers()
    } else {
      toast({ title: "Suspend failed", description: res.error || "Unknown error", variant: "destructive" })
    }
  }

  const formatLastLogin = (date?: Date) => {
    if (!date) return "Never"
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Just now"
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }

  const pendingApprovals = users.filter((user) => user.status === "pending").length
  const activeUsers = users.filter((user) => user.status === "active").length
  const totalUsers = users.length

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Enhanced Header with Stats */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                  User Management
                </h2>
                <p className="text-muted-foreground">Manage system users, roles, and permissions</p>
              </div>
            </div>
            {pendingApprovals > 0 && (
              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20 transition-all hover:scale-105">
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5 animate-pulse" />
                {pendingApprovals} pending approval{pendingApprovals !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <Button 
            onClick={() => setShowAddForm(true)} 
            className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 group"
          >
            <UserPlus className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
            Add User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: totalUsers,
              icon: Users,
              color: "from-primary to-primary/70",
              bgColor: "bg-primary/10",
              change: "+12%",
            },
            {
              label: "Active Users",
              value: activeUsers,
              icon: CheckCircle,
              color: "from-emerald-500 to-emerald-600",
              bgColor: "bg-emerald-500/10",
              change: "+8%",
            },
            {
              label: "Pending Approval",
              value: pendingApprovals,
              icon: Clock,
              color: "from-amber-500 to-amber-600",
              bgColor: "bg-amber-500/10",
              change: pendingApprovals > 0 ? "Needs attention" : "All clear",
            },
            {
              label: "Roles Active",
              value: Object.keys(roleConfig).length,
              icon: Shield,
              color: "from-purple-500 to-purple-600",
              bgColor: "bg-purple-500/10",
              change: "5 roles",
            },
          ].map((stat, idx) => (
            <Card
              key={stat.label}
              className="relative overflow-hidden border-2 border-border/50 hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl group"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="w-3 h-3" />
                      <span>{stat.change}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-5 h-5 text-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-2" />
            All Users
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Pending ({pendingApprovals})
          </TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="w-4 h-4 mr-2" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6 mt-6">
          {/* Enhanced Filters */}
          <Card className="border-2 border-border/50 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-hover:text-primary transition-colors" />
                    <Input
                      placeholder="Search by name, username, email, or MP number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 lg:gap-3">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-48 h-11 border-2">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      {Object.entries(roleConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="w-4 h-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48 h-11 border-2">
                      <Activity className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" className="h-11 border-2 hover:bg-primary/5 hover:border-primary/50 transition-all">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced User List */}
          <div className="grid gap-4">
            {loading ? (
              <Card className="border-2 border-border/50">
                <CardContent className="pt-6 text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                    <p className="text-muted-foreground">Loading users...</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredUsers.length === 0 ? (
              <Card className="border-2 border-border/50 shadow-lg">
                <CardContent className="pt-6 text-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold mb-1">No users found</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((user, idx) => {
                const roleInfo = getRoleConfig(user.role)
                const RoleIcon = roleInfo.icon

                return (
                  <Card 
                    key={user.id} 
                    className="group border-2 border-border/50 hover:border-primary/30 hover:shadow-xl transition-all duration-500 hover:-translate-y-1"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <CardContent className="pt-6">
                      <div className="flex flex-col lg:flex-row items-start gap-6">
                        <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                          <div className={`w-14 h-14 rounded-2xl ${roleInfo.color} shadow-lg flex items-center justify-center text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 flex-shrink-0`}>
                            <RoleIcon className="w-7 h-7" />
                          </div>

                          <div className="flex-1 min-w-0 space-y-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">
                                  {user.fullName}
                                </h3>
                                <Badge className={`${roleInfo.bgColor} ${roleInfo.textColor} ${roleInfo.borderColor} border hover:scale-105 transition-transform`}>
                                  <RoleIcon className="w-3 h-3 mr-1" />
                                  {roleInfo.label}
                                </Badge>
                                {getStatusBadge(user.status)}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <UserCheck className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Username</p>
                                  <p className="font-medium truncate">{user.username}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Mail className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Email</p>
                                  <p className="font-medium truncate">{user.email}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Phone</p>
                                  <p className="font-medium truncate">{user.phoneNumber}</p>
                                </div>
                              </div>

                              {user.mpNumber && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                    <Stethoscope className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">MP Number</p>
                                    <p className="font-medium truncate">{user.mpNumber}</p>
                                  </div>
                                </div>
                              )}

                              {user.province && (
                                <div className="flex items-center gap-2 text-sm">
                                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Province</p>
                                    <p className="font-medium truncate">{user.province}</p>
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Clock className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Last Login</p>
                                  <p className="font-medium">{formatLastLogin(user.lastLogin)}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Created</p>
                                  <p className="font-medium">{user.createdAt.toLocaleDateString()}</p>
                                </div>
                              </div>
                            </div>

                            {user.notes && (
                              <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                                <p className="text-xs text-muted-foreground mb-1 font-medium">Notes</p>
                                <p className="text-sm">{user.notes}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex lg:flex-col gap-2 w-full lg:w-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowUserDetails(true)
                            }}
                            className="flex-1 lg:flex-none border-2 hover:bg-primary/5 hover:border-primary/50 transition-all group/btn"
                          >
                            <Eye className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            View
                          </Button>

                          {user.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveUser(user.id)}
                              className="flex-1 lg:flex-none border-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all group/btn"
                            >
                              <CheckCircle className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                              Approve
                            </Button>
                          )}

                          {user.status === "active" && user.id !== "USR-001" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => suspendUser(user.id)}
                              className="flex-1 lg:flex-none border-2 text-red-600 hover:text-red-700 hover:bg-red-500/10 hover:border-red-500/50 transition-all group/btn"
                            >
                              <XCircle className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                              Suspend
                            </Button>
                          )}

                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 lg:flex-none border-2 hover:bg-primary/5 hover:border-primary/50 transition-all group/btn"
                          >
                            <Edit className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            Edit
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-6 mt-6">
          <Card className="border-2 border-border/50 shadow-xl">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-amber-500/5 to-transparent">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Pending User Approvals</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Review and approve new user registration requests
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {users
                  .filter((user) => user.status === "pending")
                  .map((user, idx) => {
                    const roleInfo = getRoleConfig(user.role)
                    const RoleIcon = roleInfo.icon

                    return (
                      <div 
                        key={user.id} 
                        className="group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-2 border-border/50 rounded-xl hover:border-amber-500/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-gradient-to-r from-amber-500/5 to-transparent"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <div className={`w-12 h-12 rounded-xl ${roleInfo.color} shadow-md flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300`}>
                            <RoleIcon className="w-6 h-6" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-lg">{user.fullName}</h4>
                              <Badge className={`${roleInfo.bgColor} ${roleInfo.textColor} ${roleInfo.borderColor} border`}>
                                {roleInfo.label}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                {user.email}
                              </div>
                              <div className="flex items-center gap-1">
                                <Phone className="w-3.5 h-3.5" />
                                {user.phoneNumber}
                              </div>
                              {user.mpNumber && (
                                <div className="flex items-center gap-1">
                                  <Stethoscope className="w-3.5 h-3.5" />
                                  MP: {user.mpNumber}
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              Applied: {user.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => approveUser(user.id)}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/40 transition-all hover:scale-105 group/btn"
                          >
                            <CheckCircle className="w-4 h-4 mr-2 group-hover/btn:rotate-12 transition-transform" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none border-2 text-red-600 hover:text-red-700 hover:bg-red-500/10 hover:border-red-500/50 transition-all hover:scale-105"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )
                  })}

                {users.filter((user) => user.status === "pending").length === 0 && (
                  <div className="text-center py-16">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle className="w-10 h-10 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-lg mb-1">All caught up!</p>
                        <p className="text-sm text-muted-foreground">No pending approvals at this time</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6 mt-6">
          <Card className="border-2 border-border/50 shadow-xl">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Role Permissions Matrix</CardTitle>
                  <CardDescription className="text-base mt-1">
                    Overview of system permissions assigned to each user role
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {Object.entries(roleConfig).map(([roleKey, roleInfo], idx) => {
                  const RoleIcon = roleInfo.icon
                  const activeCount = users.filter((u) => u.role === roleKey && u.status === "active").length
                  
                  return (
                    <div 
                      key={roleKey} 
                      className="group border-2 border-border/50 rounded-xl p-6 hover:border-primary/30 hover:shadow-lg transition-all duration-500 hover:-translate-y-1 bg-gradient-to-br from-card to-muted/20"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-14 h-14 rounded-2xl ${roleInfo.color} shadow-lg flex items-center justify-center text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                            <RoleIcon className="w-7 h-7" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl group-hover:text-primary transition-colors">
                              {roleInfo.label}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Role-based access control
                            </p>
                          </div>
                        </div>
                        <Badge className={`${roleInfo.bgColor} ${roleInfo.textColor} ${roleInfo.borderColor} border-2 px-4 py-2 text-sm`}>
                          <Users className="w-4 h-4 mr-2" />
                          {activeCount} active user{activeCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          <CheckCircle className="w-4 h-4" />
                          Permissions ({roleInfo.permissions.length})
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {roleInfo.permissions.map((permission) => (
                            <Badge 
                              key={permission} 
                              variant="outline" 
                              className="px-3 py-1.5 border-2 hover:bg-primary/5 hover:border-primary/50 transition-all hover:scale-105 cursor-default"
                            >
                              <CheckCircle className="w-3 h-3 mr-1.5 text-emerald-600" />
                              {permission.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Enhanced Add User Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto border-2 border-border/50 shadow-2xl animate-in zoom-in duration-300">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent sticky top-0 bg-card z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                    <UserPlus className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Add New User</CardTitle>
                    <CardDescription className="text-base mt-1">
                      Create a new system user account with role and permissions
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    Full Name *
                  </Label>
                  <Input
                    value={newUser.fullName}
                    onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                    placeholder="Enter full name"
                    className="h-11 border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    Username *
                  </Label>
                  <Input
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Enter username"
                    className="h-11 border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary" />
                    Email Address *
                  </Label>
                  <Input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                    className="h-11 border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Phone Number *
                  </Label>
                  <Input
                    value={newUser.phoneNumber}
                    onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                    placeholder="+27123456789"
                    className="h-11 border-2 focus:border-primary transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    User Role *
                  </Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
                  >
                    <SelectTrigger className="h-11 border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <config.icon className="w-4 h-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Province
                  </Label>
                  <Select value={newUser.province} onValueChange={(value) => setNewUser({ ...newUser, province: value })}>
                    <SelectTrigger className="h-11 border-2">
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
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Assigned Location
                  </Label>
                  <Input
                    value={newUser.assignedLocation}
                    onChange={(e) => setNewUser({ ...newUser, assignedLocation: e.target.value })}
                    placeholder="Enter assigned location"
                    className="h-11 border-2 focus:border-primary transition-colors"
                  />
                </div>

                {newUser.role === "doctor" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-primary" />
                      MP Number
                    </Label>
                    <Input
                      value={newUser.mpNumber}
                      onChange={(e) => setNewUser({ ...newUser, mpNumber: e.target.value })}
                      placeholder="Medical Practice number"
                      className="h-11 border-2 focus:border-primary transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Edit className="w-4 h-4 text-primary" />
                    Notes (Optional)
                  </Label>
                  <Textarea
                    value={newUser.notes}
                    onChange={(e) => setNewUser({ ...newUser, notes: e.target.value })}
                    placeholder="Additional notes about this user..."
                    rows={3}
                    className="border-2 focus:border-primary transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                <Button 
                  onClick={addUser} 
                  className="flex-1 h-11 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-105 group"
                >
                  <UserPlus className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                  Create User
                  <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 h-11 border-2 hover:bg-muted transition-all"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
