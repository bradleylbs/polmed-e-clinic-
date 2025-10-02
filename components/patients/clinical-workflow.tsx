"use client"

import type React from "react"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserCheck, Heart, Stethoscope, Users, CheckCircle, Clock, ArrowRight, Search, Plus, AlertTriangle, Activity, Thermometer, Brain, Eye } from "lucide-react"
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

interface VitalAlert {
  parameter: string
  value: string
  severity: 'normal' | 'caution' | 'critical'
  reference: string
}

interface SmartSuggestion {
  type: 'icd10' | 'medication' | 'investigation'
  text: string
  code?: string
  confidence: number
}

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
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
  const [completingStep, setCompletingStep] = useState(false)
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
  
  // Enhanced doctor consultation state
  const [medications, setMedications] = useState<Medication[]>([])
  const [investigations, setInvestigations] = useState<string[]>([])
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([])
  const [activeInput, setActiveInput] = useState<string>('')

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

  // Generate vital alerts for enhanced doctor interface
  const generateVitalAlerts = (): VitalAlert[] => {
    const alerts: VitalAlert[] = []
    
    // Blood Pressure Alert
    const systolic = Number(vitalSigns.bloodPressureSystolic)
    const diastolic = Number(vitalSigns.bloodPressureDiastolic)
    if (systolic && diastolic) {
      const severity = systolic >= 140 || diastolic >= 90 ? 'critical' : 
                     systolic >= 130 || diastolic >= 80 ? 'caution' : 'normal'
      alerts.push({
        parameter: 'Blood Pressure',
        value: `${systolic}/${diastolic} mmHg`,
        severity,
        reference: '<130/80 mmHg'
      })
    }

    // Temperature Alert
    const temp = Number(vitalSigns.temperature)
    if (temp) {
      const severity = temp >= 38.5 ? 'critical' : temp >= 37.5 ? 'caution' : 'normal'
      alerts.push({
        parameter: 'Temperature',
        value: `${temp}Â°C`,
        severity,
        reference: '36.1-37.2Â°C'
      })
    }

    // Heart Rate Alert
    const hr = Number(vitalSigns.pulse)
    if (hr) {
      const severity = hr > 100 || hr < 60 ? 'caution' : 'normal'
      alerts.push({
        parameter: 'Heart Rate',
        value: `${hr} bpm`,
        severity,
        reference: '60-100 bpm'
      })
    }

    // Oxygen Saturation Alert
    const spo2 = Number(vitalSigns.oxygenSaturation)
    if (spo2) {
      const severity = spo2 < 95 ? 'critical' : spo2 < 98 ? 'caution' : 'normal'
      alerts.push({
        parameter: 'SpO2',
        value: `${spo2}%`,
        severity,
        reference: 'â‰¥95%'
      })
    }

    return alerts
  }

  // Smart text analysis for suggestions
  const analyzeText = useCallback((text: string, context: string) => {
    const suggestions: SmartSuggestion[] = []
    const textLower = text.toLowerCase()
    
    if (context === 'diagnosis') {
      // Common diagnosis suggestions
      if (textLower.includes('hypertension') || textLower.includes('high blood pressure')) {
        suggestions.push({
          type: 'icd10',
          text: 'Essential hypertension',
          code: 'I10',
          confidence: 0.95
        })
      }
      if (textLower.includes('diabetes') || textLower.includes('sugar')) {
        suggestions.push({
          type: 'icd10',
          text: 'Type 2 diabetes mellitus',
          code: 'E11.9',
          confidence: 0.90
        })
      }
      if (textLower.includes('headache') || textLower.includes('cephalgia')) {
        suggestions.push({
          type: 'icd10',
          text: 'Headache',
          code: 'R51',
          confidence: 0.85
        })
      }
      if (textLower.includes('chest pain') || textLower.includes('angina')) {
        suggestions.push({
          type: 'icd10',
          text: 'Chest pain, unspecified',
          code: 'R07.9',
          confidence: 0.80
        })
      }
    }
    
    if (context === 'treatment') {
      // Medication suggestions
      if (textLower.includes('pain') || textLower.includes('analgesic')) {
        suggestions.push({
          type: 'medication',
          text: 'Paracetamol 500mg TDS',
          confidence: 0.8
        })
      }
      if (textLower.includes('infection') || textLower.includes('antibiotic')) {
        suggestions.push({
          type: 'medication',
          text: 'Amoxicillin 500mg TDS',
          confidence: 0.75
        })
      }
      if (textLower.includes('hypertension') || textLower.includes('blood pressure')) {
        suggestions.push({
          type: 'medication',
          text: 'Amlodipine 5mg OD',
          confidence: 0.85
        })
      }
    }
    
    setSmartSuggestions(suggestions)
  }, [])

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
    if (completingStep) return

    const doComplete = async () => {
      setCompletingStep(true)
      const updatedSteps = [...workflowSteps]
      const currentStepData = updatedSteps[currentStep]
      if (!currentStepData || !canAccessStep(currentStepData)) return

      // Ensure a visit exists for note posting
      let vId = visitId
      if (!vId) {
        const created = await apiService.createVisit(Number(patientId), {})
        if (!created.success || !created.data?.visit_id) {
          toast({
            title: "Failed to start visit",
            description: created.error || "Unable to create a visit record.",
            variant: "destructive",
          })
          return
        }
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
            medications.length > 0 && `Medications: ${medications.map(m => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`).join(', ')}`,
            investigations.length > 0 && `Investigations: ${investigations.join(', ')}`,
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
              medications_prescribed: medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`),
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
        const counselingDone = updatedSteps.find((s) => s.id === 'counseling')?.status === 'completed'
        const canUnlockNext = nextStep.id !== 'closure' || counselingDone

        if (canUnlockNext && nextStep.status !== 'completed') {
          updatedSteps[nextIdx] = { ...nextStep, status: 'in-progress' }
        }

        if (canUnlockNext) {
          const canViewNext = userRole === 'administrator' || nextStep.role === userRole
          if (canViewNext) {
            setCurrentStep(nextIdx)
          } else {
            const nextRoleLabel = nextStep.role.replace(/_/g, ' ')
            toast({
              title: `${currentStepData.title} completed`,
              description: `${nextStep.title} is now waiting for the ${nextRoleLabel}.`,
            })
          }
        }
      }

      setWorkflowSteps(updatedSteps)
      if (currentStep >= updatedSteps.length - 1) onWorkflowComplete()
    }

    doComplete()
      .catch((error) => {
        const description = error instanceof Error ? error.message : String(error)
        toast({ title: 'Unexpected error', description, variant: 'destructive' })
      })
      .finally(() => {
        setCompletingStep(false)
      })
    }

  const updateVitalSigns = (field: keyof VitalSigns, value: string) => {
    setVitalSigns((prev) => ({ ...prev, [field]: value }))
  }

  const updateClinicalNotes = (field: keyof ClinicalNotes, value: string) => {
    setClinicalNotes((prev) => ({ ...prev, [field]: value }))
  }

  // Enhanced doctor consultation functions
  const addQuickMedication = (preset: string) => {
    const presets: Record<string, Medication> = {
      'paracetamol': { name: 'Paracetamol', dosage: '500mg', frequency: 'TDS', duration: '5 days' },
      'ibuprofen': { name: 'Ibuprofen', dosage: '400mg', frequency: 'TDS', duration: '3 days' },
      'amoxicillin': { name: 'Amoxicillin', dosage: '500mg', frequency: 'TDS', duration: '7 days' },
      'amlodipine': { name: 'Amlodipine', dosage: '5mg', frequency: 'OD', duration: 'Ongoing' },
      'metformin': { name: 'Metformin', dosage: '500mg', frequency: 'BD', duration: 'Ongoing' },
      'enalapril': { name: 'Enalapril', dosage: '10mg', frequency: 'BD', duration: 'Ongoing' }
    }
    
    const medication = presets[preset]
    if (medication && !medications.find(m => m.name === medication.name)) {
      setMedications(prev => [...prev, medication])
    }
  }

  const addCustomMedication = (medication: Medication) => {
    if (medication.name && !medications.find(m => m.name === medication.name)) {
      setMedications(prev => [...prev, medication])
    }
  }

  const removeMedication = (index: number) => {
    setMedications(prev => prev.filter((_, i) => i !== index))
  }

  const addInvestigation = (investigation: string) => {
    if (investigation && !investigations.includes(investigation)) {
      setInvestigations(prev => [...prev, investigation])
    }
  }

  const removeInvestigation = (index: number) => {
    setInvestigations(prev => prev.filter((_, i) => i !== index))
  }

  const applySuggestion = (suggestion: SmartSuggestion) => {
    switch (suggestion.type) {
      case 'icd10':
        if (suggestion.code && !clinicalNotes.icd10Codes.includes(suggestion.code)) {
          const existingCodes = clinicalNotes.icd10Codes ? clinicalNotes.icd10Codes + ', ' : ''
          updateClinicalNotes('icd10Codes', existingCodes + suggestion.code)
        }
        break
      case 'medication':
        const [name, ...rest] = suggestion.text.split(' ')
        addQuickMedication(name.toLowerCase())
        break
    }
    setSmartSuggestions([])
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
          }
        }

        // Sync workflow from backend
        const wf = await apiService.getWorkflowStatus(vId)
        if (wf.success && Array.isArray(wf.data)) {
          const stageToId: Record<string, WorkflowStep['id']> = {
            'Registration': 'registration',
            'Nursing Assessment': 'nursing',
            'Doctor Consultation': 'doctor',
            'Counseling Session': 'counseling',
            'File Closure': 'closure',
          }

          const completionById: Record<string, { completed: boolean; completedAt?: string | null }> = {}
          for (const w of wf.data as any[]) {
            const id = stageToId[w.stage]
            if (id) {
              completionById[id] = { completed: !!w.completed, completedAt: w.completed_at || null }
            }
          }

          const nextSteps: WorkflowStep[] = workflowSteps.map((s) => {
            const info = completionById[s.id]
            if (info?.completed) {
              return { ...s, status: 'completed', completedAt: info.completedAt || s.completedAt }
            }
            return { ...s, status: 'pending' }
          })

          const counselingDone = nextSteps.find((s) => s.id === 'counseling')?.status === 'completed'
          const firstOwnedNotCompleted = nextSteps.findIndex((s) => s.status !== 'completed' && (userRole === 'administrator' || s.role === userRole) && (s.id !== 'closure' || counselingDone))
          if (firstOwnedNotCompleted >= 0) {
            nextSteps[firstOwnedNotCompleted] = { ...nextSteps[firstOwnedNotCompleted], status: 'in-progress' }
          }

          setWorkflowSteps(nextSteps)

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
          referrals: (refsRes.success && Array.isArray(refsRes.data) ? refsRes.data : []).filter((r: any) => !r.visit_id || r.visit_id === vId),
        })

        // Map latest server notes into summary fields
        const latestOfType = (t: string) => {
          const arr = notes.filter((n: any) => n.note_type === t)
          arr.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          return arr[0]?.content as string | undefined
        }
        const latestAssessment = latestOfType('Assessment')
        let latestDiagnosis = latestOfType('Diagnosis')
        const latestTreatment = latestOfType('Treatment')
        const latestCounseling = latestOfType('Counseling')

        if (!latestDiagnosis && latestTreatment && typeof latestTreatment === 'string') {
          const m = latestTreatment.match(/Diagnosis:\s*(.*)/i)
          if (m && m[1]) latestDiagnosis = m[1].trim()
        }

        let prescriptionsText: string | undefined
        try {
          const treatNode = (notes || []).find((n: any) => n.note_type === 'Treatment')
          let meds = treatNode && treatNode.medications_prescribed
          if (typeof meds === 'string') {
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
  }, [patientId, userRole])

  const saveVitals = async () => {
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

    const hasAny = Object.values(payload).some((v) => v !== undefined && v !== "")
    if (!hasAny) {
      toast({ title: "No data to save", description: "Enter at least one vital sign or note.", variant: "destructive" })
      return
    }

    try {
      setSavingVitals(true)
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
      case "nursing": {
        const nursingStep = workflowSteps.find((s) => s.id === "nursing")
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
                  <Label>Temperature (Â°C)</Label>
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
              <Button
                onClick={saveVitals}
                disabled={
                  savingVitals ||
                  completingStep ||
                  nursingStep?.status === "completed"
                }
              >
                {nursingStep?.status === "completed"
                  ? "Vital signs submitted"
                  : savingVitals
                    ? "Saving..."
                    : "Save vital signs"}
              </Button>
            </div>
          </div>
        )
      }

      case "doctor":
        const vitalAlerts = generateVitalAlerts()
        return (
          <div className="space-y-6">
            {/* Patient Summary Header */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{patientName}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Patient ID: {patientId} â€¢ {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date().toLocaleTimeString()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Smart Vitals Display with Alerts */}
                  {vitalAlerts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {vitalAlerts.map((alert, index) => (
                        <div key={index} className={`p-2 rounded text-xs border ${
                          alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                          alert.severity === 'caution' ? 'border-yellow-200 bg-yellow-50' :
                          'border-green-200 bg-green-50'
                        }`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{alert.parameter}</span>
                            {alert.severity !== 'normal' && (
                              <AlertTriangle className="w-3 h-3 text-orange-500" />
                            )}
                          </div>
                          <div className="font-mono text-sm">{alert.value}</div>
                          <div className="text-muted-foreground text-xs">Ref: {alert.reference}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Nursing Assessment Preview */}
                  {clinicalNotes.nursingAssessment && (
                    <div>
                      <span className="font-medium text-sm">Nursing Assessment:</span>
                      <p className="text-sm mt-1 p-2 bg-muted rounded line-clamp-2">
                        {clinicalNotes.nursingAssessment}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Doctor Consultation Interface */}
            <Tabs defaultValue="assessment" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="assessment">Assessment</TabsTrigger>
                <TabsTrigger value="diagnosis">Diagnosis</TabsTrigger>
                <TabsTrigger value="treatment">Treatment</TabsTrigger>
                <TabsTrigger value="review">Review</TabsTrigger>
              </TabsList>

              <TabsContent value="assessment" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" />
                      Clinical Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Clinical Examination & Findings</Label>
                      <Textarea
                        placeholder="Document clinical findings, examination results, review of systems..."
                        value={clinicalNotes.doctorDiagnosis}
                        onChange={(e) => {
                          updateClinicalNotes("doctorDiagnosis", e.target.value)
                          analyzeText(e.target.value, 'assessment')
                        }}
                        onFocus={() => setActiveInput('assessment')}
                        rows={6}
                        className="mt-1"
                      />
                    </div>

                    {/* Quick Assessment Templates */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Quick Templates</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => 
                          updateClinicalNotes("doctorDiagnosis", clinicalNotes.doctorDiagnosis + '\nâ€¢ Normal cardiovascular examination')
                        }>
                          <Heart className="w-3 h-3 mr-1" />
                          Normal CVS
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => 
                          updateClinicalNotes("doctorDiagnosis", clinicalNotes.doctorDiagnosis + '\nâ€¢ Clear chest on auscultation')
                        }>
                          <Activity className="w-3 h-3 mr-1" />
                          Clear Chest
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => 
                          updateClinicalNotes("doctorDiagnosis", clinicalNotes.doctorDiagnosis + '\nâ€¢ Abdomen soft, non-tender')
                        }>
                          Soft Abdomen
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => 
                          updateClinicalNotes("doctorDiagnosis", clinicalNotes.doctorDiagnosis + '\nâ€¢ Neurologically intact')
                        }>
                          <Brain className="w-3 h-3 mr-1" />
                          Normal Neuro
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnosis" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-5 h-5" />
                      Diagnosis & Coding
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Primary Diagnosis</Label>
                      <div className="relative">
                        <Textarea
                          placeholder="Enter primary and differential diagnoses..."
                          value={clinicalNotes.doctorDiagnosis}
                          onChange={(e) => {
                            updateClinicalNotes("doctorDiagnosis", e.target.value)
                            analyzeText(e.target.value, 'diagnosis')
                          }}
                          rows={3}
                          className="mt-1 pr-10"
                        />
                        <Search className="absolute top-3 right-3 w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* ICD-10 Codes */}
                    <div>
                      <Label className="text-sm font-medium">ICD-10 Codes</Label>
                      <div className="flex flex-wrap gap-2 mt-1 mb-2">
                        {clinicalNotes.icd10Codes.split(',').filter(c => c.trim()).map((code, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {code.trim()}
                            <button
                              onClick={() => {
                                const codes = clinicalNotes.icd10Codes.split(',').filter(c => c.trim())
                                codes.splice(index, 1)
                                updateClinicalNotes("icd10Codes", codes.join(', '))
                              }}
                              className="ml-1 hover:text-red-500"
                            >
                              Ã—
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <Input
                        placeholder="Add ICD-10 code (e.g., I10, E11.9)"
                        className="mt-2"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const value = (e.target as HTMLInputElement).value.trim()
                            if (value && !clinicalNotes.icd10Codes.includes(value)) {
                              const existing = clinicalNotes.icd10Codes.trim()
                              const newCodes = existing ? existing + ', ' + value : value
                              updateClinicalNotes("icd10Codes", newCodes)
                              ;(e.target as HTMLInputElement).value = ''
                            }
                          }
                        }}
                      />
                    </div>

                    {/* Smart Suggestions */}
                    {smartSuggestions.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <span className="text-sm font-medium">AI Suggestions:</span>
                            {smartSuggestions.map((suggestion, index) => (
                              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                <span className="text-sm">
                                  {suggestion.text} {suggestion.code && `(${suggestion.code})`}
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    {Math.round(suggestion.confidence * 100)}% confidence
                                  </Badge>
                                </span>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => applySuggestion(suggestion)}
                                >
                                  Apply
                                </Button>
                              </div>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="treatment" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Treatment Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Treatment Plan & Recommendations</Label>
                      <Textarea
                        placeholder="Outline treatment recommendations, lifestyle advice, follow-up care..."
                        value={clinicalNotes.treatmentPlan}
                        onChange={(e) => {
                          updateClinicalNotes("treatmentPlan", e.target.value)
                          analyzeText(e.target.value, 'treatment')
                        }}
                        rows={4}
                        className="mt-1"
                      />
                    </div>

                    {/* Enhanced Medications Section */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <Label className="text-sm font-medium">Medications Prescribed</Label>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication('paracetamol')}>
                            + Paracetamol
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication('ibuprofen')}>
                            + Ibuprofen
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication('amoxicillin')}>
                            + Antibiotic
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication('amlodipine')}>
                            + Amlodipine
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {medications.map((med, index) => (
                          <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                            <div className="flex-1 grid grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="font-medium text-xs text-muted-foreground block">Medication</span>
                                <span className="font-medium">{med.name}</span>
                              </div>
                              <div>
                                <span className="font-medium text-xs text-muted-foreground block">Dosage</span>
                                <span>{med.dosage}</span>
                              </div>
                              <div>
                                <span className="font-medium text-xs text-muted-foreground block">Frequency</span>
                                <span>{med.frequency}</span>
                              </div>
                              <div>
                                <span className="font-medium text-xs text-muted-foreground block">Duration</span>
                                <span>{med.duration}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeMedication(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Add Custom Medication */}
                      <div className="grid grid-cols-4 gap-2 p-3 border-2 border-dashed border-muted rounded-lg">
                        <Input placeholder="Medication name" id="med-name" />
                        <Input placeholder="Dosage" id="med-dosage" />
                        <Input placeholder="Frequency" id="med-frequency" />
                        <div className="flex gap-1">
                          <Input placeholder="Duration" id="med-duration" className="flex-1" />
                          <Button size="sm" onClick={() => {
                            const name = (document.getElementById('med-name') as HTMLInputElement)?.value
                            const dosage = (document.getElementById('med-dosage') as HTMLInputElement)?.value
                            const frequency = (document.getElementById('med-frequency') as HTMLInputElement)?.value
                            const duration = (document.getElementById('med-duration') as HTMLInputElement)?.value
                            
                            if (name && dosage && frequency && duration) {
                              addCustomMedication({ name, dosage, frequency, duration })
                              // Clear inputs
                              ;(document.getElementById('med-name') as HTMLInputElement).value = ''
                              ;(document.getElementById('med-dosage') as HTMLInputElement).value = ''
                              ;(document.getElementById('med-frequency') as HTMLInputElement).value = ''
                              ;(document.getElementById('med-duration') as HTMLInputElement).value = ''
                            }
                          }}>
                            Add
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Investigations */}
                    <div>
                      <Label className="text-sm font-medium">Investigations Ordered</Label>
                      <div className="flex flex-wrap gap-2 mt-1 mb-2">
                        {investigations.map((inv, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {inv}
                            <button
                              onClick={() => removeInvestigation(index)}
                              className="ml-1 hover:text-red-500"
                            >
                              Ã—
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Input 
                          placeholder="Add investigation (e.g., FBC, U&E, CXR)" 
                          id="investigation-input"
                          className="flex-1"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              const value = (e.target as HTMLInputElement).value.trim()
                              if (value) {
                                addInvestigation(value)
                                ;(e.target as HTMLInputElement).value = ''
                              }
                            }
                          }}
                        />
                        <Button size="sm" onClick={() => {
                          const input = document.getElementById('investigation-input') as HTMLInputElement
                          const value = input.value.trim()
                          if (value) {
                            addInvestigation(value)
                            input.value = ''
                          }
                        }}>
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Referrals */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Referrals</Label>
                      <Textarea
                        placeholder="Specialist referrals or additional services required..."
                        value={clinicalNotes.referrals}
                        onChange={(e) => updateClinicalNotes("referrals", e.target.value)}
                        rows={2}
                      />
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowReferral(true)}>
                          Create Formal Referral
                        </Button>
                      </div>
                    </div>

                    {/* Follow-up */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={clinicalNotes.followUpRequired}
                          onCheckedChange={(v) => updateClinicalNotes("followUpRequired", Boolean(v) as any)}
                        />
                        <span className="text-sm font-medium">Follow-up required</span>
                      </label>
                      
                      {clinicalNotes.followUpRequired && (
                        <div className="grid grid-cols-2 gap-2 ml-6">
                          <div>
                            <Label className="text-xs">Follow-up date</Label>
                            <Input
                              type="date"
                              value={clinicalNotes.followUpDate}
                              onChange={(e) => updateClinicalNotes("followUpDate", e.target.value as any)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Instructions</Label>
                            <Input
                              placeholder="Follow-up instructions"
                              onChange={(e) => updateClinicalNotes("treatmentPlan", 
                                clinicalNotes.treatmentPlan + `\nFollow-up: ${e.target.value}`
                              )}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="review" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" />
                      Consultation Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Comprehensive Summary Display */}
                    <div className="space-y-4 p-4 bg-muted rounded-lg">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Diagnosis:
                        </h4>
                        <p className="text-sm mt-1">{clinicalNotes.doctorDiagnosis || 'Not specified'}</p>
                        {clinicalNotes.icd10Codes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ICD-10 Codes: {clinicalNotes.icd10Codes}
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Treatment Plan:
                        </h4>
                        <p className="text-sm mt-1">{clinicalNotes.treatmentPlan || 'Not specified'}</p>
                      </div>
                      
                      {medications.length > 0 && (
                        <div>
                          <h4 className="font-medium">Medications:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            {medications.map((med, index) => (
                              <div key={index} className="text-sm p-2 bg-white rounded border">
                                <span className="font-medium">{med.name}</span> {med.dosage} {med.frequency} for {med.duration}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {investigations.length > 0 && (
                        <div>
                          <h4 className="font-medium">Investigations:</h4>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {investigations.map((inv, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {inv}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {clinicalNotes.followUpRequired && (
                        <div>
                          <h4 className="font-medium text-blue-600">Follow-up Required:</h4>
                          <p className="text-sm">{clinicalNotes.followUpDate ? `Scheduled for ${clinicalNotes.followUpDate}` : 'Date to be arranged'}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline">Save Draft</Button>
                      <Button onClick={completeCurrentStep}>
                        Complete Consultation
                        <CheckCircle className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
                  <span className="ml-2">{vitalSigns.bloodPressureSystolic && vitalSigns.bloodPressureDiastolic ? `${vitalSigns.bloodPressureSystolic}/${vitalSigns.bloodPressureDiastolic}` : 'â€”'}</span>
                </div>
                <div>
                  <span className="font-medium">Pulse:</span>
                  <span className="ml-2">{vitalSigns.pulse || 'â€”'} bpm</span>
                </div>
                <div>
                  <span className="font-medium">Temp:</span>
                  <span className="ml-2">{vitalSigns.temperature || 'â€”'} Â°C</span>
                </div>
              </div>

              {/* Key clinical summary */}
              <div className="mt-4 space-y-1">
                <div className="text-sm"><span className="font-medium">Nursing:</span> {clinicalNotes.nursingAssessment || 'â€”'}</div>
                <div className="text-sm"><span className="font-medium">Diagnosis:</span> {clinicalNotes.doctorDiagnosis || 'â€”'}</div>
                <div className="text-sm"><span className="font-medium">Medications:</span> {medications.length > 0 ? medications.map(m => m.name).join(', ') : 'â€”'}</div>
                <div className="text-sm"><span className="font-medium">Counseling:</span> {clinicalNotes.counselingNotes || 'â€”'}</div>
              </div>

              {/* Referrals summary */}
              {clinicalSummary.referrals.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-1">Referrals</div>
                  <ul className="text-sm list-disc ml-5 space-y-1">
                    {clinicalSummary.referrals.map((r: any) => (
                      <li key={r.id}>
                        {r.referral_type} - {r.reason} ({r.status}){r.appointment_date ? ` â€¢ ${r.appointment_date}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Completion checklist */}
              <div className="mt-4 text-sm space-y-1">
                {(() => {
                  const hasVitals = workflowSteps.find((s) => s.id === 'nursing')?.status === 'completed'
                  const hasDoctorNote = workflowSteps.find((s) => s.id === 'doctor')?.status === 'completed'
                  const hasCounseling = workflowSteps.find((s) => s.id === 'counseling')?.status === 'completed'
                  const items = [
                    { ok: hasVitals, label: 'Vital signs recorded' },
                    { ok: hasDoctorNote, label: 'Doctor consultation completed' },
                    { ok: hasCounseling, label: 'Counseling session completed' },
                  ]
                  return (
                    <ul className="list-disc ml-5">
                      {items.map((it, idx) => (
                        <li key={idx} className={it.ok ? 'text-green-700' : 'text-red-700'}>
                          {it.label} {it.ok ? 'âœ“' : 'âœ—'}
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
    <Card className="w-full max-w-5xl mx-auto">
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
                        <Button
                          onClick={completeCurrentStep}
                          disabled={!closureReady || completingStep}
                        >
                          {completingStep ? "Completing..." : `Complete ${step.title}`}
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