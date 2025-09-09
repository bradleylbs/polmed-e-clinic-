"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
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
  counselingNotes: string
  mentalHealthScreening: string
  referrals: string
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
    counselingNotes: "",
    mentalHealthScreening: "",
    referrals: "",
  })

  const [showReferral, setShowReferral] = useState(false)

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
    return step.role === userRole || step.status === "completed"
  }

  const completeCurrentStep = () => {
    const updatedSteps = [...workflowSteps]
    const currentStepData = updatedSteps[currentStep]

    if (currentStepData && canAccessStep(currentStepData)) {
      updatedSteps[currentStep] = {
        ...currentStepData,
        status: "completed",
        completedBy: username,
        completedAt: new Date().toISOString(),
      }

      // Move to next step if available
      if (currentStep < updatedSteps.length - 1) {
        const nextIdx = currentStep + 1
        updatedSteps[nextIdx] = {
          ...updatedSteps[nextIdx],
          status: "in-progress",
        }
        // Only navigate to next step if the user can access it (same role or admin)
        const nextStep = updatedSteps[nextIdx]
        const canViewNext = userRole === "administrator" || nextStep.role === userRole
        if (canViewNext) {
          setCurrentStep(nextIdx)
        }
      }

      setWorkflowSteps(updatedSteps)

      if (currentStep >= updatedSteps.length - 1) {
        onWorkflowComplete()
      }
    }
  }

  const updateVitalSigns = (field: keyof VitalSigns, value: string) => {
    setVitalSigns((prev) => ({ ...prev, [field]: value }))
  }

  const updateClinicalNotes = (field: keyof ClinicalNotes, value: string) => {
    setClinicalNotes((prev) => ({ ...prev, [field]: value }))
  }

  // Load latest visit + vitals to reflect nursing completion when a doctor views
  useEffect(() => {
    const syncFromServer = async () => {
      const latest = await apiService.getLatestVisit(Number(patientId))
      if (latest.success && latest.data?.id) {
        setVisitId(latest.data.id)
        const vitals = await apiService.getVisitVitals(latest.data.id)
  if (vitals.success && vitals.data && vitals.data.count > 0) {
          // Mark nursing step as completed if vitals exist
          setWorkflowSteps((prev) => {
            const updated = [...prev]
            const idx = updated.findIndex((s) => s.id === 'nursing')
            if (idx >= 0 && updated[idx].status !== 'completed') {
              updated[idx] = {
                ...updated[idx],
                status: 'completed',
                completedBy: 'Nurse',
                completedAt: new Date().toISOString(),
              }
              // Ensure doctor step is in-progress when doctor logs in
              const didx = updated.findIndex((s) => s.id === 'doctor')
              if (didx >= 0 && updated[didx].status === 'pending') {
                updated[didx] = { ...updated[didx], status: 'in-progress' }
              }
            }
            return updated
          })
          // Populate vital signs UI from latest vitals so values are visible
          const latest = vitals.data.latest as any
          if (latest) {
            setVitalSigns({
              bloodPressureSystolic: latest.systolic_bp != null ? String(latest.systolic_bp) : "",
              bloodPressureDiastolic: latest.diastolic_bp != null ? String(latest.diastolic_bp) : "",
              temperature: latest.temperature != null ? String(latest.temperature) : "",
              weight: latest.weight != null ? String(latest.weight) : "",
              height: latest.height != null ? String(latest.height) : "",
              pulse: latest.heart_rate != null ? String(latest.heart_rate) : "",
              respiratoryRate: "", // stored in additional_measurements; not fetched here
              oxygenSaturation: latest.oxygen_saturation != null ? String(latest.oxygen_saturation) : "",
            })
          }
          // Auto-focus the Doctor step for doctors
          if (userRole === 'doctor') {
            setCurrentStep((prevIdx) => {
              // switch to doctor tab if available
              const didx = workflowSteps.findIndex((s) => s.id === 'doctor')
              return didx >= 0 ? didx : prevIdx
            })
          }
        }
      }
    }
    // Doctors (and others) should see the current state when opening
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
              <Label>Prescriptions</Label>
              <Textarea
                placeholder="List medications, dosages, and instructions..."
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
          </div>
        )

      case "closure":
        return (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Patient Summary</h3>
              <p className="text-sm text-muted-foreground">
                Review all clinical data and ensure completeness before closing the patient file.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Final Notes</Label>
              <Textarea placeholder="Any additional notes or follow-up instructions..." rows={3} />
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
                <div className="mt-6 flex justify-end">
                  <Button onClick={completeCurrentStep}>
                    Complete {step.title}
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
