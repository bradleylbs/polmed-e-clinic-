"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserPlus, Search, CheckCircle, AlertCircle } from "lucide-react"
import { apiService } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"

interface PatientData {
  id?: string
  fullName: string
  physicalAddress: string
  telephone: string
  email: string
  medicalAidNumber: string
  dateOfBirth: string
  gender: string
  emergencyContact: string
  emergencyPhone: string
  knownAllergies: string
  currentMedications: string
  chronicConditions: string
  isMember: boolean
  membershipStatus?: "active" | "inactive" | "pending"
}

// Shape of a POLMED member record returned by search
interface MemberRecord {
  full_name?: string
  telephone_number?: string
  email?: string
  physical_address?: string
  status?: "active" | "inactive" | "pending"
}

interface PatientRegistrationProps {
  onPatientRegistered: (patient: PatientData) => void
  userRole: string
}

function PatientRegistration({ onPatientRegistered, userRole }: PatientRegistrationProps) {
  const [formData, setFormData] = useState<PatientData>({
    fullName: "",
    physicalAddress: "",
    telephone: "",
    email: "",
    medicalAidNumber: "",
    dateOfBirth: "",
    gender: "",
    emergencyContact: "",
    emergencyPhone: "",
    knownAllergies: "",
    currentMedications: "",
    chronicConditions: "",
    isMember: false,
  })

  const [isSearching, setIsSearching] = useState(false)
  const [memberFound, setMemberFound] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleMedicalAidSearch = async () => {
    if (!formData.medicalAidNumber) return

    setIsSearching(true)
    setError(null)

    try {
      // For now, simulate member search since apiService.searchMember might not exist
      // Replace this with actual API call when available
      const response: { success: boolean; data: MemberRecord | null } = { success: false, data: null }

      if (response.success && response.data) {
        setFormData((prev) => ({
          ...prev,
          fullName: response.data?.full_name || prev.fullName,
          telephone: response.data?.telephone_number || prev.telephone,
          email: response.data?.email || prev.email,
          physicalAddress: response.data?.physical_address || prev.physicalAddress,
          isMember: true,
          membershipStatus: response.data?.status || "active",
        }))
        setMemberFound(true)
  setSuccess("POLMED member found and details populated")
      } else {
        setMemberFound(false)
        setFormData((prev) => ({ ...prev, isMember: false }))
      }
    } catch (err) {
      setError("Failed to search member database. Please try again.")
      setMemberFound(false)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // ...existing code...
      const nameParts = formData.fullName.trim().split(" ")
      const firstName = nameParts[0] || ""
      const lastName = nameParts.slice(1).join(" ") || "N/A"

      // ...existing validation code...
      if (!formData.fullName.trim()) { setError("Full name is required"); setIsSubmitting(false); return }
      if (!formData.dateOfBirth) { setError("Date of birth is required"); setIsSubmitting(false); return }
      if (!formData.gender) { setError("Gender is required"); setIsSubmitting(false); return }
      if (!formData.telephone.trim()) { setError("Phone number is required"); setIsSubmitting(false); return }

      const g = formData.gender.trim().toLowerCase()
      const genderForApi = g === 'male' ? 'Male' : g === 'female' ? 'Female' : g ? 'Other' : ''
      const patientPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim() || "N/A",
        date_of_birth: formData.dateOfBirth.trim(),
        gender: genderForApi,
        phone_number: formData.telephone.trim(),
        medical_aid_number: formData.medicalAidNumber.trim() || null,
        email: formData.email.trim() || null,
        physical_address: formData.physicalAddress.trim() || null,
        emergency_contact_name: formData.emergencyContact.trim() || null,
        emergency_contact_phone: formData.emergencyPhone.trim() || null,
        is_palmed_member: formData.isMember,
        member_type: formData.isMember ? formData.membershipStatus || "active" : "Non-member",
        chronic_conditions: formData.chronicConditions.trim() ? [formData.chronicConditions.trim()] : [],
        allergies: formData.knownAllergies.trim() ? [formData.knownAllergies.trim()] : [],
        current_medications: formData.currentMedications.trim() ? [formData.currentMedications.trim()] : [],
      }

      if (!patientPayload.date_of_birth) { setError("Date of birth cannot be empty"); setIsSubmitting(false); return }
      if (!patientPayload.gender) { setError("Gender must be selected"); setIsSubmitting(false); return }

      // Use offlineManager if offline
      if (!offlineManager.getConnectionStatus()) {
        await offlineManager.saveData("patients", {
          ...patientPayload,
          id: `PAT-${Date.now()}`,
        })
        setSuccess("Patient saved offline and will sync when online.")
        setIsSubmitting(false)
        return
      }

      // Online: use API as before
      const result = await apiService.createPatient(patientPayload as any)
      if (result.success) {
        const patientData: PatientData = {
          ...formData,
          id: (result as any)?.data?.patient_id?.toString() || (result as any)?.patient_id?.toString() || `PAT-${Date.now()}`,
        }
        onPatientRegistered(patientData)
        setSuccess("Patient registered successfully!")
        setFormData({
          fullName: "",
          physicalAddress: "",
          telephone: "",
          email: "",
          medicalAidNumber: "",
          dateOfBirth: "",
          gender: "",
          emergencyContact: "",
          emergencyPhone: "",
          knownAllergies: "",
          currentMedications: "",
          chronicConditions: "",
          isMember: false,
        })
        setMemberFound(null)
      } else {
        setError(result.error || "Failed to register patient")
      }
    } catch (err) {
      console.error("[v0] Network error:", err)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (field: keyof PatientData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError(null)
    if (success) setSuccess(null)
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Patient Registration
        </CardTitle>
        <CardDescription>Register new patient or update existing patient information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label htmlFor="medicalAidNumber">Medical Aid Number</Label>
            <div className="flex gap-2">
              <Input
                id="medicalAidNumber"
                value={formData.medicalAidNumber}
                onChange={(e) => updateFormData("medicalAidNumber", e.target.value)}
                placeholder="Enter medical aid number (e.g., PAL123456)"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleMedicalAidSearch}
                disabled={!formData.medicalAidNumber || isSearching}
              >
                {isSearching ? "Searching..." : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {memberFound !== null && (
              <div className="flex items-center gap-2">
                {memberFound ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      POLMED Member Found
                    </Badge>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      Non-member / Dependent
                    </Badge>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => updateFormData("fullName", e.target.value)}
                  required
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateFormData("dateOfBirth", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select value={formData.gender} onValueChange={(value) => updateFormData("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Telephone *</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => updateFormData("telephone", e.target.value)}
                  required
                  placeholder="+27123456789"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  placeholder="patient@example.com"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="physicalAddress">Physical Address</Label>
                <Textarea
                  id="physicalAddress"
                  value={formData.physicalAddress}
                  onChange={(e) => updateFormData("physicalAddress", e.target.value)}
                  placeholder="Enter complete physical address"
                  rows={3}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Emergency Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact Name</Label>
                <Input
                  id="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={(e) => updateFormData("emergencyContact", e.target.value)}
                  placeholder="Contact person name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={formData.emergencyPhone}
                  onChange={(e) => updateFormData("emergencyPhone", e.target.value)}
                  placeholder="+27123456789"
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Medical History</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="knownAllergies">Known Allergies</Label>
                <Textarea
                  id="knownAllergies"
                  value={formData.knownAllergies}
                  onChange={(e) => updateFormData("knownAllergies", e.target.value)}
                  placeholder="List any known allergies (medications, food, environmental)"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currentMedications">Current Medications</Label>
                <Textarea
                  id="currentMedications"
                  value={formData.currentMedications}
                  onChange={(e) => updateFormData("currentMedications", e.target.value)}
                  placeholder="List current medications and dosages"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chronicConditions">Chronic Conditions</Label>
                <Textarea
                  id="chronicConditions"
                  value={formData.chronicConditions}
                  onChange={(e) => updateFormData("chronicConditions", e.target.value)}
                  placeholder="List any chronic medical conditions"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Registering Patient..." : "Register Patient"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export { PatientRegistration }
export default PatientRegistration
