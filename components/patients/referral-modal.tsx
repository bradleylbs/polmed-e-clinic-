"use client"

import { useState } from "react"
import { apiService, type CreateReferralRequest } from "@/lib/api-service"

interface Props {
  patientId: number
  currentStage: 'Registration' | 'Nursing Assessment' | 'Doctor Consultation' | 'Counseling Session'
  visitId?: number
  onClose: () => void
  onCreated?: () => void
}

export function ReferralModal({ patientId, currentStage, visitId, onClose, onCreated }: Props) {
  const [type, setType] = useState<'internal' | 'external'>('internal')
  const [toStage, setToStage] = useState<Props['currentStage'] | ''>('')
  const [provider, setProvider] = useState('')
  const [department, setDepartment] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!reason.trim()) { setError("Reason is required"); return }
    if (type === 'internal' && !toStage) { setError("Target stage is required"); return }
    if (type === 'external' && !provider.trim()) { setError("External provider is required"); return }

    const payload: CreateReferralRequest = {
      referral_type: type,
      from_stage: currentStage,
      to_stage: type === 'internal' ? (toStage as any) : undefined,
      external_provider: type === 'external' ? provider : undefined,
      department: type === 'external' ? department : undefined,
      reason: reason.trim(),
      notes: notes || undefined,
      visit_id: visitId,
      appointment_date: date || undefined,
    }

    setLoading(true)
    const res = await apiService.createReferral(patientId, payload)
    setLoading(false)
    if (!res.success) { setError(res.error || "Failed to create referral"); return }
    onCreated?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-background rounded shadow w-full max-w-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Create Referral</h2>

        <label className="block text-sm mb-1">Referral type</label>
  <select title="Referral type" className="border rounded w-full p-2 mb-3" value={type} onChange={e=>setType(e.target.value as any)}>
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>

        {type === 'internal' ? (
          <>
            <label className="block text-sm mb-1">From stage</label>
            <input title="From stage" placeholder="From stage" className="border rounded w-full p-2 mb-3" value={currentStage} disabled />
            <label className="block text-sm mb-1">To stage</label>
            <select title="To stage" className="border rounded w-full p-2 mb-3" value={toStage} onChange={e=>setToStage(e.target.value as any)}>
              <option value="">Select stage</option>
              <option>Registration</option>
              <option>Nursing Assessment</option>
              <option>Doctor Consultation</option>
              <option>Counseling Session</option>
            </select>
          </>
        ) : (
          <>
            <label className="block text-sm mb-1">External provider</label>
            <input title="External provider" placeholder="External provider" className="border rounded w-full p-2 mb-3" value={provider} onChange={e=>setProvider(e.target.value)} />
            <label className="block text-sm mb-1">Department (optional)</label>
            <input title="Department" placeholder="Department" className="border rounded w-full p-2 mb-3" value={department} onChange={e=>setDepartment(e.target.value)} />
            <label className="block text-sm mb-1">Appointment date (optional)</label>
            <input type="date" title="Appointment date" className="border rounded w-full p-2 mb-3" value={date} onChange={e=>setDate(e.target.value)} />
          </>
        )}

        <label className="block text-sm mb-1">Reason</label>
  <textarea title="Reason" placeholder="Reason for referral" className="border rounded w-full p-2 mb-3" rows={3} value={reason} onChange={e=>setReason(e.target.value)} />

        <label className="block text-sm mb-1">Notes (optional)</label>
  <textarea title="Notes" placeholder="Additional notes" className="border rounded w-full p-2 mb-3" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />

        {error && <div className="text-destructive text-sm mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="px-3 py-2 bg-primary text-primary-foreground rounded" onClick={submit} disabled={loading}>
            {loading ? "Saving..." : "Create referral"}
          </button>
        </div>
      </div>
    </div>
  )
}
