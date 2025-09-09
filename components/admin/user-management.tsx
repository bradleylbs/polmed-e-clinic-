"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    color: "bg-primary text-primary-foreground",
    permissions: ["all"],
  },
  doctor: {
    icon: Stethoscope,
    label: "Doctor",
    color: "bg-chart-1 text-white",
    permissions: ["patient_full", "clinical_notes", "prescriptions", "referrals"],
  },
  nurse: {
    icon: Heart,
    label: "Nurse",
    color: "bg-chart-2 text-white",
    permissions: ["patient_vitals", "medical_history", "nursing_notes"],
  },
  clerk: {
    icon: UserCheck,
    label: "Clerk",
    color: "bg-muted text-muted-foreground",
    permissions: ["patient_registration", "appointments", "demographics"],
  },
  social_worker: {
    icon: Users,
    label: "Social Worker",
    color: "bg-accent text-accent-foreground",
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

// Mock user data
const mockUsers: SystemUser[] = [
  {
    id: "USR-001",
    username: "admin",
    email: "admin@palmed.co.za",
    fullName: "System Administrator",
    role: "administrator",
    status: "active",
    phoneNumber: "+27123456789",
    assignedLocation: "Head Office",
    province: "Gauteng",
    createdAt: new Date("2024-01-01"),
    lastLogin: new Date("2024-02-01T08:30:00"),
    permissions: ["all"],
    approvedBy: "System",
  },
  {
    id: "USR-002",
    username: "dr.smith",
    email: "dr.smith@palmed.co.za",
    fullName: "Dr. John Smith",
    role: "doctor",
    status: "active",
    mpNumber: "MP123456",
    phoneNumber: "+27987654321",
    assignedLocation: "KwaZulu-Natal Region",
    province: "KwaZulu-Natal",
    createdAt: new Date("2024-01-15"),
    lastLogin: new Date("2024-02-01T07:45:00"),
    permissions: ["patient_full", "clinical_notes", "prescriptions", "referrals"],
    approvedBy: "admin",
  },
  {
    id: "USR-003",
    username: "nurse.johnson",
    email: "nurse.johnson@palmed.co.za",
    fullName: "Sarah Johnson",
    role: "nurse",
    status: "active",
    phoneNumber: "+27555123456",
    assignedLocation: "Mobile Clinic Unit 1",
    province: "Western Cape",
    createdAt: new Date("2024-01-20"),
    lastLogin: new Date("2024-01-31T16:20:00"),
    permissions: ["patient_vitals", "medical_history", "nursing_notes"],
    approvedBy: "admin",
  },
  {
    id: "USR-004",
    username: "dr.pending",
    email: "dr.pending@example.com",
    fullName: "Dr. Jane Doe",
    role: "doctor",
    status: "pending",
    mpNumber: "MP789012",
    phoneNumber: "+27444555666",
    assignedLocation: "Gauteng Region",
    province: "Gauteng",
    createdAt: new Date("2024-01-30"),
    permissions: [],
    notes: "Self-registered doctor awaiting approval",
  },
]

export function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<SystemUser[]>(mockUsers)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null)
  const [showUserDetails, setShowUserDetails] = useState(false)
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
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending Approval
          </Badge>
        )
      case "suspended":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        )
      case "inactive":
        return (
          <Badge variant="outline">
            <XCircle className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        )
    }
  }

  const getRoleConfig = (role: UserRole) => {
    return roleConfig[role]
  }

  const addUser = () => {
    if (newUser.username && newUser.email && newUser.fullName && newUser.role) {
      const user: SystemUser = {
        id: `USR-${String(users.length + 1).padStart(3, "0")}`,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role as UserRole,
        status: newUser.role === "doctor" ? "pending" : "active", // Doctors need approval
        phoneNumber: newUser.phoneNumber || "",
        assignedLocation: newUser.assignedLocation || "",
        province: newUser.province || "",
        mpNumber: newUser.mpNumber || undefined,
        createdAt: new Date(),
        permissions: roleConfig[newUser.role as UserRole].permissions,
        approvedBy: newUser.role === "doctor" ? undefined : currentUser.username,
        notes: newUser.notes || undefined,
      }

      setUsers([...users, user])
      setNewUser({
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
      setShowAddForm(false)
    }
  }

  const approveUser = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              status: "active" as UserStatus,
              approvedBy: currentUser.username,
              permissions: roleConfig[user.role].permissions,
            }
          : user,
      ),
    )
  }

  const suspendUser = (userId: string) => {
    setUsers(
      users.map((user) =>
        user.id === userId
          ? {
              ...user,
              status: "suspended" as UserStatus,
            }
          : user,
      ),
    )
  }

  const formatLastLogin = (date?: Date) => {
    if (!date) return "Never"
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`
    }
  }

  const pendingApprovals = users.filter((user) => user.status === "pending").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">User Management</h2>
          <p className="text-muted-foreground">Manage system users, roles, and permissions</p>
          {pendingApprovals > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 mt-2">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {pendingApprovals} pending approval{pendingApprovals !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="pending">Pending Approvals ({pendingApprovals})</TabsTrigger>
          <TabsTrigger value="permissions">Role Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search by name, username, email, or MP number..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
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
              </div>
            </CardContent>
          </Card>

          {/* User List */}
          <div className="grid gap-4">
            {filteredUsers.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No users found matching your criteria.</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((user) => {
                const roleInfo = getRoleConfig(user.role)
                const RoleIcon = roleInfo.icon

                return (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                            <RoleIcon className="w-6 h-6 text-primary" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-foreground">{user.fullName}</h3>
                              <Badge className={roleInfo.color}>
                                <RoleIcon className="w-3 h-3 mr-1" />
                                {roleInfo.label}
                              </Badge>
                              {getStatusBadge(user.status)}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground mb-3">
                              <div>
                                <strong>Username:</strong> {user.username}
                              </div>
                              <div>
                                <strong>Email:</strong> {user.email}
                              </div>
                              <div>
                                <strong>Phone:</strong> {user.phoneNumber}
                              </div>
                              {user.mpNumber && (
                                <div>
                                  <strong>MP Number:</strong> {user.mpNumber}
                                </div>
                              )}
                              {user.assignedLocation && (
                                <div>
                                  <strong>Location:</strong> {user.assignedLocation}
                                </div>
                              )}
                              {user.province && (
                                <div>
                                  <strong>Province:</strong> {user.province}
                                </div>
                              )}
                              <div>
                                <strong>Last Login:</strong> {formatLastLogin(user.lastLogin)}
                              </div>
                              <div>
                                <strong>Created:</strong> {user.createdAt.toLocaleDateString()}
                              </div>
                              {user.approvedBy && (
                                <div>
                                  <strong>Approved by:</strong> {user.approvedBy}
                                </div>
                              )}
                            </div>

                            {user.notes && (
                              <div className="text-sm text-muted-foreground">
                                <strong>Notes:</strong> {user.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user)
                              setShowUserDetails(true)
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {user.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => approveUser(user.id)}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}

                          {user.status === "active" && user.id !== "USR-001" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => suspendUser(user.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}

                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
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

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending User Approvals</CardTitle>
              <CardDescription>Users awaiting administrative approval</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users
                  .filter((user) => user.status === "pending")
                  .map((user) => {
                    const roleInfo = getRoleConfig(user.role)
                    const RoleIcon = roleInfo.icon

                    return (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <RoleIcon className="w-5 h-5 text-primary" />
                          <div>
                            <h4 className="font-medium">{user.fullName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {user.email} • {roleInfo.label}
                              {user.mpNumber && ` • MP: ${user.mpNumber}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Applied: {user.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => approveUser(user.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 bg-transparent"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    )
                  })}

                {users.filter((user) => user.status === "pending").length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No pending approvals at this time.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions Matrix</CardTitle>
              <CardDescription>System permissions by user role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(roleConfig).map(([roleKey, roleInfo]) => {
                  const RoleIcon = roleInfo.icon
                  return (
                    <div key={roleKey} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <RoleIcon className="w-5 h-5" />
                        <h3 className="font-semibold">{roleInfo.label}</h3>
                        <Badge className={roleInfo.color}>
                          {users.filter((u) => u.role === roleKey && u.status === "active").length} active users
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roleInfo.permissions.map((permission) => (
                          <Badge key={permission} variant="outline">
                            {permission.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Form */}
      {showAddForm && (
        <Card className="fixed inset-0 z-50 m-4 overflow-auto">
          <CardHeader>
            <CardTitle>Add New User</CardTitle>
            <CardDescription>Create a new system user account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={newUser.phoneNumber}
                  onChange={(e) => setNewUser({ ...newUser, phoneNumber: e.target.value })}
                  placeholder="+27123456789"
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value) => setNewUser({ ...newUser, role: value as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={newUser.province} onValueChange={(value) => setNewUser({ ...newUser, province: value })}>
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
                <Label>Assigned Location</Label>
                <Input
                  value={newUser.assignedLocation}
                  onChange={(e) => setNewUser({ ...newUser, assignedLocation: e.target.value })}
                  placeholder="Enter assigned location"
                />
              </div>

              {newUser.role === "doctor" && (
                <div className="space-y-2">
                  <Label>MP Number</Label>
                  <Input
                    value={newUser.mpNumber}
                    onChange={(e) => setNewUser({ ...newUser, mpNumber: e.target.value })}
                    placeholder="Medical Practice number"
                  />
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={newUser.notes}
                  onChange={(e) => setNewUser({ ...newUser, notes: e.target.value })}
                  placeholder="Additional notes about this user"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={addUser}>Add User</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
