"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Eye, Edit, UserPlus, Calendar, Phone, Mail, Activity, Clock, CheckCircle, Loader2 } from "lucide-react"
import { apiService, type Patient } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/hooks/use-toast"

interface PatientListProps {
  userRole: string
  onPatientSelect: (patient: Patient) => void
  onNewPatient: () => void
}

export function PatientList({ userRole, onPatientSelect, onNewPatient }: PatientListProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [memberFilter, setMemberFilter] = useState<string>("all")
  const { toast } = useToast()

  useEffect(() => {
    fetchPatients()
  }, [])

  const fetchPatients = async () => {
    try {
      setLoading(true)
      let patientsData: any[] = []
      if (!offlineManager.getConnectionStatus()) {
        // Offline: get patients from IndexedDB
        const data = await offlineManager.getData("patients")
        // Ensure we always have an array
        patientsData = Array.isArray(data) ? data : data ? [data] : []
      } else {
        // Online: get patients from API
        const response = await apiService.getPatients()
        if (response.success && response.data) {
          patientsData = response.data as any[]
        } else {
          toast({
            title: "Error",
            description: response.error || "Failed to fetch patients",
            variant: "destructive",
          })
        }
      }
      // Normalize shape
      const normalized = patientsData.map((p) => ({
        id: p.id,
        full_name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "Unknown",
        medical_aid_number: p.medical_aid_number || "",
        physical_address: p.physical_address || "",
        telephone_number: p.phone_number || p.telephone_number || "",
        email: p.email || "",
        status: p.status || "registered",
        created_at: p.created_at,
      }))
      setPatients(normalized as Patient[])
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

  const filteredPatients = patients.filter((patient) => {
    const name = (patient.full_name || "").toLowerCase()
    const aid = (patient.medical_aid_number || "").toLowerCase()
    const phone = patient.telephone_number || ""

    const term = searchTerm.toLowerCase()
    const matchesSearch = name.includes(term) || aid.includes(term) || phone.includes(searchTerm)

    const matchesStatus = statusFilter === "all" || patient.status === statusFilter

    const startsWithPal = (patient.medical_aid_number || "").startsWith("PAL")
    const matchesMember =
      memberFilter === "all" ||
      (memberFilter === "member" && startsWithPal) ||
      (memberFilter === "non-member" && !startsWithPal)

    return matchesSearch && matchesStatus && matchesMember
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "registered":
        return (
          <Badge variant="outline">
            <Clock className="w-3 h-3 mr-1" />
            Registered
          </Badge>
        )
      case "in-progress":
        return (
          <Badge variant="secondary">
            <Activity className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getMembershipBadge = (medicalAidNumber: string) => {
    if ((medicalAidNumber || "").startsWith("PAL")) {
      return <Badge className="bg-green-100 text-green-800">PALMED Member</Badge>
    }
    return (
      <Badge variant="outline" className="bg-orange-100 text-orange-800">
        Non-member
      </Badge>
    )
  }

  const getInitials = (name: string) => {
    return (name || "Unknown")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Patient Management</h2>
          <p className="text-muted-foreground">Manage patient records and clinical workflows</p>
        </div>
        <Button onClick={onNewPatient} className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          New Patient
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name, medical aid number, or phone..."
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
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by membership" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patients</SelectItem>
                <SelectItem value="member">PALMED Members</SelectItem>
                <SelectItem value="non-member">Non-members</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Patient List */}
      <div className="grid gap-4">
        {loading ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Loading patients...</p>
            </CardContent>
          </Card>
        ) : filteredPatients.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No patients found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(patient.full_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground truncate">{patient.full_name}</h3>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-3">
                        {getMembershipBadge(patient.medical_aid_number)}
                        {getStatusBadge(patient.status)}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {patient.medical_aid_number}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          <span>{patient.telephone_number}</span>
                        </div>

                        {patient.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{patient.email}</span>
                          </div>
                        )}

                        {patient.created_at && (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            <span>Registered: {new Date(patient.created_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => onPatientSelect(patient)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {(userRole === "administrator" || userRole === "clerk") && (
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
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
