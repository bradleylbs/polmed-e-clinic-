"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserCheck, Heart, Stethoscope, Users, CheckCircle, Clock, ArrowRight } from "lucide-react"
import { ReferralModal } from "./referral-modal"
import { apiService } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/components/ui/use-toast"

interface VitalSigns {
  bloodPressureSystolic: string
  bloodPressureDiastolic: string
  temperature: string
  weight: string
  height: string
  pulse: string
  respiratoryRate: string
  oxygenSaturation: string
}

interface ClinicalNotes {
  nursingAssessment: string
  doctorDiagnosis: string
  treatmentPlan: string
  prescriptions: string
  icd10Codes: string
  followUpRequired: boolean
  followUpDate: string
  counselingNotes: string
  mentalHealthScreening: string
  referrals: string
  finalNotes?: string
}

interface WorkflowStep {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  role: string
  status: "pending" | "in-progress" | "completed"
  completedBy?: string
  completedAt?: string
}

interface ClinicalWorkflowProps {
  patientId: string
  patientName: string
  userRole: string
  username: string
  onWorkflowComplete: () => void
}

export function ClinicalWorkflow({
  patientId,
  patientName,
  userRole,
  username,
  onWorkflowComplete,
}: ClinicalWorkflowProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const { toast } = useToast()
  const [savingVitals, setSavingVitals] = useState(false)
  const [visitId, setVisitId] = useState<number | null>(null)
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    temperature: "",
    weight: "",
    height: "",
    pulse: "",
    respiratoryRate: "",
    oxygenSaturation: "",
  })

  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotes>({
    nursingAssessment: "",
    doctorDiagnosis: "",
    treatmentPlan: "",
  prescriptions: "",
  icd10Codes: "",
  followUpRequired: false,
  followUpDate: "",
    counselingNotes: "",
    mentalHealthScreening: "",
  referrals: "",
  finalNotes: "",
  })

  const [showReferral, setShowReferral] = useState(false)

  // Summary data for File Closure
  const [clinicalSummary, setClinicalSummary] = useState<{ notes: any[]; referrals: any[] }>({ notes: [], referrals: [] })

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    {
      id: "registration",
      title: "Patient Check-in",
      icon: UserCheck,
      role: "clerk",
      status: "completed",
      completedBy: "System",
      completedAt: new Date().toISOString(),
    },
    {
      id: "nursing",
      title: "Nursing Assessment",
      icon: Heart,
      role: "nurse",
      status: userRole === "nurse" ? "in-progress" : "pending",
    },
    {
      id: "doctor",
      title: "Doctor Consultation",
      icon: Stethoscope,
      role: "doctor",
      status: "pending",
    },
    {
      id: "counseling",
      title: "Counseling Session",
      icon: Users,
      role: "social_worker",
      status: "pending",
    },
    {
      id: "closure",
      title: "File Closure",
      icon: CheckCircle,
      role: "doctor",
      status: "pending",
    },
  ])

  const canAccessStep = (step: WorkflowStep) => {
    if (userRole === "administrator") return true
    if (step.status === "completed") return true
    if (step.id === 'closure') {
      const counselingDone = workflowSteps.find((s) => s.id === 'counseling')?.status === 'completed'
      return step.role === userRole && counselingDone
    }
    return step.role === userRole
  }

  const completeCurrentStep = () => {
    const doComplete = async () => {
      const updatedSteps = [...workflowSteps]
      const currentStepData = updatedSteps[currentStep]
      if (!currentStepData || !canAccessStep(currentStepData)) return

      // Ensure a visit exists for note posting
      let vId = visitId
      if (!vId) {
        const created = await apiService.createVisit(Number(patientId), {})
        if (!created.success || !created.data?.visit_id) return
        vId = created.data.visit_id
        setVisitId(vId)
      }

      // Persist step result as a clinical note when applicable
      try {
        let saved = true
        if (currentStepData.id === 'doctor') {
          const parseList = (s?: string) => (s || '')
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x.length > 0)

          const diagContent = [
            clinicalNotes.icd10Codes && `ICD-10: ${clinicalNotes.icd10Codes}`,
            clinicalNotes.doctorDiagnosis && `Diagnosis: ${clinicalNotes.doctorDiagnosis}`,
          ].filter(Boolean).join('\n')

          const treatContent = [
            clinicalNotes.treatmentPlan && `Treatment: ${clinicalNotes.treatmentPlan}`,
            clinicalNotes.prescriptions && `Prescriptions: ${clinicalNotes.prescriptions}`,
            clinicalNotes.referrals && `Referrals: ${clinicalNotes.referrals}`,
          ].filter(Boolean).join('\n')

          if (!diagContent && !treatContent) {
            toast({ title: 'Nothing to save', description: 'Add a Diagnosis and/or Treatment before saving.', variant: 'destructive' })
            return
          }

          // Save Diagnosis note if provided
          if (diagContent) {
            const resDiag = await apiService.createClinicalNote(vId!, {
              note_type: 'Diagnosis',
              content: diagContent,
              icd10_codes: parseList(clinicalNotes.icd10Codes),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resDiag.success) { saved = false }
          }

          // Save Treatment note if provided
          if (treatContent) {
            const resTreat = await apiService.createClinicalNote(vId!, {
              note_type: 'Treatment',
              content: treatContent,
              medications_prescribed: parseList(clinicalNotes.prescriptions),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resTreat.success) { saved = false }
          }
        } else if (currentStepData.id === 'counseling') {
          const content = [
            clinicalNotes.mentalHealthScreening && `Screening: ${clinicalNotes.mentalHealthScreening}`,
            clinicalNotes.counselingNotes && `Notes: ${clinicalNotes.counselingNotes}`,
          ].filter(Boolean).join('\n') || 'Counseling session completed.'
          const res = await apiService.createClinicalNote(vId!, {
            note_type: 'Counseling',
            content,
            follow_up_required: !!clinicalNotes.followUpRequired,
            follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
          })
          saved = !!res.success
        } else if (currentStepData.id === 'closure') {
          const content = clinicalNotes.finalNotes?.trim() || 'File closed.'
          const res = await apiService.createClinicalNote(vId!, { note_type: 'Closure', content })
          saved = !!res.success
        }
        if (!saved) {
          toast({ title: 'Save failed', description: 'Could not save note. Please try again.', variant: 'destructive' })
          return
        }
      } catch (e) {
        toast({ title: 'Network error', description: 'Failed to reach server. Please try again.', variant: 'destructive' })
        return
      }

      updatedSteps[currentStep] = {
        ...currentStepData,
        status: "completed",
        completedBy: username,
        completedAt: new Date().toISOString(),
      }

      if (currentStep < updatedSteps.length - 1) {
        const nextIdx = currentStep + 1
        const nextStep = updatedSteps[nextIdx]
        const canViewNext = userRole === 'administrator' || nextStep.role === userRole
        const counselingDone = updatedSteps.find((s) => s.id === 'counseling')?.status === 'completed'
        // Only move next step to in-progress if it belongs to the current user role (or admin)
        // and, if it is closure, only when counseling is completed
        if (canViewNext && (nextStep.id !== 'closure' || counselingDone)) {
          updatedSteps[nextIdx] = { ...nextStep, status: 'in-progress' }
          setCurrentStep(nextIdx)
        }
      }

      setWorkflowSteps(updatedSteps)
      if (currentStep >= updatedSteps.length - 1) onWorkflowComplete()
    }
    doComplete()
  }

  const updateVitalSigns = (field: keyof VitalSigns, value: string) => {
    setVitalSigns((prev) => ({ ...prev, [field]: value }))
  }

  const updateClinicalNotes = (field: keyof ClinicalNotes, value: string) => {
    setClinicalNotes((prev) => ({ ...prev, [field]: value }))
  }

  // Load latest visit + vitals, then sync workflow from backend
  useEffect(() => {
    const syncFromServer = async () => {
      const latest = await apiService.getLatestVisit(Number(patientId))
      if (latest.success && latest.data?.id) {
        const vId = latest.data.id
        setVisitId(vId)

        // Populate vitals preview
        const vitals = await apiService.getVisitVitals(vId)
        if (vitals.success && vitals.data && vitals.data.count > 0) {
          const latestV = vitals.data.latest as any
          const lastNonNull = (vitals.data as any).last_non_null as any
          if (latestV) {
            setVitalSigns({
              bloodPressureSystolic: latestV.systolic_bp != null ? String(latestV.systolic_bp) : "",
              bloodPressureDiastolic: latestV.diastolic_bp != null ? String(latestV.diastolic_bp) : "",
              temperature: latestV.temperature != null ? String(latestV.temperature) : (lastNonNull?.temperature != null ? String(lastNonNull.temperature) : ""),
              weight: latestV.weight != null ? String(latestV.weight) : "",
              height: latestV.height != null ? String(latestV.height) : "",
              pulse: latestV.heart_rate != null ? String(latestV.heart_rate) : (lastNonNull?.heart_rate != null ? String(lastNonNull.heart_rate) : ""),
              respiratoryRate: "",
              oxygenSaturation: latestV.oxygen_saturation != null ? String(latestV.oxygen_saturation) : "",
            })

            // Note: Nursing Assessment is saved as a clinical note (Assessment),
            // not inside vitals payload. We'll hydrate it from clinical notes below.
          }
        }

        // Sync workflow from backend (map API 'stage/completed/completed_at' to local ids/status)
        const wf = await apiService.getWorkflowStatus(vId)
        if (wf.success && Array.isArray(wf.data)) {
          const stageToId: Record<string, WorkflowStep['id']> = {
            'Registration': 'registration',
            'Nursing Assessment': 'nursing',
            'Doctor Consultation': 'doctor',
            'Counseling Session': 'counseling',
            'File Closure': 'closure',
          }

          // Build a quick lookup of completion by step id
          const completionById: Record<string, { completed: boolean; completedAt?: string | null }> = {}
          for (const w of wf.data as any[]) {
            const id = stageToId[w.stage]
            if (id) {
              completionById[id] = { completed: !!w.completed, completedAt: w.completed_at || null }
            }
          }

          // Create the next steps array with statuses derived from server
          const nextSteps: WorkflowStep[] = workflowSteps.map((s) => {
            const info = completionById[s.id]
            if (info?.completed) {
              return { ...s, status: 'completed', completedAt: info.completedAt || s.completedAt }
            }
            return { ...s, status: 'pending' }
          })

          // Mark the first not-completed step OWNED by this role as in-progress.
          // If that step is closure, require counseling to be completed first.
          const counselingDone = nextSteps.find((s) => s.id === 'counseling')?.status === 'completed'
          const firstOwnedNotCompleted = nextSteps.findIndex((s) => s.status !== 'completed' && (userRole === 'administrator' || s.role === userRole) && (s.id !== 'closure' || counselingDone))
          if (firstOwnedNotCompleted >= 0) {
            nextSteps[firstOwnedNotCompleted] = { ...nextSteps[firstOwnedNotCompleted], status: 'in-progress' }
          }

          setWorkflowSteps(nextSteps)

          // Navigate to the first actionable step for this role
          const firstActionableLocalIdx = nextSteps.findIndex((s) => s.status !== 'completed' && (userRole === 'administrator' || s.role === userRole))
          if (firstActionableLocalIdx >= 0) {
            setCurrentStep(firstActionableLocalIdx)
          }
        }

        // Pull clinical notes and referrals for summary
        const [notesRes, refsRes] = await Promise.all([
          apiService.getClinicalNotes(vId),
          apiService.listReferrals(Number(patientId)),
        ])
        const notes: any[] = notesRes.success && Array.isArray(notesRes.data) ? notesRes.data : []
        setClinicalSummary({
          notes,
          // filter referrals for this visit if visit_id present
          referrals: (refsRes.success && Array.isArray(refsRes.data) ? refsRes.data : []).filter((r: any) => !r.visit_id || r.visit_id === vId),
        })

        // Map latest server notes into summary fields (do not overwrite if user is currently editing)
        const latestOfType = (t: string) => {
          const arr = notes.filter((n: any) => n.note_type === t)
          arr.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          return arr[0]?.content as string | undefined
        }
  const latestAssessment = latestOfType('Assessment')
  let latestDiagnosis = latestOfType('Diagnosis')
  const latestTreatment = latestOfType('Treatment')
        const latestCounseling = latestOfType('Counseling')
        // Fallback: older data may have Diagnosis embedded in a Treatment note
        if (!latestDiagnosis && latestTreatment && typeof latestTreatment === 'string') {
          const m = latestTreatment.match(/Diagnosis:\s*(.*)/i)
          if (m && m[1]) latestDiagnosis = m[1].trim()
        }
        // Extract prescriptions list from latest Treatment note if medications_prescribed comes through
        let prescriptionsText: string | undefined
        try {
          const treatNode = (notes || []).find((n: any) => n.note_type === 'Treatment')
          let meds = treatNode && treatNode.medications_prescribed
          if (typeof meds === 'string') {
            // Attempt to parse JSON string; fallback to comma-split
            try {
              const parsed = JSON.parse(meds)
              if (Array.isArray(parsed)) meds = parsed
            } catch {
              meds = meds.split(',').map((s: string) => s.trim()).filter((s: string) => !!s)
            }
          }
          if (Array.isArray(meds) && meds.length) {
            prescriptionsText = meds.join(', ')
          } else if (typeof latestTreatment === 'string') {
            const m = latestTreatment.match(/Prescriptions:\s*(.*)/i)
            if (m && m[1]) prescriptionsText = m[1].trim()
          }
        } catch {}

        if (latestAssessment || latestDiagnosis || latestTreatment || latestCounseling || prescriptionsText) {
          setClinicalNotes((prev) => ({
            ...prev,
      nursingAssessment: prev.nursingAssessment || latestAssessment || prev.nursingAssessment,
            doctorDiagnosis: prev.doctorDiagnosis || latestDiagnosis || prev.doctorDiagnosis,
            treatmentPlan: prev.treatmentPlan || latestTreatment || prev.treatmentPlan,
            prescriptions: prev.prescriptions || prescriptionsText || prev.prescriptions,
            counselingNotes: prev.counselingNotes || latestCounseling || prev.counselingNotes,
          }))
        }
      }
    }
    syncFromServer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, userRole])

  const saveVitals = async () => {
    // quick validations for numeric fields where provided
    const n = (v: string) => (v.trim() === "" ? undefined : Number(v))
    const payload = {
      systolic_bp: n(vitalSigns.bloodPressureSystolic),
      diastolic_bp: n(vitalSigns.bloodPressureDiastolic),
      heart_rate: n(vitalSigns.pulse),
      temperature: n(vitalSigns.temperature),
      weight: n(vitalSigns.weight),
      height: n(vitalSigns.height),
      oxygen_saturation: n(vitalSigns.oxygenSaturation),
      respiratory_rate: n(vitalSigns.respiratoryRate),
      nursing_notes: clinicalNotes.nursingAssessment?.trim() || undefined,
    }

    // Require at least one measurement
    const hasAny = Object.values(payload).some((v) => v !== undefined && v !== "")
    if (!hasAny) {
      toast({ title: "No data to save", description: "Enter at least one vital sign or note.", variant: "destructive" })
      return
    }

    try {
      setSavingVitals(true)
      // If offline, save to IndexedDB and queue for sync
      if (!offlineManager.getConnectionStatus()) {
        await offlineManager.saveData("vitals", {
          patientId,
          visitId: visitId || `VISIT-${Date.now()}`,
          payload,
          timestamp: Date.now(),
        })
        toast({ title: "Vital signs saved offline and will sync when online." })
        completeCurrentStep()
        setSavingVitals(false)
        return
      }

      let vId = visitId
      if (!vId) {
        const created = await apiService.createVisit(Number(patientId), {})
        if (!created.success || !created.data?.visit_id) {
          toast({ title: "Failed to start visit", description: created.error || "Could not create visit.", variant: "destructive" })
          setSavingVitals(false)
          return
        }
        vId = created.data.visit_id
        setVisitId(vId)
      }

      const res = await apiService.addVitalSigns(vId!, payload)
      if (!res.success) {
        toast({ title: "Save failed", description: res.error || "Could not save vital signs.", variant: "destructive" })
        setSavingVitals(false)
        return
      }

      toast({ title: "Vital signs saved" })
      completeCurrentStep()
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e), variant: "destructive" })
    } finally {
      setSavingVitals(false)
    }
  }

  const getStepContent = (step: WorkflowStep) => {
    switch (step.id) {
      case "nursing":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Vital Signs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Blood Pressure (mmHg)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Systolic"
                      value={vitalSigns.bloodPressureSystolic}
                      onChange={(e) => updateVitalSigns("bloodPressureSystolic", e.target.value)}
                    />
                    <span className="self-center">/</span>
                    <Input
                      placeholder="Diastolic"
                      value={vitalSigns.bloodPressureDiastolic}
                      onChange={(e) => updateVitalSigns("bloodPressureDiastolic", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperature (°C)</Label>
                  <Input
                    placeholder="36.5"
                    value={vitalSigns.temperature}
                    onChange={(e) => updateVitalSigns("temperature", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input
                    placeholder="70"
                    value={vitalSigns.weight}
                    onChange={(e) => updateVitalSigns("weight", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  <Input
                    placeholder="170"
                    value={vitalSigns.height}
                    onChange={(e) => updateVitalSigns("height", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pulse (bpm)</Label>
                  <Input
                    placeholder="72"
                    value={vitalSigns.pulse}
                    onChange={(e) => updateVitalSigns("pulse", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Oxygen Saturation (%)</Label>
                  <Input
                    placeholder="98"
                    value={vitalSigns.oxygenSaturation}
                    onChange={(e) => updateVitalSigns("oxygenSaturation", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nursing Assessment Notes</Label>
              <Textarea
                placeholder="Record nursing assessment, observations, and screening results..."
                value={clinicalNotes.nursingAssessment}
                onChange={(e) => updateClinicalNotes("nursingAssessment", e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={saveVitals} disabled={savingVitals}>
                {savingVitals ? "Saving..." : "Save vital signs"}
              </Button>
            </div>
          </div>
        )

      case "doctor":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>ICD-10 Codes (comma-separated)</Label>
              <Input
                placeholder="e.g., I10, E11.9"
                value={clinicalNotes.icd10Codes}
                onChange={(e) => updateClinicalNotes("icd10Codes", e.target.value as any)}
              />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea
                placeholder="Enter primary and secondary diagnoses..."
                value={clinicalNotes.doctorDiagnosis}
                onChange={(e) => updateClinicalNotes("doctorDiagnosis", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Treatment Plan</Label>
              <Textarea
                placeholder="Outline treatment recommendations and follow-up care..."
                value={clinicalNotes.treatmentPlan}
                onChange={(e) => updateClinicalNotes("treatmentPlan", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Medications Prescribed (comma-separated)</Label>
              <Textarea
                placeholder="e.g., Metformin 500mg, Amlodipine 5mg"
                value={clinicalNotes.prescriptions}
                onChange={(e) => updateClinicalNotes("prescriptions", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Referrals</Label>
              <Textarea
                placeholder="Specialist referrals or additional services required..."
                value={clinicalNotes.referrals}
                onChange={(e) => updateClinicalNotes("referrals", e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowReferral(true)}>Refer patient</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="doc-follow-up"
                  checked={clinicalNotes.followUpRequired}
                  onCheckedChange={(v) => updateClinicalNotes("followUpRequired", Boolean(v) as any)}
                />
                <Label htmlFor="doc-follow-up">Follow-up required</Label>
              </div>
              <div className="space-y-2">
                <Label>Follow-up date</Label>
                <Input
                  type="date"
                  value={clinicalNotes.followUpDate}
                  onChange={(e) => updateClinicalNotes("followUpDate", e.target.value as any)}
                  disabled={!clinicalNotes.followUpRequired}
                />
              </div>
            </div>
          </div>
        )

      case "counseling":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Mental Health Screening</Label>
              <Textarea
                placeholder="Record mental health assessment results and screening tools used..."
                value={clinicalNotes.mentalHealthScreening}
                onChange={(e) => updateClinicalNotes("mentalHealthScreening", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Counseling Notes</Label>
              <Textarea
                placeholder="Document counseling session, interventions, and recommendations..."
                value={clinicalNotes.counselingNotes}
                onChange={(e) => updateClinicalNotes("counselingNotes", e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="counsel-follow-up"
                  checked={clinicalNotes.followUpRequired}
                  onCheckedChange={(v) => updateClinicalNotes("followUpRequired", Boolean(v) as any)}
                />
                <Label htmlFor="counsel-follow-up">Follow-up required</Label>
              </div>
              <div className="space-y-2">
                <Label>Follow-up date</Label>
                <Input
                  type="date"
                  value={clinicalNotes.followUpDate}
                  onChange={(e) => updateClinicalNotes("followUpDate", e.target.value as any)}
                  disabled={!clinicalNotes.followUpRequired}
                />
              </div>
            </div>
          </div>
        )

      case "closure":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Patient Summary</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Review all clinical data and ensure completeness before closing the patient file.
              </p>

              {/* Quick vitals snapshot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="font-medium">BP:</span>
                  <span className="ml-2">{vitalSigns.bloodPressureSystolic && vitalSigns.bloodPressureDiastolic ? `${vitalSigns.bloodPressureSystolic}/${vitalSigns.bloodPressureDiastolic}` : '—'}</span>
                </div>
                <div>
                  <span className="font-medium">Pulse:</span>
                  <span className="ml-2">{vitalSigns.pulse || '—'} bpm</span>
                </div>
                <div>
                  <span className="font-medium">Temp:</span>
                  <span className="ml-2">{vitalSigns.temperature || '—'} °C</span>
                </div>
              </div>

              {/* Key notes */}
              <div className="mt-4 space-y-1">
                <div className="text-sm"><span className="font-medium">Nursing:</span> {clinicalNotes.nursingAssessment || '—'}</div>
                <div className="text-sm"><span className="font-medium">Diagnosis:</span> {clinicalNotes.doctorDiagnosis || '—'}</div>
                <div className="text-sm"><span className="font-medium">Prescriptions:</span> {clinicalNotes.prescriptions || '—'}</div>
                <div className="text-sm"><span className="font-medium">Counseling:</span> {clinicalNotes.counselingNotes || '—'}</div>
              </div>

              {/* Referrals (current visit) */}
              {clinicalSummary.referrals.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-1">Referrals</div>
                  <ul className="text-sm list-disc ml-5 space-y-1">
                    {clinicalSummary.referrals.map((r: any) => (
                      <li key={r.id}>
                        {r.referral_type} - {r.reason} ({r.status}){r.appointment_date ? ` • ${r.appointment_date}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Readiness checklist */}
              <div className="mt-4 text-sm space-y-1">
                {(() => {
                  // Use server-derived workflow statuses to determine readiness,
                  // so results reflect persisted data (and current session updates).
                  const hasVitals = workflowSteps.find((s) => s.id === 'nursing')?.status === 'completed'
                  const hasDoctorNote = workflowSteps.find((s) => s.id === 'doctor')?.status === 'completed'
                  const hasCounseling = workflowSteps.find((s) => s.id === 'counseling')?.status === 'completed'
                  const items = [
                    { ok: hasVitals, label: 'Vital signs recorded' },
                    { ok: hasDoctorNote, label: 'Doctor consultation notes recorded' },
                    { ok: hasCounseling, label: 'Counseling session notes recorded' },
                  ]
                  return (
                    <ul className="list-disc ml-5">
                      {items.map((it, idx) => (
                        <li key={idx} className={it.ok ? 'text-green-700' : 'text-red-700'}>
                          {it.label} {it.ok ? '✓' : '✗'}
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Final Notes</Label>
              <Textarea
                placeholder="Any additional notes or follow-up instructions..."
                rows={3}
                value={clinicalNotes.finalNotes || ''}
                onChange={(e) => updateClinicalNotes('finalNotes' as any, e.target.value)}
              />
            </div>
          </div>
        )

      default:
        return <div>Step content not available</div>
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Clinical Workflow - {patientName}</CardTitle>
        <CardDescription>Patient ID: {patientId}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Workflow Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {workflowSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      step.status === "completed"
                        ? "bg-primary border-primary text-primary-foreground"
                        : step.status === "in-progress"
                          ? "bg-accent border-accent text-accent-foreground"
                          : "bg-muted border-muted-foreground text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  {index < workflowSteps.length - 1 && <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {workflowSteps.map((step) => (
              <Badge
                key={step.id}
                variant={
                  step.status === "completed" ? "default" : step.status === "in-progress" ? "secondary" : "outline"
                }
              >
                {step.status === "completed" && <CheckCircle className="w-3 h-3 mr-1" />}
                {step.status === "in-progress" && <Clock className="w-3 h-3 mr-1" />}
                {step.title}
              </Badge>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Current Step Content */}
        <Tabs value={workflowSteps[currentStep]?.id} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            {workflowSteps.map((step, index) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                disabled={!canAccessStep(step)}
                onClick={() => setCurrentStep(index)}
              >
                {step.title}
              </TabsTrigger>
            ))}
          </TabsList>

          {workflowSteps.map((step) => (
            <TabsContent key={step.id} value={step.id} className="mt-6">
              {getStepContent(step)}

              {canAccessStep(step) && step.status !== "completed" && step.id !== "nursing" && (
                <div className="mt-6 flex flex-col items-end gap-2">
                  {(() => {
                    const nursingDone = workflowSteps.find((s) => s.id === 'nursing')?.status === 'completed'
                    const doctorDone = workflowSteps.find((s) => s.id === 'doctor')?.status === 'completed'
                    const counselingDone = workflowSteps.find((s) => s.id === 'counseling')?.status === 'completed'
                    const closureReady = step.id !== 'closure' || (nursingDone && doctorDone && counselingDone)
                    return (
                      <>
                        {step.id === 'closure' && !closureReady && (
                          <div className="text-xs text-muted-foreground mr-auto">
                            {(() => {
                              const missing: string[] = []
                              if (!nursingDone) missing.push('Nursing Assessment')
                              if (!doctorDone) missing.push('Doctor Consultation')
                              if (!counselingDone) missing.push('Counseling Session')
                              return `Complete required steps before closing: ${missing.join(' and ')}.`
                            })()}
                          </div>
                        )}
                        <Button onClick={completeCurrentStep} disabled={!closureReady}>
                          Complete {step.title}
                          <CheckCircle className="w-4 h-4 ml-2" />
                        </Button>
                      </>
                    )
                  })()}
                </div>
              )}

              {step.status === "completed" && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      Completed by {step.completedBy} on{" "}
                      {step.completedAt && new Date(step.completedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {showReferral && (
          <ReferralModal
            patientId={Number(patientId)}
            currentStage={workflowSteps[currentStep]?.title as any}
            onClose={() => setShowReferral(false)}
            onCreated={() => setShowReferral(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
