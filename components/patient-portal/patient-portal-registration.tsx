"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import {
  Eye,
  EyeOff,
  UserPlus,
  Shield,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
} from "lucide-react"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface PatientPortalRegistrationProps {
  onRegistrationComplete: (data: any) => Promise<void>
  onBackToLogin: () => void
}

interface RegistrationData {
  // Personal Information
  first_name: string
  last_name: string
  date_of_birth: string
  gender: string

  // Contact Information
  email: string
  mobile_number: string  // Changed from phone_number

  // POLMED Information
  polmed_number: string  // Changed from medical_aid_number

  // Authentication
  password: string
  confirm_password: string

  // Agreements
  terms_accepted: boolean
  privacy_accepted: boolean
  marketing_consent: boolean
}

export function PatientPortalRegistration({ onRegistrationComplete, onBackToLogin }: PatientPortalRegistrationProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<RegistrationData>({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    mobile_number: "",  // Changed from phone_number
    polmed_number: "",  // Changed from medical_aid_number
    password: "",
    confirm_password: "",
    terms_accepted: false,
    privacy_accepted: false,
    marketing_consent: false,
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isValidatingPolmed, setIsValidatingPolmed] = useState(false)
  const [polmedValidation, setPolmedValidation] = useState<{
    is_valid: boolean
    member_type?: string
    validation_message: string
  } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  const totalSteps = 4
  const progress = (currentStep / totalSteps) * 100

  const updateFormData = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Personal Information
        if (!formData.first_name.trim()) newErrors.first_name = "First name is required"
        if (!formData.last_name.trim()) newErrors.last_name = "Last name is required"
        if (!formData.date_of_birth) newErrors.date_of_birth = "Date of birth is required"
        if (!formData.gender) newErrors.gender = "Gender is required"

        // Validate age (must be 18+)
        if (formData.date_of_birth) {
          const birthDate = new Date(formData.date_of_birth)
          const today = new Date()
          const age = today.getFullYear() - birthDate.getFullYear()
          if (age < 18) newErrors.date_of_birth = "You must be 18 or older to register"
        }
        break

      case 2: // Contact Information
        if (!formData.email.trim()) {
          newErrors.email = "Email is required"
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
          newErrors.email = "Please enter a valid email address"
        }

        if (!formData.mobile_number.trim()) {  // Changed from phone_number
          newErrors.mobile_number = "Mobile number is required"  // Changed from phone_number
        } else if (!/^(\+27|0)[0-9]{9}$/.test(formData.mobile_number.replace(/\s/g, ""))) {  // Changed from phone_number
          newErrors.mobile_number = "Please enter a valid South African mobile number"  // Changed from phone_number
        }
        break

      case 3: // POLMED & Security
        if (!formData.polmed_number.trim()) {  // Changed from medical_aid_number
          newErrors.polmed_number = "POLMED number is required"  // Changed from medical_aid_number
        }

        if (!polmedValidation?.is_valid) {
          newErrors.polmed_number = "Please validate your POLMED membership"  // Changed from medical_aid_number
        }

        if (!formData.password) {
          newErrors.password = "Password is required"
        } else if (formData.password.length < 8) {
          newErrors.password = "Password must be at least 8 characters"
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
          newErrors.password = "Password must contain uppercase, lowercase, and number"
        }

        if (formData.password !== formData.confirm_password) {
          newErrors.confirm_password = "Passwords do not match"
        }
        break

      case 4: // Terms & Conditions
        if (!formData.terms_accepted) newErrors.terms_accepted = "You must accept the terms and conditions"
        if (!formData.privacy_accepted) newErrors.privacy_accepted = "You must accept the privacy policy"
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleValidatePolmed = async () => {
    if (!formData.polmed_number.trim()) {  // Changed from medical_aid_number
      setErrors((prev) => ({ ...prev, polmed_number: "Please enter your POLMED number" }))  // Changed from medical_aid_number
      return
    }

    setIsValidatingPolmed(true)
    try {
      const response = await patientPortalService.validatePolmedMembership(formData.polmed_number)  // Changed from medical_aid_number

      if (response.success && response.data) {
        setPolmedValidation(response.data)

        if (response.data.is_valid) {
          toast({
            title: "POLMED Membership Validated",
            description: `Valid ${response.data.member_type} membership found.`,
          })
        } else {
          toast({
            title: "Validation Failed",
            description: response.data.validation_message,
            variant: "destructive",
          })
        }
      } else {
        toast({
          title: "Validation Error",
          description: response.error || "Failed to validate POLMED membership",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "An error occurred while validating your membership",
        variant: "destructive",
      })
    } finally {
      setIsValidatingPolmed(false)
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setIsLoading(true)
    try {
      const registrationData = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        email: formData.email.trim().toLowerCase(),
        mobile_number: formData.mobile_number.trim(),  // Changed from phone_number
        polmed_number: formData.polmed_number.trim(),  // Changed from medical_aid_number
        password: formData.password,
      }

      await onRegistrationComplete(registrationData)
    } catch (error) {
      console.error("Registration error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <p className="text-sm text-muted-foreground">Tell us about yourself</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => updateFormData("first_name", e.target.value)}
                  placeholder="Enter your first name"
                />
                {errors.first_name && <p className="text-sm text-destructive">{errors.first_name}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => updateFormData("last_name", e.target.value)}
                  placeholder="Enter your last name"
                />
                {errors.last_name && <p className="text-sm text-destructive">{errors.last_name}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of Birth *</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={(e) => updateFormData("date_of_birth", e.target.value)}
                max={new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
              />
              {errors.date_of_birth && <p className="text-sm text-destructive">{errors.date_of_birth}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select value={formData.gender} onValueChange={(value) => updateFormData("gender", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <p className="text-sm text-muted-foreground">How can we reach you?</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                placeholder="Enter your email address"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              <p className="text-xs text-muted-foreground">
                We'll send appointment confirmations and important updates to this email
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile_number">Mobile Number *</Label>
              <Input
                id="mobile_number"
                type="tel"
                value={formData.mobile_number}
                onChange={(e) => updateFormData("mobile_number", e.target.value)}
                placeholder="e.g., +27123456789 or 0123456789"
              />
              {errors.mobile_number && <p className="text-sm text-destructive">{errors.mobile_number}</p>}
              <p className="text-xs text-muted-foreground">
                We'll use this for appointment reminders and urgent notifications
              </p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">POLMED & Security</h3>
              <p className="text-sm text-muted-foreground">Verify your membership and secure your account</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="polmed_number">POLMED Number *</Label>
              <div className="flex gap-2">
                <Input
                  id="polmed_number"
                  value={formData.polmed_number}
                  onChange={(e) => updateFormData("polmed_number", e.target.value.toUpperCase())}
                  placeholder="e.g., PAL123456789"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleValidatePolmed}
                  disabled={!formData.polmed_number || isValidatingPolmed}
                >
                  {isValidatingPolmed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
              {errors.polmed_number && <p className="text-sm text-destructive">{errors.polmed_number}</p>}

              {polmedValidation && (
                <Alert variant={polmedValidation.is_valid ? "default" : "destructive"}>
                  {polmedValidation.is_valid ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {polmedValidation.validation_message}
                    {polmedValidation.is_valid && polmedValidation.member_type && (
                      <span className="block mt-1 font-medium">Member Type: {polmedValidation.member_type}</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                    placeholder="Create a strong password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters with uppercase, lowercase, and number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password *</Label>
                <div className="relative">
                  <Input
                    id="confirm_password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirm_password}
                    onChange={(e) => updateFormData("confirm_password", e.target.value)}
                    placeholder="Confirm your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm_password && <p className="text-sm text-destructive">{errors.confirm_password}</p>}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold">Terms & Conditions</h3>
              <p className="text-sm text-muted-foreground">Please review and accept our policies</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms_accepted"
                  checked={formData.terms_accepted}
                  onCheckedChange={(checked) => updateFormData("terms_accepted", checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="terms_accepted"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the Terms and Conditions *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    By checking this box, you agree to our{" "}
                    <a href="#" className="text-primary hover:underline">
                      Terms of Service
                    </a>
                  </p>
                </div>
              </div>
              {errors.terms_accepted && <p className="text-sm text-destructive ml-6">{errors.terms_accepted}</p>}

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacy_accepted"
                  checked={formData.privacy_accepted}
                  onCheckedChange={(checked) => updateFormData("privacy_accepted", checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="privacy_accepted"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I accept the Privacy Policy *
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    You agree to our{" "}
                    <a href="#" className="text-primary hover:underline">
                      Privacy Policy
                    </a>{" "}
                    and data processing practices (POPI Act compliant)
                  </p>
                </div>
              </div>
              {errors.privacy_accepted && <p className="text-sm text-destructive ml-6">{errors.privacy_accepted}</p>}

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="marketing_consent"
                  checked={formData.marketing_consent}
                  onCheckedChange={(checked) => updateFormData("marketing_consent", checked as boolean)}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label
                    htmlFor="marketing_consent"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I consent to receive marketing communications (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Receive health tips, clinic updates, and promotional offers via email and SMS
                  </p>
                </div>
              </div>
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your personal information is protected under the Protection of Personal Information Act (POPI Act). We
                will never share your data with third parties without your explicit consent.
              </AlertDescription>
            </Alert>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle>Create Your Patient Portal Account</CardTitle>
          <CardDescription>Join thousands of POLMED members managing their healthcare online</CardDescription>
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => e.preventDefault()}>
            {renderStep()}
            <div className="flex justify-between mt-8">
              <Button
                type="button"
                variant="outline"
                onClick={currentStep === 1 ? onBackToLogin : handlePrevious}
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {currentStep === 1 ? "Back to Login" : "Previous"}
              </Button>
              {currentStep < totalSteps ? (
                <Button type="button" onClick={handleNext} disabled={isLoading}>
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? (
                    <span>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Account...
                    </span>
                  ) : (
                    <span>
                      Create Account
                      <CheckCircle className="w-4 h-4 ml-2" />
                    </span>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
