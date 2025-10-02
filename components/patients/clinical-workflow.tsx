"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  AlertTriangle, 
  Stethoscope,
  Eye,
  Plus,
  Heart,
  Activity,
  Brain,
  Search
} from "lucide-react"

// ==================== TYPES ====================
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
  counselingNotes: string
  mentalHealthScreening: string
  icd10Codes: string
  referrals: string
  followUpRequired: boolean
  followUpDate: string
  finalNotes: string
}

interface Medication {
  name: string
  dosage: string
  frequency: string
  duration: string
}

interface WorkflowStep {
  id: 'registration' | 'nursing' | 'doctor' | 'counseling' | 'closure'
  title: string
  description: string
  status: 'pending' | 'in-progress' | 'completed'
  role: string
  icon: any
  completedBy?: string
  completedAt?: string
}

interface SmartSuggestion {
  type: 'icd10' | 'medication'
  text: string
  code?: string
  confidence: number
}

interface ClinicalWorkflowProps {
  patientId: string
  patientName: string
  userRole: string
  username: string
  apiService: any
  offlineManager?: any
  onWorkflowComplete: () => void
}

// ==================== COMPONENT ====================
export default function ClinicalWorkflow({
  patientId,
  patientName,
  userRole,
  username,
  apiService,
  offlineManager,
  onWorkflowComplete
}: ClinicalWorkflowProps) {
  const { toast } = useToast()
  
  // ==================== STATE ====================
  const [currentStep, setCurrentStep] = useState(0)
  const [visitId, setVisitId] = useState<number | null>(null)
  const [completingStep, setCompletingStep] = useState(false)
  const [savingVitals, setSavingVitals] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [activeInput, setActiveInput] = useState<string>('')
  
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({
    bloodPressureSystolic: "",
    bloodPressureDiastolic: "",
    temperature: "",
    weight: "",
    height: "",
    pulse: "",
    respiratoryRate: "",
    oxygenSaturation: ""
  })

  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotes>({
    nursingAssessment: "",
    doctorDiagnosis: "",
    treatmentPlan: "",
    prescriptions: "",
    counselingNotes: "",
    mentalHealthScreening: "",
    icd10Codes: "",
    referrals: "",
    followUpRequired: false,
    followUpDate: "",
    finalNotes: ""
  })

  const [medications, setMedications] = useState<Medication[]>([])
  const [investigations, setInvestigations] = useState<string[]>([])
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([])
  const [clinicalSummary, setClinicalSummary] = useState<any>({ notes: [], referrals: [] })

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([
    {
      id: 'registration',
      title: 'Registration',
      description: 'Patient check-in',
      status: 'completed',
      role: 'receptionist',
      icon: CheckCircle
    },
    {
      id: 'nursing',
      title: 'Nursing Assessment',
      description: 'Vital signs & triage',
      status: 'in-progress',
      role: 'nurse',
      icon: Stethoscope
    },
    {
      id: 'doctor',
      title: 'Doctor Consultation',
      description: 'Diagnosis & treatment',
      status: 'pending',
      role: 'doctor',
      icon: Eye
    },
    {
      id: 'counseling',
      title: 'Counseling',
      description: 'Mental health support',
      status: 'pending',
      role: 'counselor',
      icon: Heart
    },
    {
      id: 'closure',
      title: 'File Closure',
      description: 'Complete visit',
      status: 'pending',
      role: 'administrator',
      icon: CheckCircle
    }
  ])

  // ==================== HELPER FUNCTIONS ====================
  const canAccessStep = (step: WorkflowStep) => {
    if (userRole === "administrator") return true
    if (step.status === "completed") return true
    if (step.id === 'closure') {
      const counselingDone = workflowSteps.find((s) => s.id === 'counseling')?.status === 'completed'
      return step.role === userRole && counselingDone
    }
    return step.role === userRole
  }

  const updateVitalSigns = (field: keyof VitalSigns, value: string) => {
    setVitalSigns((prev) => ({ ...prev, [field]: value }))
  }

  const updateClinicalNotes = (field: keyof ClinicalNotes, value: string | boolean) => {
    setClinicalNotes((prev) => ({ ...prev, [field]: value }))
  }

  // ==================== MEDICATION MANAGEMENT ====================
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

  // ==================== SMART TEXT ANALYSIS ====================
  const analyzeText = useCallback((text: string, context: string) => {
    const suggestions: SmartSuggestion[] = []
    const textLower = text.toLowerCase()
    
    if (context === 'diagnosis') {
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
    }
    
    if (context === 'treatment') {
      if (textLower.includes('pain') || textLower.includes('analgesic')) {
        suggestions.push({
          type: 'medication',
          text: 'Paracetamol 500mg TDS',
          confidence: 0.8
        })
      }
    }
    
    setSmartSuggestions(suggestions)
  }, [])

  const applySuggestion = (suggestion: SmartSuggestion) => {
    switch (suggestion.type) {
      case 'icd10':
        if (suggestion.code && !clinicalNotes.icd10Codes.includes(suggestion.code)) {
          const existingCodes = clinicalNotes.icd10Codes ? clinicalNotes.icd10Codes + ', ' : ''
          updateClinicalNotes('icd10Codes', existingCodes + suggestion.code)
        }
        break
      case 'medication':
        const [name] = suggestion.text.split(' ')
        addQuickMedication(name.toLowerCase())
        break
    }
    setSmartSuggestions([])
  }

  // ==================== COMPLETE STEP ====================
  const completeCurrentStep = async () => {
    if (completingStep) return
    setCompletingStep(true)
    
    try {
      const updatedSteps = [...workflowSteps]
      const currentStepData = updatedSteps[currentStep]
      if (!currentStepData || !canAccessStep(currentStepData)) return

      let vId = visitId
      if (!vId) {
        const created = await apiService.createVisit(Number(patientId), {})
        if (!created.success || !created.data?.visit_id) {
          toast({ 
            title: 'Failed to start visit', 
            description: created.error || 'Unable to create a visit record.',
            variant: 'destructive' 
          })
          return
        }
        vId = created.data.visit_id
        setVisitId(vId)
      }

      // Save step-specific data
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
            toast({ 
              title: 'Nothing to save', 
              description: 'Add a Diagnosis and/or Treatment before saving.',
              variant: 'destructive' 
            })
            return
          }

          if (diagContent) {
            const resDiag = await apiService.createClinicalNote(vId, {
              note_type: 'Diagnosis',
              content: diagContent,
              icd10_codes: parseList(clinicalNotes.icd10Codes),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resDiag.success) saved = false
          }

          if (treatContent) {
            const resTreat = await apiService.createClinicalNote(vId, {
              note_type: 'Treatment',
              content: treatContent,
              medications_prescribed: medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resTreat.success) saved = false
          }
        } else if (currentStepData.id === 'counseling') {
          const content = [
            clinicalNotes.mentalHealthScreening && `Screening: ${clinicalNotes.mentalHealthScreening}`,
            clinicalNotes.counselingNotes && `Notes: ${clinicalNotes.counselingNotes}`,
          ].filter(Boolean).join('\n') || 'Counseling session completed.'
          
          const res = await apiService.createClinicalNote(vId, {
            note_type: 'Counseling',
            content,
            follow_up_required: !!clinicalNotes.followUpRequired,
            follow_up_date: clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
          })
          saved = !!res.success
        } else if (currentStepData.id === 'closure') {
          const content = clinicalNotes.finalNotes?.trim() || 'File closed.'
          const res = await apiService.createClinicalNote(vId, { note_type: 'Closure', content })
          saved = !!res.success
        }
        
        if (!saved) {
          toast({ 
            title: 'Save failed', 
            description: 'Could not save note. Please try again.',
            variant: 'destructive' 
          })
          return
        }
      } catch (e) {
        toast({ 
          title: 'Network error', 
          description: 'Failed to reach server. Please try again.',
          variant: 'destructive' 
        })
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
    } finally {
      setCompletingStep(false)
    }
  }

  // ==================== SAVE VITALS ====================
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
      toast({ 
        title: "No data to save", 
        description: "Enter at least one vital sign or note.",
        variant: "destructive" 
      })
      return
    }

    try {
      setSavingVitals(true)
      
      let vId = visitId
      if (!vId) {
        const created = await apiService.createVisit(Number(patientId), {})
        if (!created.success || !created.data?.visit_id) {
          toast({ 
            title: "Failed to start visit", 
            description: created.error || "Could not create visit.",
            variant: "destructive" 
          })
          return
        }
        vId = created.data.visit_id
        setVisitId(vId)
      }

      const res = await apiService.addVitalSigns(vId, payload)
      if (!res.success) {
        toast({ 
          title: "Save failed", 
          description: res.error || "Could not save vital signs.",
          variant: "destructive" 
        })
        return
      }

      toast({ title: "Vital signs saved" })
      completeCurrentStep()
    } catch (e: any) {
      toast({ 
        title: "Error", 
        description: e?.message || String(e),
        variant: "destructive" 
      })
    } finally {
      setSavingVitals(false)
    }
  }

  // ==================== LOAD INITIAL DATA ====================
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const latest = await apiService.getLatestVisit(Number(patientId))
        if (latest.success && latest.data?.id) {
          const vId = latest.data.id
          setVisitId(vId)

          const vitals = await apiService.getVisitVitals(vId)
          if (vitals.success && vitals.data && vitals.data.count > 0) {
            const latestV = vitals.data.latest as any
            if (latestV) {
              setVitalSigns({
                bloodPressureSystolic: latestV.systolic_bp != null ? String(latestV.systolic_bp) : "",
                bloodPressureDiastolic: latestV.diastolic_bp != null ? String(latestV.diastolic_bp) : "",
                temperature: latestV.temperature != null ? String(latestV.temperature) : "",
                weight: latestV.weight != null ? String(latestV.weight) : "",
                height: latestV.height != null ? String(latestV.height) : "",
                pulse: latestV.heart_rate != null ? String(latestV.heart_rate) : "",
                respiratoryRate: "",
                oxygenSaturation: latestV.oxygen_saturation != null ? String(latestV.oxygen_saturation) : "",
              })
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync from server:', error)
      }
    }
    syncFromServer()
  }, [patientId, apiService])

  // ==================== RENDER STEP CONTENT ====================
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea
                placeholder="Enter diagnosis..."
                value={clinicalNotes.doctorDiagnosis}
                onChange={(e) => {
                  updateClinicalNotes("doctorDiagnosis", e.target.value)
                  analyzeText(e.target.value, 'diagnosis')
                }}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>ICD-10 Codes</Label>
              <Input
                placeholder="Enter ICD-10 codes (comma-separated)"
                value={clinicalNotes.icd10Codes}
                onChange={(e) => updateClinicalNotes("icd10Codes", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Treatment Plan</Label>
              <Textarea
                placeholder="Enter treatment plan..."
                value={clinicalNotes.treatmentPlan}
                onChange={(e) => {
                  updateClinicalNotes("treatmentPlan", e.target.value)
                  analyzeText(e.target.value, 'treatment')
                }}
                rows={4}
              />
            </div>
            
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

            <div className="space-y-2">
              <Label>Quick Medications</Label>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addQuickMedication('paracetamol')}>
                  + Paracetamol
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuickMedication('ibuprofen')}>
                  + Ibuprofen
                </Button>
                <Button size="sm" variant="outline" onClick={() => addQuickMedication('amoxicillin')}>
                  + Amoxicillin
                </Button>
              </div>
            </div>

            {medications.length > 0 && (
              <div className="space-y-2">
                <Label>Prescribed Medications</Label>
                <div className="space-y-2">
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">
                        {med.name} - {med.dosage} {med.frequency} for {med.duration}
                      </span>
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
              </div>
            )}
          </div>
        )

      case "counseling":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mental Health Screening</Label>
              <Textarea
                placeholder="Record mental health assessment..."
                value={clinicalNotes.mentalHealthScreening}
                onChange={(e) => updateClinicalNotes("mentalHealthScreening", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Counseling Notes</Label>
              <Textarea
                placeholder="Document counseling session..."
                value={clinicalNotes.counselingNotes}
                onChange={(e) => updateClinicalNotes("counselingNotes", e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="follow-up"
                checked={clinicalNotes.followUpRequired}
                onCheckedChange={(checked) => updateClinicalNotes("followUpRequired", !!checked)}
              />
              <Label htmlFor="follow-up">Follow-up required</Label>
            </div>
            {clinicalNotes.followUpRequired && (
              <div className="space-y-2">
                <Label>Follow-up Date</Label>
                <Input
                  type="date"
                  value={clinicalNotes.followUpDate}
                  onChange={(e) => updateClinicalNotes("followUpDate", e.target.value)}
                />
              </div>
            )}
          </div>
        )

      case "closure":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Patient Summary</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Review all clinical data before closing the patient file.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="font-medium">BP:</span>
                  <span className="ml-2">
                    {vitalSigns.bloodPressureSystolic && vitalSigns.bloodPressureDiastolic 
                      ? `${vitalSigns.bloodPressureSystolic}/${vitalSigns.bloodPressureDiastolic}` 
                      : '—'}
                  </span>
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
              <div className="mt-4 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Diagnosis:</span> {clinicalNotes.doctorDiagnosis || '—'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Medications:</span>{' '}
                  {medications.length > 0 ? medications.map(m => m.name).join(', ') : '—'}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Counseling:</span> {clinicalNotes.counselingNotes || '—'}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Final Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={clinicalNotes.finalNotes}
                onChange={(e) => updateClinicalNotes("finalNotes", e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )

      default:
        return <div>Step content not available</div>
    }
  }

  // ==================== RENDER ====================
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
                  {index < workflowSteps.length - 1 && (
                    <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {workflowSteps.map((step) => (
              <Badge
                key={step.id}
                variant={
                  step.status === "completed" 
                    ? "default" 
                    : step.status === "in-progress" 
                      ? "secondary" 
                      : "outline"
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
                <div className="mt-6 flex justify-end">
                  <Button onClick={completeCurrentStep} disabled={completingStep}>
                    {completingStep ? "Completing..." : `Complete ${step.title}`}
                    <CheckCircle className="w-4 h-4 ml-2" />
                  </Button>
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
      </CardContent>
    </Card>
  )
}