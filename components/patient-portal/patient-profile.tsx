"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Phone, Shield, Eye, EyeOff, Save, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PatientProfileProps {
  patientId: number
  patientData: {
    full_name: string
    email: string
    phone_number: string
    medical_aid_number: string
    is_palmed_member: boolean
    member_type?: string
  }
}

export function PatientProfile({ patientId, patientData }: PatientProfileProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Form state
  const [formData, setFormData] = useState({
    full_name: patientData.full_name,
    email: patientData.email,
    phone_number: patientData.phone_number,
    address: "123 Main Street, Johannesburg, 2000",
    emergency_contact_name: "Jane Doe",
    emergency_contact_phone: "+27 82 123 4567",
    emergency_contact_relationship: "Spouse",
    current_password: "",
    new_password: "",
    confirm_password: "",
  })

  // Privacy settings
  const [privacySettings, setPrivacySettings] = useState({
    share_data_with_researchers: false,
    receive_health_tips: true,
    receive_appointment_reminders: true,
    receive_marketing_emails: false,
    allow_emergency_contact_access: true,
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePrivacyChange = (field: string, value: boolean) => {
    setPrivacySettings((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    try {
      setLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Profile updated successfully",
        description: "Your profile information has been saved.",
      })
      setIsEditing(false)
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (formData.new_password !== formData.confirm_password) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      })
      return
    }

    if (formData.new_password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Password changed successfully",
        description: "Your password has been updated.",
      })

      setFormData((prev) => ({
        ...prev,
        current_password: "",
        new_password: "",
        confirm_password: "",
      }))
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSavePrivacySettings = async () => {
    try {
      setLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved.",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update privacy settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Profile Settings</h2>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleInputChange("full_name", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="phone_number">Phone Number</Label>
                  <Input
                    id="phone_number"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label>Medical Aid Number</Label>
                  <div className="flex items-center gap-2">
                    <Input value={patientData.medical_aid_number} disabled />
                    <Badge variant={patientData.is_palmed_member ? "default" : "secondary"}>
                      {patientData.is_palmed_member ? `POLMED ${patientData.member_type}` : "Non-member"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Emergency Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="emergency_contact_name">Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    value={formData.emergency_contact_name}
                    onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                  <Input
                    id="emergency_contact_relationship"
                    value={formData.emergency_contact_relationship}
                    onChange={(e) => handleInputChange("emergency_contact_relationship", e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="current_password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showPassword ? "text" : "password"}
                    value={formData.current_password}
                    onChange={(e) => handleInputChange("current_password", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={formData.new_password}
                  onChange={(e) => handleInputChange("new_password", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) => handleInputChange("confirm_password", e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} disabled={loading}>
                Change Password
              </Button>
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your account is secured with industry-standard encryption. We recommend using a strong, unique password.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="privacy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Privacy Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Share data with researchers</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow anonymized health data to be used for medical research
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.share_data_with_researchers}
                    onCheckedChange={(checked) => handlePrivacyChange("share_data_with_researchers", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Receive health tips</Label>
                    <p className="text-sm text-muted-foreground">Get personalized health tips and wellness advice</p>
                  </div>
                  <Switch
                    checked={privacySettings.receive_health_tips}
                    onCheckedChange={(checked) => handlePrivacyChange("receive_health_tips", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Appointment reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive SMS and email reminders for upcoming appointments
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.receive_appointment_reminders}
                    onCheckedChange={(checked) => handlePrivacyChange("receive_appointment_reminders", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Marketing emails</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive promotional emails about new services and features
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.receive_marketing_emails}
                    onCheckedChange={(checked) => handlePrivacyChange("receive_marketing_emails", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Emergency contact access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow emergency contacts to access your basic health information
                    </p>
                  </div>
                  <Switch
                    checked={privacySettings.allow_emergency_contact_access}
                    onCheckedChange={(checked) => handlePrivacyChange("allow_emergency_contact_access", checked)}
                  />
                </div>
              </div>

              <Button onClick={handleSavePrivacySettings} disabled={loading}>
                <Save className="w-4 h-4 mr-2" />
                Save Privacy Settings
              </Button>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your privacy is important to us. We comply with POPI Act regulations and never share your personal
              information without consent.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}
