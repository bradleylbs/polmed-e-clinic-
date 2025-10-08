"use client"

import type React from "react"

import { useEffect, useState, useCallback, useRef } from "react"
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
import {
  UserCheck,
  Heart,
  Stethoscope,
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  Search,
  Plus,
  AlertTriangle,
  Activity,
  Brain,
  Eye,
  Pill,
  Sparkles,
  X,
  ChevronRight,
  Zap,
  Target,
  Clipboard,
} from "lucide-react"
import { ReferralModal } from "./referral-modal"
import { apiService } from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/components/ui/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
  severity: "normal" | "caution" | "critical"
  reference: string
}

interface SmartSuggestion {
  type: "icd10" | "medication" | "investigation"
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
  const [activeInput, setActiveInput] = useState<string>("")

  // Summary data for File Closure
  const [clinicalSummary, setClinicalSummary] = useState<{ notes: any[]; referrals: any[] }>({
    notes: [],
    referrals: [],
  })

  const [icd10SearchOpen, setIcd10SearchOpen] = useState(false)
  const [icd10SearchQuery, setIcd10SearchQuery] = useState("")
  const [icd10SearchResults, setIcd10SearchResults] = useState<any[]>([])
  const [icd10SearchLoading, setIcd10SearchLoading] = useState(false)
  const [selectedICD10Codes, setSelectedICD10Codes] = useState<Array<{ code: string; description: string }>>([])
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

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
      const severity =
        systolic >= 140 || diastolic >= 90 ? "critical" : systolic >= 130 || diastolic >= 80 ? "caution" : "normal"
      alerts.push({
        parameter: "Blood Pressure",
        value: `${systolic}/${diastolic} mmHg`,
        severity,
        reference: "<130/80 mmHg",
      })
    }

    // Temperature Alert
    const temp = Number(vitalSigns.temperature)
    if (temp) {
      const severity = temp >= 38.5 ? "critical" : temp >= 37.5 ? "caution" : "normal"
      alerts.push({
        parameter: "Temperature",
        value: `${temp}°C`,
        severity,
        reference: "36.1-37.2°C",
      })
    }

    // Heart Rate Alert
    const hr = Number(vitalSigns.pulse)
    if (hr) {
      const severity = hr > 100 || hr < 60 ? "caution" : "normal"
      alerts.push({
        parameter: "Heart Rate",
        value: `${hr} bpm`,
        severity,
        reference: "60-100 bpm",
      })
    }

    // Oxygen Saturation Alert
    const spo2 = Number(vitalSigns.oxygenSaturation)
    if (spo2) {
      const severity = spo2 < 95 ? "critical" : spo2 < 98 ? "caution" : "normal"
      alerts.push({
        parameter: "SpO2",
        value: `${spo2}%`,
        severity,
        reference: "≥95%",
      })
    }

    return alerts
  }

  // Smart text analysis for suggestions
  const analyzeText = useCallback((text: string, context: string) => {
    const suggestions: SmartSuggestion[] = []
    const textLower = text.toLowerCase()

    if (context === "diagnosis") {
      // Common diagnosis suggestions
      if (textLower.includes("hypertension") || textLower.includes("high blood pressure")) {
        suggestions.push({
          type: "icd10",
          text: "Essential hypertension",
          code: "I10",
          confidence: 0.95,
        })
      }
      if (textLower.includes("diabetes") || textLower.includes("sugar")) {
        suggestions.push({
          type: "icd10",
          text: "Type 2 diabetes mellitus",
          code: "E11.9",
          confidence: 0.9,
        })
      }
      if (textLower.includes("headache") || textLower.includes("cephalgia")) {
        suggestions.push({
          type: "icd10",
          text: "Headache",
          code: "R51",
          confidence: 0.85,
        })
      }
      if (textLower.includes("chest pain") || textLower.includes("angina")) {
        suggestions.push({
          type: "icd10",
          text: "Chest pain, unspecified",
          code: "R07.9",
          confidence: 0.8,
        })
      }
    }

    if (context === "treatment") {
      // Medication suggestions
      if (textLower.includes("pain") || textLower.includes("analgesic")) {
        suggestions.push({
          type: "medication",
          text: "Paracetamol 500mg TDS",
          confidence: 0.8,
        })
      }
      if (textLower.includes("infection") || textLower.includes("antibiotic")) {
        suggestions.push({
          type: "medication",
          text: "Amoxicillin 500mg TDS",
          confidence: 0.75,
        })
      }
      if (textLower.includes("hypertension") || textLower.includes("blood pressure")) {
        suggestions.push({
          type: "medication",
          text: "Amlodipine 5mg OD",
          confidence: 0.85,
        })
      }
    }

    setSmartSuggestions(suggestions)
  }, [])

  const searchICD10 = useCallback(async (query: string) => {
    if (query.length < 2) {
      setIcd10SearchResults([])
      return
    }

    setIcd10SearchLoading(true)
    try {
      // Enhanced search with more results and better filtering
      const response = await apiService.searchICD10(query, 25)
      if (response.success && response.data) {
        // Filter out already selected codes and sort by relevance
        const filteredResults = response.data
          .filter(result => !selectedICD10Codes.find(selected => selected.code === result.code))
          .sort((a, b) => {
            // Prioritize exact code matches
            if (a.code.toLowerCase().startsWith(query.toLowerCase()) && !b.code.toLowerCase().startsWith(query.toLowerCase())) return -1
            if (b.code.toLowerCase().startsWith(query.toLowerCase()) && !a.code.toLowerCase().startsWith(query.toLowerCase())) return 1
            
            // Prioritize common codes
            if (a.is_common && !b.is_common) return -1
            if (b.is_common && !a.is_common) return 1
            
            // Sort by description relevance
            const aRelevance = a.description.toLowerCase().indexOf(query.toLowerCase())
            const bRelevance = b.description.toLowerCase().indexOf(query.toLowerCase())
            if (aRelevance !== -1 && bRelevance === -1) return -1
            if (bRelevance !== -1 && aRelevance === -1) return 1
            
            return 0
          })
        
        setIcd10SearchResults(filteredResults)
      }
    } catch (error) {
      console.error("ICD-10 search error:", error)
      toast({
        title: "Search Error",
        description: "Failed to search ICD-10 codes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIcd10SearchLoading(false)
    }
  }, [selectedICD10Codes, toast])

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (icd10SearchQuery.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchICD10(icd10SearchQuery)
      }, 300)
    } else {
      setIcd10SearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [icd10SearchQuery, searchICD10])

  const addICD10Code = (code: string, description: string) => {
    if (!selectedICD10Codes.find((c) => c.code === code)) {
      const newCodes = [...selectedICD10Codes, { code, description }]
      setSelectedICD10Codes(newCodes)
      updateClinicalNotes("icd10Codes", newCodes.map((c) => c.code).join(", "))
      
      // Enhanced feedback for successful selection
      toast({
        title: "ICD-10 Code Added",
        description: `${code}: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`,
        duration: 2000,
      })
      
      // Keep search open for multiple selections, but clear query
      setIcd10SearchQuery("")
    } else {
      // Provide feedback if code already selected
      toast({
        title: "Code Already Selected",
        description: `${code} is already in your diagnosis list.`,
        variant: "destructive",
        duration: 2000,
      })
    }
  }

  // Enhanced function for bulk code selection
  const addMultipleICD10Codes = (codes: Array<{ code: string, description: string }>) => {
    const newCodes = codes.filter(newCode => 
      !selectedICD10Codes.find(existing => existing.code === newCode.code)
    )
    
    if (newCodes.length > 0) {
      const updatedCodes = [...selectedICD10Codes, ...newCodes]
      setSelectedICD10Codes(updatedCodes)
      updateClinicalNotes("icd10Codes", updatedCodes.map((c) => c.code).join(", "))
      
      toast({
        title: `${newCodes.length} ICD-10 Codes Added`,
        description: newCodes.map(c => c.code).join(", "),
        duration: 3000,
      })
    }
  }

  const removeICD10Code = (code: string) => {
    const newCodes = selectedICD10Codes.filter((c) => c.code !== code)
    setSelectedICD10Codes(newCodes)
    updateClinicalNotes("icd10Codes", newCodes.map((c) => c.code).join(", "))
  }

  const canAccessStep = (step: WorkflowStep) => {
    if (userRole === "administrator") return true
    if (step.status === "completed") return true
    if (step.id === "closure") {
      const counselingDone = workflowSteps.find((s) => s.id === "counseling")?.status === "completed"
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
        if (currentStepData.id === "doctor") {
          const parseList = (s?: string) =>
            (s || "")
              .split(",")
              .map((x) => x.trim())
              .filter((x) => x.length > 0)

          const diagContent = [
            clinicalNotes.icd10Codes && `ICD-10: ${clinicalNotes.icd10Codes}`,
            clinicalNotes.doctorDiagnosis && `Diagnosis: ${clinicalNotes.doctorDiagnosis}`,
          ]
            .filter(Boolean)
            .join("\n")

          const treatContent = [
            clinicalNotes.treatmentPlan && `Treatment: ${clinicalNotes.treatmentPlan}`,
            medications.length > 0 &&
              `Medications: ${medications.map((m) => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`).join(", ")}`,
            investigations.length > 0 && `Investigations: ${investigations.join(", ")}`,
            clinicalNotes.referrals && `Referrals: ${clinicalNotes.referrals}`,
          ]
            .filter(Boolean)
            .join("\n")

          if (!diagContent && !treatContent) {
            toast({
              title: "Nothing to save",
              description: "Add a Diagnosis and/or Treatment before saving.",
              variant: "destructive",
            })
            return
          }

          // Save Diagnosis note if provided
          if (diagContent) {
            const resDiag = await apiService.createClinicalNote(vId!, {
              note_type: "Diagnosis",
              content: diagContent,
              icd10_codes: parseList(clinicalNotes.icd10Codes),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date:
                clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resDiag.success) {
              saved = false
            }
          }

          // Save Treatment note if provided
          if (treatContent) {
            const resTreat = await apiService.createClinicalNote(vId!, {
              note_type: "Treatment",
              content: treatContent,
              medications_prescribed: medications.map((m) => `${m.name} ${m.dosage} ${m.frequency}`),
              follow_up_required: !!clinicalNotes.followUpRequired,
              follow_up_date:
                clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
            })
            if (!resTreat.success) {
              saved = false
            }
          }
        } else if (currentStepData.id === "counseling") {
          const content =
            [
              clinicalNotes.mentalHealthScreening && `Screening: ${clinicalNotes.mentalHealthScreening}`,
              clinicalNotes.counselingNotes && `Notes: ${clinicalNotes.counselingNotes}`,
            ]
              .filter(Boolean)
              .join("\n") || "Counseling session completed."
          const res = await apiService.createClinicalNote(vId!, {
            note_type: "Counseling",
            content,
            follow_up_required: !!clinicalNotes.followUpRequired,
            follow_up_date:
              clinicalNotes.followUpRequired && clinicalNotes.followUpDate ? clinicalNotes.followUpDate : undefined,
          })
          saved = !!res.success
        } else if (currentStepData.id === "closure") {
          const content = clinicalNotes.finalNotes?.trim() || "File closed."
          const res = await apiService.createClinicalNote(vId!, { note_type: "Closure", content })
          saved = !!res.success
        }
        if (!saved) {
          toast({ title: "Save failed", description: "Could not save note. Please try again.", variant: "destructive" })
          return
        }
      } catch (e) {
        toast({
          title: "Network error",
          description: "Failed to reach server. Please try again.",
          variant: "destructive",
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
        const counselingDone = updatedSteps.find((s) => s.id === "counseling")?.status === "completed"
        const canUnlockNext = nextStep.id !== "closure" || counselingDone

        if (canUnlockNext && nextStep.status !== "completed") {
          updatedSteps[nextIdx] = { ...nextStep, status: "in-progress" }
        }

        if (canUnlockNext) {
          const canViewNext = userRole === "administrator" || nextStep.role === userRole
          if (canViewNext) {
            setCurrentStep(nextIdx)
          } else {
            const nextRoleLabel = nextStep.role.replace(/_/g, " ")
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
        toast({ title: "Unexpected error", description, variant: "destructive" })
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
      paracetamol: { name: "Paracetamol", dosage: "500mg", frequency: "TDS", duration: "5 days" },
      ibuprofen: { name: "Ibuprofen", dosage: "400mg", frequency: "TDS", duration: "3 days" },
      amoxicillin: { name: "Amoxicillin", dosage: "500mg", frequency: "TDS", duration: "7 days" },
      amlodipine: { name: "Amlodipine", dosage: "5mg", frequency: "OD", duration: "Ongoing" },
      metformin: { name: "Metformin", dosage: "500mg", frequency: "BD", duration: "Ongoing" },
      enalapril: { name: "Enalapril", dosage: "10mg", frequency: "BD", duration: "Ongoing" },
    }

    const medication = presets[preset]
    if (medication && !medications.find((m) => m.name === medication.name)) {
      setMedications((prev) => [...prev, medication])
    }
  }

  const addCustomMedication = (medication: Medication) => {
    if (medication.name && !medications.find((m) => m.name === medication.name)) {
      setMedications((prev) => [...prev, medication])
    }
  }

  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }

  const addInvestigation = (investigation: string) => {
    if (investigation && !investigations.includes(investigation)) {
      setInvestigations((prev) => [...prev, investigation])
    }
  }

  const removeInvestigation = (index: number) => {
    setInvestigations((prev) => prev.filter((_, i) => i !== index))
  }

  const applySuggestion = (suggestion: SmartSuggestion) => {
    switch (suggestion.type) {
      case "icd10":
        if (suggestion.code && !clinicalNotes.icd10Codes.includes(suggestion.code)) {
          const existingCodes = clinicalNotes.icd10Codes ? clinicalNotes.icd10Codes + ", " : ""
          updateClinicalNotes("icd10Codes", existingCodes + suggestion.code)
        }
        break
      case "medication":
        const [name, ...rest] = suggestion.text.split(" ")
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
              temperature:
                latestV.temperature != null
                  ? String(latestV.temperature)
                  : lastNonNull?.temperature != null
                    ? String(lastNonNull.temperature)
                    : "",
              weight: latestV.weight != null ? String(latestV.weight) : "",
              height: latestV.height != null ? String(latestV.height) : "",
              pulse:
                latestV.heart_rate != null
                  ? String(latestV.heart_rate)
                  : lastNonNull?.heart_rate != null
                    ? String(lastNonNull.heart_rate)
                    : "",
              respiratoryRate: "",
              oxygenSaturation: latestV.oxygen_saturation != null ? String(latestV.oxygen_saturation) : "",
            })
          }
        }

        // Sync workflow from backend
        const wf = await apiService.getWorkflowStatus(vId)
        if (wf.success && Array.isArray(wf.data)) {
          const stageToId: Record<string, WorkflowStep["id"]> = {
            Registration: "registration",
            "Nursing Assessment": "nursing",
            "Doctor Consultation": "doctor",
            "Counseling Session": "counseling",
            "File Closure": "closure",
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
              return { ...s, status: "completed", completedAt: info.completedAt || s.completedAt }
            }
            return { ...s, status: "pending" }
          })

          const counselingDone = nextSteps.find((s) => s.id === "counseling")?.status === "completed"
          const firstOwnedNotCompleted = nextSteps.findIndex(
            (s) =>
              s.status !== "completed" &&
              (userRole === "administrator" || s.role === userRole) &&
              (s.id !== "closure" || counselingDone),
          )
          if (firstOwnedNotCompleted >= 0) {
            nextSteps[firstOwnedNotCompleted] = { ...nextSteps[firstOwnedNotCompleted], status: "in-progress" }
          }

          setWorkflowSteps(nextSteps)

          const firstActionableLocalIdx = nextSteps.findIndex(
            (s) => s.status !== "completed" && (userRole === "administrator" || s.role === userRole),
          )
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
          referrals: (refsRes.success && Array.isArray(refsRes.data) ? refsRes.data : []).filter(
            (r: any) => !r.visit_id || r.visit_id === vId,
          ),
        })

        // Map latest server notes into summary fields
        const latestOfType = (t: string) => {
          const arr = notes.filter((n: any) => n.note_type === t)
          arr.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          return arr[0]?.content as string | undefined
        }
        const latestAssessment = latestOfType("Assessment")
        let latestDiagnosis = latestOfType("Diagnosis")
        const latestTreatment = latestOfType("Treatment")
        const latestCounseling = latestOfType("Counseling")

        if (!latestDiagnosis && latestTreatment && typeof latestTreatment === "string") {
          const m = latestTreatment.match(/Diagnosis:\s*(.*)/i)
          if (m && m[1]) latestDiagnosis = m[1].trim()
        }

        let prescriptionsText: string | undefined
        try {
          const treatNode = (notes || []).find((n: any) => n.note_type === "Treatment")
          let meds = treatNode && treatNode.medications_prescribed
          if (typeof meds === "string") {
            try {
              const parsed = JSON.parse(meds)
              if (Array.isArray(parsed)) meds = parsed
            } catch {
              meds = meds
                .split(",")
                .map((s: string) => s.trim())
                .filter((s: string) => !!s)
            }
          }
          if (Array.isArray(meds) && meds.length) {
            prescriptionsText = meds.join(", ")
          } else if (typeof latestTreatment === "string") {
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
          toast({
            title: "Failed to start visit",
            description: created.error || "Could not create visit.",
            variant: "destructive",
          })
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
              <Button
                onClick={saveVitals}
                disabled={savingVitals || completingStep || nursingStep?.status === "completed"}
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
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-6 shadow-lg">
              <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_85%)]" />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {patientName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      ID: {patientId} •{" "}
                      {new Date().toLocaleDateString("en-ZA", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-background/50 backdrop-blur-sm border-primary/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {new Date().toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </Badge>
                </div>

                {vitalAlerts.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {vitalAlerts.map((alert, index) => (
                      <div
                        key={index}
                        className={`group relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-105 ${
                          alert.severity === "critical"
                            ? "bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 shadow-lg shadow-red-500/10"
                            : alert.severity === "caution"
                              ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                              : "bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 shadow-lg shadow-green-500/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground/80">{alert.parameter}</span>
                          {alert.severity !== "normal" && (
                            <AlertTriangle
                              className={`w-4 h-4 ${
                                alert.severity === "critical" ? "text-red-500" : "text-yellow-500"
                              }`}
                            />
                          )}
                        </div>
                        <div className="text-2xl font-bold mb-1">{alert.value}</div>
                        <div className="text-xs text-muted-foreground">Ref: {alert.reference}</div>
                      </div>
                    ))}
                  </div>
                )}

                {clinicalNotes.nursingAssessment && (
                  <div className="mt-4 p-4 rounded-xl bg-background/50 backdrop-blur-sm border border-border/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-sm">Nursing Assessment</span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{clinicalNotes.nursingAssessment}</p>
                  </div>
                )}
              </div>
            </div>

            <Tabs defaultValue="assessment" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 backdrop-blur-sm">
                <TabsTrigger
                  value="assessment"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                >
                  <Clipboard className="w-4 h-4 mr-2" />
                  Assessment
                </TabsTrigger>
                <TabsTrigger
                  value="diagnosis"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Diagnosis
                </TabsTrigger>
                <TabsTrigger
                  value="treatment"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                >
                  <Pill className="w-4 h-4 mr-2" />
                  Treatment
                </TabsTrigger>
                <TabsTrigger
                  value="review"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg transition-all"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Review
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assessment" className="space-y-4 mt-6">
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
                          analyzeText(e.target.value, "assessment")
                        }}
                        onFocus={() => setActiveInput("assessment")}
                        rows={6}
                        className="mt-1"
                      />
                    </div>

                    {/* Quick Assessment Templates */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Quick Templates</Label>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateClinicalNotes(
                              "doctorDiagnosis",
                              clinicalNotes.doctorDiagnosis + "\n• Normal cardiovascular examination",
                            )
                          }
                        >
                          <Heart className="w-3 h-3 mr-1" />
                          Normal CVS
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateClinicalNotes(
                              "doctorDiagnosis",
                              clinicalNotes.doctorDiagnosis + "\n• Clear chest on auscultation",
                            )
                          }
                        >
                          <Activity className="w-3 h-3 mr-1" />
                          Clear Chest
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateClinicalNotes(
                              "doctorDiagnosis",
                              clinicalNotes.doctorDiagnosis + "\n• Abdomen soft, non-tender",
                            )
                          }
                        >
                          Soft Abdomen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateClinicalNotes(
                              "doctorDiagnosis",
                              clinicalNotes.doctorDiagnosis + "\n• Neurologically intact",
                            )
                          }
                        >
                          <Brain className="w-3 h-3 mr-1" />
                          Normal Neuro
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnosis" className="space-y-4 mt-6">
                <Card className="border-primary/20 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Diagnosis & ICD-10 Coding
                    </CardTitle>
                    <CardDescription>Document clinical findings and assign diagnostic codes</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div>
                      <Label className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Primary Diagnosis
                      </Label>
                      <Textarea
                        placeholder="Enter primary and differential diagnoses..."
                        value={clinicalNotes.doctorDiagnosis}
                        onChange={(e) => {
                          updateClinicalNotes("doctorDiagnosis", e.target.value)
                          analyzeText(e.target.value, "diagnosis")
                        }}
                        rows={4}
                        className="mt-2 resize-none border-primary/20 focus:border-primary focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        ICD-10 Diagnostic Codes
                      </Label>

                      {/* Enhanced Selected Codes Display */}
                      {selectedICD10Codes.length > 0 && (
                        <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-foreground">
                              Selected ICD-10 Codes ({selectedICD10Codes.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedICD10Codes.map((item, index) => (
                              <Badge
                                key={index}
                                variant="secondary"
                                className="px-3 py-2 text-sm bg-white border-2 border-primary/30 hover:border-primary/60 transition-all group shadow-sm"
                              >
                                <span className="font-mono font-bold text-primary mr-2">{item.code}</span>
                                <span className="text-xs text-foreground mr-2 max-w-48 truncate" title={item.description}>
                                  {item.description}
                                </span>
                                <button
                                  onClick={() => removeICD10Code(item.code)}
                                  className="ml-1 hover:text-destructive transition-colors rounded-full hover:bg-destructive/10 p-0.5"
                                  aria-label={`Remove ${item.code} code`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Enhanced ICD-10 Search Interface */}
                      <Popover open={icd10SearchOpen} onOpenChange={setIcd10SearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="lg"
                            className="w-full justify-between text-left font-normal border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 bg-gradient-to-r from-primary/5 to-transparent transition-all duration-200 h-auto py-3"
                          >
                            <div className="flex items-center">
                              <Search className="mr-3 h-5 w-5 text-primary" />
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium text-foreground">Search & Add ICD-10 Codes</span>
                                <span className="text-xs text-muted-foreground">Type to search database • Press Enter to select</span>
                              </div>
                            </div>
                            {selectedICD10Codes.length > 0 && (
                              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                                {selectedICD10Codes.length} selected
                              </Badge>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[600px] p-0 shadow-xl border-2" align="start">
                          <div className="border-b bg-muted/30 p-3">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Target className="w-4 h-4" />
                              ICD-10-CM Code Search
                              {icd10SearchResults.length > 0 && (
                                <Badge variant="outline" className="ml-auto text-xs">
                                  {icd10SearchResults.length} results
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Command>
                            <CommandInput
                              placeholder="Type to search... (e.g., 'diabetes', 'hypertension', 'E11.9')"
                              value={icd10SearchQuery}
                              onValueChange={setIcd10SearchQuery}
                              className="border-0 focus:ring-0 text-base"
                            />
                            <CommandList className="max-h-96">
                              {icd10SearchLoading && (
                                <div className="p-6 text-center">
                                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    Searching ICD-10 database...
                                  </div>
                                </div>
                              )}
                              
                              {!icd10SearchLoading && icd10SearchQuery.length < 2 && (
                                <div className="p-6 text-center">
                                  <Brain className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                                  <p className="text-sm text-muted-foreground mb-1">Start typing to search ICD-10 codes</p>
                                  <p className="text-xs text-muted-foreground">Search by code, condition, or symptoms</p>
                                </div>
                              )}

                              {!icd10SearchLoading &&
                                icd10SearchQuery.length >= 2 &&
                                icd10SearchResults.length === 0 && (
                                  <div className="p-6 text-center">
                                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                                    <p className="text-sm font-medium mb-1">No ICD-10 codes found</p>
                                    <p className="text-xs text-muted-foreground">Try different keywords or check spelling</p>
                                  </div>
                                )}

                              {!icd10SearchLoading && icd10SearchResults.length > 0 && (
                                <CommandGroup heading={`${icd10SearchResults.length} ICD-10 Codes Found`}>
                                  {icd10SearchResults.map((result, index) => {
                                    const isAlreadySelected = selectedICD10Codes.find(c => c.code === result.code)
                                    return (
                                      <CommandItem
                                        key={result.code}
                                        onSelect={() => addICD10Code(result.code, result.description)}
                                        className={`flex items-start gap-3 p-4 cursor-pointer border-b border-border/50 last:border-0 transition-all duration-200 ${
                                          isAlreadySelected 
                                            ? 'bg-green-50 hover:bg-green-100 border-green-200' 
                                            : 'hover:bg-primary/5 hover:border-primary/20'
                                        }`}
                                        disabled={!!isAlreadySelected}
                                      >
                                        <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 transition-colors ${
                                          isAlreadySelected ? 'bg-green-500' : 'bg-primary/60'
                                        }`} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge 
                                              variant="outline" 
                                              className={`font-mono text-sm font-bold px-2 py-1 ${
                                                isAlreadySelected 
                                                  ? 'bg-green-100 border-green-300 text-green-800' 
                                                  : 'bg-primary/10 border-primary/30 text-primary'
                                              }`}
                                            >
                                              {result.code}
                                            </Badge>
                                            {result.is_common && (
                                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                                                <Sparkles className="w-3 h-3 mr-1" />
                                                Common
                                              </Badge>
                                            )}
                                            <Badge variant="outline" className="text-xs text-muted-foreground">
                                              #{index + 1}
                                            </Badge>
                                            {isAlreadySelected && (
                                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Selected
                                              </Badge>
                                            )}
                                          </div>
                                          <p className={`text-sm font-semibold leading-tight mb-1 ${
                                            isAlreadySelected ? 'text-green-800' : 'text-foreground'
                                          }`}>
                                            {result.description}
                                          </p>
                                          {result.category && (
                                            <p className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                                              Category: {result.category}
                                            </p>
                                          )}
                                        </div>
                                        <div className="flex-shrink-0 flex items-center">
                                          {isAlreadySelected ? (
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                          ) : (
                                            <Plus className="w-4 h-4 text-primary hover:text-primary/80" />
                                          )}
                                        </div>
                                      </CommandItem>
                                    )
                                  })}
                                </CommandGroup>
                              )}
                            </CommandList>
                          </Command>
                          
                          {icd10SearchResults.length > 0 && (
                            <div className="border-t bg-muted/20 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  Click any code to add it to diagnosis
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">↑↓</kbd>
                                  <span>Navigate</span>
                                  <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Enter</kbd>
                                  <span>Select</span>
                                  <kbd className="px-1 py-0.5 bg-muted rounded border text-xs">Esc</kbd>
                                  <span>Close</span>
                                </div>
                              </div>
                              {selectedICD10Codes.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-green-600">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>{selectedICD10Codes.length} code(s) selected • Search continues for more</span>
                                </div>
                              )}
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>

                      {/* Enhanced Quick Access and Management */}
                      {!icd10SearchOpen && (
                        <div className="mt-3 space-y-3">
                          {/* Quick Access - Always shown when search is closed */}
                          <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Quick Access - Common ICD-10 Codes:
                              </p>
                              {selectedICD10Codes.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedICD10Codes([])
                                    updateClinicalNotes("icd10Codes", "")
                                    toast({
                                      title: "Codes Cleared",
                                      description: "All ICD-10 codes have been removed.",
                                    })
                                  }}
                                  className="text-xs h-6 px-2 text-muted-foreground hover:text-destructive"
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Clear All
                                </Button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {[
                                { code: "Z00.00", desc: "General adult medical examination" },
                                { code: "I10", desc: "Essential hypertension" },
                                { code: "E11.9", desc: "Type 2 diabetes mellitus without complications" }, 
                                { code: "J06.9", desc: "Acute upper respiratory infection, unspecified" },
                                { code: "M79.3", desc: "Panniculitis, unspecified" },
                                { code: "R50.9", desc: "Fever, unspecified" },
                                { code: "K59.00", desc: "Constipation, unspecified" },
                                { code: "R06.02", desc: "Shortness of breath" }
                              ].map((item) => {
                                const isSelected = selectedICD10Codes.find(c => c.code === item.code)
                                return (
                                  <Button
                                    key={item.code}
                                    variant={isSelected ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => addICD10Code(item.code, item.desc)}
                                    disabled={!!isSelected}
                                    className={`text-xs h-7 px-2 font-mono transition-all ${
                                      isSelected 
                                        ? 'bg-green-100 text-green-700 border-green-200 cursor-not-allowed' 
                                        : 'hover:bg-primary/10 border border-transparent hover:border-primary/20'
                                    }`}
                                    title={item.desc}
                                  >
                                    {isSelected && <CheckCircle className="w-3 h-3 mr-1" />}
                                    {item.code}
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                          
                          {/* Search Tips */}
                          <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <div className="flex items-start gap-2">
                              <Brain className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-blue-900 mb-1">Search Tips:</p>
                                <ul className="space-y-0.5 text-blue-700">
                                  <li>• Use specific terms: "diabetes", "hypertension", "infection"</li>
                                  <li>• Search by code: "E11", "I10", "J06" for partial matches</li>
                                  <li>• Multiple codes can be selected in one search session</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {smartSuggestions.length > 0 && (
                      <Alert className="border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <AlertDescription>
                          <div className="space-y-3">
                            <span className="text-sm font-semibold flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-500" />
                              AI-Powered Suggestions
                            </span>
                            {smartSuggestions.map((suggestion, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/50 hover:border-primary/50 transition-all group"
                              >
                                <div className="flex-1">
                                  <span className="text-sm font-medium">
                                    {suggestion.text} {suggestion.code && `(${suggestion.code})`}
                                  </span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                                        style={{ width: `${suggestion.confidence * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(suggestion.confidence * 100)}% confidence
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applySuggestion(suggestion)}
                                  className="ml-3 border-primary/30 hover:bg-primary hover:text-primary-foreground"
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

              <TabsContent value="treatment" className="space-y-4 mt-6">
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
                          analyzeText(e.target.value, "treatment")
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
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication("paracetamol")}>
                            + Paracetamol
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication("ibuprofen")}>
                            + Ibuprofen
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication("amoxicillin")}>
                            + Antibiotic
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => addQuickMedication("amlodipine")}>
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
                            <Button size="sm" variant="outline" onClick={() => removeMedication(index)}>
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
                          <Button
                            size="sm"
                            onClick={() => {
                              const name = (document.getElementById("med-name") as HTMLInputElement)?.value
                              const dosage = (document.getElementById("med-dosage") as HTMLInputElement)?.value
                              const frequency = (document.getElementById("med-frequency") as HTMLInputElement)?.value
                              const duration = (document.getElementById("med-duration") as HTMLInputElement)?.value

                              if (name && dosage && frequency && duration) {
                                addCustomMedication({ name, dosage, frequency, duration })
                                // Clear inputs
                                ;(document.getElementById("med-name") as HTMLInputElement).value = ""
                                ;(document.getElementById("med-dosage") as HTMLInputElement).value = ""
                                ;(document.getElementById("med-frequency") as HTMLInputElement).value = ""
                                ;(document.getElementById("med-duration") as HTMLInputElement).value = ""
                              }
                            }}
                          >
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
                            <button onClick={() => removeInvestigation(index)} className="ml-1 hover:text-red-500">
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
                            if (e.key === "Enter") {
                              const value = (e.target as HTMLInputElement).value.trim()
                              if (value) {
                                addInvestigation(value)
                                ;(e.target as HTMLInputElement).value = ""
                              }
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const input = document.getElementById("investigation-input") as HTMLInputElement
                            const value = input.value.trim()
                            if (value) {
                              addInvestigation(value)
                              input.value = ""
                            }
                          }}
                        >
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
                          id="counsel-follow-up"
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
                              onChange={(e) =>
                                updateClinicalNotes(
                                  "treatmentPlan",
                                  clinicalNotes.treatmentPlan + `\nFollow-up: ${e.target.value}`,
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="review" className="space-y-4 mt-6">
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
                        <p className="text-sm mt-1">{clinicalNotes.doctorDiagnosis || "Not specified"}</p>
                        {clinicalNotes.icd10Codes && (
                          <p className="text-xs text-muted-foreground mt-1">ICD-10 Codes: {clinicalNotes.icd10Codes}</p>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Treatment Plan:
                        </h4>
                        <p className="text-sm mt-1">{clinicalNotes.treatmentPlan || "Not specified"}</p>
                      </div>

                      {medications.length > 0 && (
                        <div>
                          <h4 className="font-medium">Medications:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                            {medications.map((med, index) => (
                              <div key={index} className="text-sm p-2 bg-white rounded border">
                                <span className="font-medium">{med.name}</span> {med.dosage} {med.frequency} for{" "}
                                {med.duration}
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
                          <p className="text-sm">
                            {clinicalNotes.followUpDate
                              ? `Scheduled for ${clinicalNotes.followUpDate}`
                              : "Date to be arranged"}
                          </p>
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
                  <span className="ml-2">
                    {vitalSigns.bloodPressureSystolic && vitalSigns.bloodPressureDiastolic
                      ? `${vitalSigns.bloodPressureSystolic}/${vitalSigns.bloodPressureDiastolic}`
                      : "â€”"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Pulse:</span>
                  <span className="ml-2">{vitalSigns.pulse || "â€”"} bpm</span>
                </div>
                <div>
                  <span className="font-medium">Temp:</span>
                  <span className="ml-2">{vitalSigns.temperature || "â€”"} Â°C</span>
                </div>
              </div>

              {/* Key clinical summary */}
              <div className="mt-4 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Nursing:</span> {clinicalNotes.nursingAssessment || "â€”"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Diagnosis:</span> {clinicalNotes.doctorDiagnosis || "â€”"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Medications:</span>{" "}
                  {medications.length > 0 ? medications.map((m) => m.name).join(", ") : "â€”"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Counseling:</span> {clinicalNotes.counselingNotes || "â€”"}
                </div>
              </div>

              {/* Referrals summary */}
              {clinicalSummary.referrals.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium mb-1">Referrals</div>
                  <ul className="text-sm list-disc ml-5 space-y-1">
                    {clinicalSummary.referrals.map((r: any) => (
                      <li key={r.id}>
                        {r.referral_type} - {r.reason} ({r.status})
                        {r.appointment_date ? ` â€¢ ${r.appointment_date}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Completion checklist */}
              <div className="mt-4 text-sm space-y-1">
                {(() => {
                  const hasVitals = workflowSteps.find((s) => s.id === "nursing")?.status === "completed"
                  const hasDoctorNote = workflowSteps.find((s) => s.id === "doctor")?.status === "completed"
                  const hasCounseling = workflowSteps.find((s) => s.id === "counseling")?.status === "completed"
                  const items = [
                    { ok: hasVitals, label: "Vital signs recorded" },
                    { ok: hasDoctorNote, label: "Doctor consultation completed" },
                    { ok: hasCounseling, label: "Counseling session completed" },
                  ]
                  return (
                    <ul className="list-disc ml-5">
                      {items.map((it, idx) => (
                        <li key={idx} className={it.ok ? "text-green-700" : "text-red-700"}>
                          {it.label} {it.ok ? "âœ“" : "âœ—"}
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
                value={clinicalNotes.finalNotes || ""}
                onChange={(e) => updateClinicalNotes("finalNotes" as any, e.target.value)}
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
                    const nursingDone = workflowSteps.find((s) => s.id === "nursing")?.status === "completed"
                    const doctorDone = workflowSteps.find((s) => s.id === "doctor")?.status === "completed"
                    const counselingDone = workflowSteps.find((s) => s.id === "counseling")?.status === "completed"
                    const closureReady = step.id !== "closure" || (nursingDone && doctorDone && counselingDone)
                    return (
                      <>
                        {step.id === "closure" && !closureReady && (
                          <div className="text-xs text-muted-foreground mr-auto">
                            {(() => {
                              const missing: string[] = []
                              if (!nursingDone) missing.push("Nursing Assessment")
                              if (!doctorDone) missing.push("Doctor Consultation")
                              if (!counselingDone) missing.push("Counseling Session")
                              return `Complete required steps before closing: ${missing.join(" and ")}.`
                            })()}
                          </div>
                        )}
                        <Button onClick={completeCurrentStep} disabled={!closureReady || completingStep}>
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
