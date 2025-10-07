"use client"

import { useState } from "react"
import { apiService, type CreateReferralRequest } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface Props {
  patientId: number
  currentStage: "Registration" | "Nursing Assessment" | "Doctor Consultation" | "Counseling Session"
  visitId?: number
  onClose: () => void
  onCreated?: () => void
}

export function ReferralModal({ patientId, currentStage, visitId, onClose, onCreated }: Props) {
  const [type, setType] = useState<"internal" | "external">("internal")
  const [toStage, setToStage] = useState<Props["currentStage"] | "Registration">("Registration")
  const [provider, setProvider] = useState("")
  const [department, setDepartment] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    const payload: CreateReferralRequest = {
      referral_type: type,
      from_stage: currentStage,
      to_stage: type === "internal" ? (toStage as any) : undefined,
      external_provider: type === "external" ? provider : undefined,
      department: type === "external" ? department : undefined,
      reason: reason.trim(),
      notes: notes || undefined,
      visit_id: visitId,
      appointment_date: date || undefined,
    }

    setLoading(true)
    const res = await apiService.createReferral(patientId, payload)
    setLoading(false)
    if (!res.success) {
      setError(res.error || "Failed to create referral")
      return
    }
    onCreated?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-black/50 to-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-background/95 backdrop-blur-xl rounded-2xl shadow-2xl shadow-primary/20 w-full max-w-lg p-6 border border-primary/10 animate-in slide-in-from-bottom-4 duration-300">
        <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Create Referral
        </h2>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Referral type</Label>
            <Select value={type} onValueChange={(val) => setType(val as any)}>
              <SelectTrigger className="w-full border-primary/20 focus:border-primary focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
              </SelectContent>
            </Select>
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
