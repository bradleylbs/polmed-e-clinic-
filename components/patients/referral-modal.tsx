"use client"

import { useState, useEffect } from "react"
import { apiService, type CreateReferralRequest } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, X, Send, UserPlus, Stethoscope } from "lucide-react"

interface SpecialistDefinition {
  specialist_type: string
  label: string
  role: string
  note_type: string
}

interface Props {
  patientId: number
  currentStage: "Registration" | "Nursing Assessment" | "Doctor Consultation" | "Counseling Session"
  visitId?: number
  specialistContext?: string
  isPolmedMember?: boolean
  userRole?: string
  specialistCatalog?: SpecialistDefinition[]
  selectedSpecialists?: string[]
  onSpecialistToggle?: (specialistType: string) => void
  onClose: () => void
  onCreated?: () => void
}

// Role-based specialist filtering
const NURSE_ALLOWED_SPECIALISTS = ['optometrist', 'audiologist', 'dentist']
const DOCTOR_ALLOWED_SPECIALISTS = ['optometrist', 'audiologist', 'dentist', 'gynaecologist', 'ultrasound', 'psychology', 'cpet_treadmill']
const SOCIAL_WORKER_ALLOWED_SPECIALISTS: string[] = [] // No internal specialists, external only

export function ReferralModal({ patientId, currentStage, visitId, specialistContext, isPolmedMember, userRole, specialistCatalog = [], selectedSpecialists = [], onSpecialistToggle, onClose, onCreated }: Props) {
  // For psychology referrals with POLMED members, default to external only
  const isPsychologyReferral = specialistContext?.toLowerCase().includes('psychology') || specialistContext?.toLowerCase().includes('psychologist')
  const shouldForceExternal = isPsychologyReferral && isPolmedMember
  
  const [type, setType] = useState<"internal" | "external" | "internal_specialist">(shouldForceExternal ? "external" : "internal")
  const [toStage, setToStage] = useState<Props["currentStage"] | "Registration">("Registration")
  const [provider, setProvider] = useState("")
  const [department, setDepartment] = useState(isPsychologyReferral ? "Psychology" : "")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localSelectedSpecialists, setLocalSelectedSpecialists] = useState<string[]>(selectedSpecialists)

  // Filter specialists based on user role
  const allowedSpecialists = (() => {
    const role = userRole?.toLowerCase() || ''
    if (role === 'nurse') return NURSE_ALLOWED_SPECIALISTS
    if (role === 'doctor' || role === 'administrator') return DOCTOR_ALLOWED_SPECIALISTS
    if (role === 'social_worker' || role === 'social_work') return SOCIAL_WORKER_ALLOWED_SPECIALISTS
    return [] // Default: no specialist access
  })()

  const filteredSpecialistCatalog = specialistCatalog.filter(spec => 
    allowedSpecialists.includes(spec.specialist_type)
  )

  // Sync local selection with parent
  useEffect(() => {
    setLocalSelectedSpecialists(selectedSpecialists)
  }, [selectedSpecialists])

  const toggleLocalSpecialist = (specialistType: string) => {
    setLocalSelectedSpecialists(prev => 
      prev.includes(specialistType) 
        ? prev.filter(s => s !== specialistType)
        : [...prev, specialistType]
    )
  }

  const submit = async () => {
    setError(null)
    if (!reason.trim()) {
      setError("Reason is required")
      return
    }
    if (type === "internal" && !toStage) {
      setError("Target stage is required")
      return
    }
    if (type === "external" && !provider.trim()) {
      setError("External provider is required")
      return
    }
    if (type === "internal_specialist" && localSelectedSpecialists.length === 0) {
      setError("Please select at least one specialist")
      return
    }

    setLoading(true)

    try {
      // For internal specialist referrals, update visit specialists first
      if (type === "internal_specialist" && visitId && onSpecialistToggle) {
        // Sync selected specialists to parent/backend
        for (const specialistType of localSelectedSpecialists) {
          if (!selectedSpecialists.includes(specialistType)) {
            onSpecialistToggle(specialistType)
          }
        }
        
        // Create a documentation referral record (using internal type with stage = current stage for audit)
        const payload: CreateReferralRequest = {
          referral_type: "internal",
          from_stage: currentStage,
          to_stage: currentStage, // Same stage for specialist referral documentation
          reason: `Specialist Referral: ${localSelectedSpecialists.map(s => specialistCatalog.find(c => c.specialist_type === s)?.label || s).join(', ')} - ${reason.trim()}`,
          notes: notes || undefined,
          visit_id: visitId,
          appointment_date: date || undefined,
        }
        
        const res = await apiService.createReferral(patientId, payload)
        if (!res.success) {
          setError(res.error || "Failed to create referral documentation")
          setLoading(false)
          return
        }
      } else {
        // Standard internal stage or external referral
        const payload: CreateReferralRequest = {
          referral_type: type === "external" ? "external" : "internal",
          from_stage: currentStage,
          to_stage: type === "internal" ? (toStage as any) : undefined,
          external_provider: type === "external" ? provider : undefined,
          department: type === "external" ? department : undefined,
          reason: reason.trim(),
          notes: notes || undefined,
          visit_id: visitId,
          appointment_date: date || undefined,
        }

        const res = await apiService.createReferral(patientId, payload)
        if (!res.success) {
          setError(res.error || "Failed to create referral")
          setLoading(false)
          return
        }
      }

      setLoading(false)
      onCreated?.()
      onClose()
    } catch (err) {
      setLoading(false)
      setError("An unexpected error occurred")
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-primary/20 w-full max-w-lg p-6 border border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            Create Referral
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Referral type</Label>
            <Select 
              value={type} 
              onValueChange={(val) => setType(val as any)}
              disabled={shouldForceExternal}
            >
              <SelectTrigger className="w-full border-primary/20 focus:border-primary focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal" disabled={shouldForceExternal}>
                  Internal Stage {shouldForceExternal && "(Not available for psychology - POLMED policy)"}
                </SelectItem>
                {filteredSpecialistCatalog.length > 0 && (
                  <SelectItem value="internal_specialist">
                    Internal Specialist
                  </SelectItem>
                )}
                <SelectItem value="external">External Provider</SelectItem>
              </SelectContent>
            </Select>
            {shouldForceExternal && (
              <p className="text-xs text-muted-foreground mt-1">
                ℹ️ POLMED members must use external psychology referrals only
              </p>
            )}
          </div>

          {type === "internal" ? (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">From stage</Label>
                <Input className="border-primary/20 bg-muted/50" value={currentStage} disabled />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">To stage</Label>
                <Select value={toStage} onValueChange={(val) => setToStage(val as any)}>
                  <SelectTrigger className="w-full border-primary/20 focus:border-primary focus:ring-primary/20">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Registration">Registration</SelectItem>
                    <SelectItem value="Nursing Assessment">Nursing Assessment</SelectItem>
                    <SelectItem value="Doctor Consultation">Doctor Consultation</SelectItem>
                    <SelectItem value="Counseling Session">Counseling Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : type === "internal_specialist" ? (
            <>
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary" />
                  Select Specialists
                </Label>
                <div className="grid grid-cols-1 gap-2 p-4 bg-muted/30 rounded-lg border border-primary/10">
                  {filteredSpecialistCatalog.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No specialists available for your role
                    </p>
                  ) : (
                    filteredSpecialistCatalog.map(specialist => (
                      <div key={specialist.specialist_type} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`specialist-${specialist.specialist_type}`}
                          checked={localSelectedSpecialists.includes(specialist.specialist_type)}
                          onCheckedChange={() => toggleLocalSpecialist(specialist.specialist_type)}
                          className="border-primary/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label
                          htmlFor={`specialist-${specialist.specialist_type}`}
                          className="text-sm font-medium cursor-pointer flex-1"
                        >
                          {specialist.label}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {localSelectedSpecialists.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ✓ {localSelectedSpecialists.length} specialist{localSelectedSpecialists.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">External provider</Label>
                <Input
                  placeholder="External provider"
                  className="border-primary/20 focus:border-primary focus:ring-primary/20"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Department (optional)</Label>
                <Input
                  placeholder="Department"
                  className="border-primary/20 focus:border-primary focus:ring-primary/20"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Appointment date (optional)</Label>
                <Input
                  type="date"
                  className="border-primary/20 focus:border-primary focus:ring-primary/20"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Reason</Label>
            <Textarea
              placeholder="Reason for referral"
              className="border-primary/20 focus:border-primary focus:ring-primary/20 min-h-[80px]"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Notes (optional)</Label>
            <Textarea
              placeholder="Additional notes"
              className="border-primary/20 focus:border-primary focus:ring-primary/20 min-h-[60px]"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-primary/20 hover:bg-primary/5 bg-transparent"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={loading}
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/30"
            >
              {loading ? "Saving..." : "Create referral"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
