"use client"
import type React from "react"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  XCircle,
  ChevronRight,
  Zap,
  Target,
  Clipboard,
  CloudUpload,
  Loader2,
} from "lucide-react"
import { ReferralModal } from "./referral-modal"
import {
  apiService,
  type CreateClinicalNoteRequest,
  type PatientDocument,
  type SmartSuggestionRecord,
} from "@/lib/api-service"
import { offlineManager } from "@/lib/offline-manager"
import { useToast } from "@/components/ui/use-toast"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { validateAllVitalSigns, type AllVitalsValidation, getValidationColor, getValidationIcon } from "@/lib/vital-signs-validator"

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
  followUpInstructions?: string
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
  isSpecialist?: boolean
  specialistType?: string
  noteType?: string
}

interface ClinicalWorkflowProps {
  patientId: string
  patientName: string
  userRole: string
  username: string
  onWorkflowComplete: () => void
}

interface SpecialistDefinition {
  specialist_type: string
  label: string
  role: string
  note_type: string
}

interface SpecialistNoteDraft {
  content: string
  followUpRequired?: boolean
  followUpDate?: string
  noteType?: string
  severity?: string
  laterality?: string
  grade?: string
  selectedTemplate?: string
  structuredSections?: Partial<Record<string, string>>
}

interface WorkflowStatusSnapshot {
  completed: boolean
  completedAt?: string | null
  role?: string
  noteType?: string
  isSpecialist?: boolean
  specialistType?: string
  title?: string
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

const OFFLINE_COMPLETION_STORAGE_KEY = "palmed-offline-workflow-submissions"

interface WorkflowSubmissionPayload {
  vitalSigns: VitalSigns
  clinicalNotes: ClinicalNotes
  medications: Medication[]
  investigations: string[]
  selectedICD10Codes: Array<{ code: string; description: string }>
  persistVitals?: boolean
  specialistNotes?: Record<string, SpecialistNoteDraft>
}

interface QueuedWorkflowSubmission {
  id: string
  patientId: number
  visitId?: number | null
  stepId: WorkflowStep["id"]
  createdAt: number
  username: string
  payload: WorkflowSubmissionPayload
}

const readOfflineWorkflowQueue = (): QueuedWorkflowSubmission[] => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(OFFLINE_COMPLETION_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }
  } catch (error) {
    console.warn("Failed to read offline workflow queue", error)
  }
  return []
}

const writeOfflineWorkflowQueue = (entries: QueuedWorkflowSubmission[]) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(OFFLINE_COMPLETION_STORAGE_KEY, JSON.stringify(entries))
  } catch (error) {
    console.warn("Failed to persist offline workflow queue", error)
  }
}

const ROLE_LABELS: Record<string, string> = {
  administrator: "Administrator",
  clerk: "Admin Clerk",
  nurse: "Nurse",
  doctor: "Doctor",
  social_worker: "Social Worker",
  social_work: "Social Worker",
  dentist: "Dentist",
  optometrist: "Optometrist",
  audiologist: "Audiologist",
  gynaecologist: "Gynaecologist",
  ultrasound: "Ultrasound",
  psychologist: "Psychologist",
}

const SPECIALIST_ROLE_KEYS = new Set([
  "dentist",
  "optometrist",
  "audiologist",
  "gynaecologist",
  "ultrasound",
  "psychologist",
])

const SPECIALIST_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  dentist: Sparkles,
  dental_consultation: Sparkles,
  optometrist: Eye,
  optometry_assessment: Eye,
  audiologist: Activity,
  audiology_assessment: Activity,
  gynaecologist: Target,
  gynaecology_consultation: Target,
  ultrasound: Zap,
  ultrasound_scan: Zap,
  psychology: Brain,
  psychology_session: Brain,
  psychologist: Brain,
}

const TEMPLATE_CUSTOM_VALUE = "__palmed-template-custom__"
const SELECT_EMPTY_VALUE = "__palmed-empty__"

const RequiredAsterisk = () => (
  <span className="text-destructive" aria-hidden="true">
    *
  </span>
)

type SpecialistDropdownType = "severity" | "laterality" | "grade"

interface SpecialistDropdownConfig {
  field: SpecialistDropdownType
  label: string
  options: string[]
  required?: boolean
}

interface SpecialistQuickSnippet {
  label: string
  content: string
}

interface SpecialistTemplateConfig {
  label: string
  value: string
  content: string
}

interface SpecialistNoteConfig {
  placeholder: string
  guidance: Array<{ title: string; items: string[] }>
  quickSnippets: SpecialistQuickSnippet[]
  templates: SpecialistTemplateConfig[]
  procedures: string[]
  medications: string[]
  dropdowns: SpecialistDropdownConfig[]
  requiredSections: string[]
  requiredDropdowns?: SpecialistDropdownType[]
  recommendedUploads?: string[]
}

interface DocumentUploadDraft {
  file: File | null
  documentType: string
  notes: string
  isConfidential: boolean
}

const DOCUMENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "report", label: "Clinical report" },
  { value: "imaging", label: "Imaging" },
  { value: "prescription", label: "Prescription" },
  { value: "certificate", label: "Medical certificate" },
  { value: "referral", label: "Referral" },
  { value: "discharge", label: "Discharge summary" },
  { value: "consent", label: "Consent form" },
  { value: "other", label: "Other" },
]

const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".tif",
  ".tiff",
  ".bmp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".rtf",
]

const MAX_RECENT_UPLOADS = 3

const formatFileSize = (bytes: number) => {
  if (bytes <= 0 || Number.isNaN(bytes)) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, exponent)
  return `${size.toFixed(size < 10 && exponent > 0 ? 1 : 0)} ${units[exponent]}`
}

const formatUploadTimestamp = (value?: string | null) => {
  if (!value) {
    // If no timestamp, show current time
    return new Date().toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    // Fallback to showing the raw value if parsing fails
    return value
  }

  return parsed.toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const SPECIALIST_NOTE_CONFIG: Record<string, SpecialistNoteConfig> = {
  dentist: {
    placeholder: [
      "Chief Complaint: Toothache, bleeding gums, routine check-up",
      "Examination: Dentition status, caries (tooth numbers), gingival health, occlusion",
      "Assessment: Dental caries, gingivitis, periodontitis, malocclusion",
      "Treatment: Scaling, fillings, extractions, oral hygiene counseling",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Document multiple caries",
        content:
          "Assessment: Multiple carious lesions involving molars 36 and 37.\nTreatment: Composite restorations planned with local anesthesia.",
      },
      {
        label: "Oral hygiene counseling",
        content:
          "Treatment: Provided oral hygiene counseling covering twice-daily brushing, interdental cleaning, and fluoride rinse.",
      },
      {
        label: "Bleeding gums",
        content:
          "Chief Complaint: Patient reports bleeding gums when brushing for the past two weeks.",
      },
    ],
    templates: [
      {
        label: "Normal oral exam",
        value: "dentist-normal",
        content:
          "Chief Complaint: Routine dental check-up.\nExamination: Dentition intact, no active caries. Gingiva pink without bleeding. Occlusion stable.\nAssessment: Healthy oral cavity.\nTreatment: Reinforced oral hygiene and six-month recall.",
      },
      {
        label: "Routine scaling completed",
        value: "dentist-scaling",
        content:
          "Chief Complaint: Plaque build-up and bleeding gums.\nExamination: Generalized plaque with mild calculus along mandibular anterior teeth.\nAssessment: Gingivitis secondary to plaque accumulation.\nTreatment: Full mouth scaling completed; reviewed oral hygiene techniques.",
      },
      {
        label: "Multiple caries",
        value: "dentist-caries",
        content:
          "Chief Complaint: Toothache affecting lower left quadrant.\nExamination: Carious lesions noted on teeth 36, 37 with percussion tenderness.\nAssessment: Dental caries with reversible pulpitis.\nTreatment: Planned sequential restorations and desensitizing regimen; analgesics as required.",
      },
    ],
    procedures: ["Scaling", "Fillings", "Extractions", "Oral hygiene counseling"],
    medications: [
      "Chlorhexidine 0.12% rinse twice daily",
      "Ibuprofen 400mg three times daily for 3 days",
      "Amoxicillin 500mg three times daily for 5 days",
    ],
    recommendedUploads: [
      "Intraoral photographs documenting lesions or procedures",
      "Relevant radiographs (periapical, bitewing, panoramic)",
      "Signed consent or laboratory forms related to dental appliances",
    ],
    dropdowns: [
      { field: "severity", label: "Caries severity", options: ["Mild", "Moderate", "Severe"], required: true },
      { field: "laterality", label: "Arch", options: ["Upper", "Lower", "Both"] },
      { field: "grade", label: "Periodontal grade", options: ["Grade I", "Grade II", "Grade III"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
    requiredDropdowns: ["severity"],
  },
  optometrist: {
    placeholder: [
      "Chief Complaint: Blurred vision, eye strain, routine eye test",
      "Examination: Visual acuity, refraction, intraocular pressure (IOP), fundoscopy findings",
      "Assessment: Myopia, hyperopia, astigmatism, presbyopia, glaucoma suspect",
      "Treatment: Spectacle prescription, referral to ophthalmology",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Refractive error corrected",
        content:
          "Assessment: Refractive error corrected with updated spectacle prescription.\nTreatment: Provided new script and adaptation guidance.",
      },
      {
        label: "Elevated IOP",
        content:
          "Assessment: Elevated intraocular pressure noted; glaucoma suspect.\nTreatment: Referred to ophthalmology for definitive assessment.",
      },
      {
        label: "Eye strain advice",
        content:
          "Treatment: Discussed ergonomic adjustments and 20-20-20 rule for digital eye strain.",
      },
    ],
    templates: [
      {
        label: "Normal vision",
        value: "optometrist-normal",
        content:
          "Chief Complaint: Routine vision screening.\nExamination: Visual acuity 6/6 bilaterally, refraction stable, IOP within normal range, fundoscopy unremarkable.\nAssessment: Stable vision status.\nTreatment: Reassurance and annual review.",
      },
      {
        label: "Refractive error corrected",
        value: "optometrist-refractive",
        content:
          "Chief Complaint: Progressive blur at distance.\nExamination: Visual acuity 6/12 improving to 6/6 with -1.50 DS both eyes; IOP 15 mmHg.\nAssessment: Bilateral myopia.\nTreatment: Issued updated spectacle prescription; advised regular breaks from screen use.",
      },
      {
        label: "Elevated IOP - refer",
        value: "optometrist-iop",
        content:
          "Chief Complaint: Routine eye check.\nExamination: Visual acuity 6/9 improving to 6/6, IOP 24 mmHg OD / 23 mmHg OS, optic discs with enlarged cup-to-disc ratio.\nAssessment: Glaucoma suspect.\nTreatment: Referred to ophthalmology; counselled regarding urgency and symptom monitoring.",
      },
    ],
    procedures: ["Spectacle prescription", "Refer to ophthalmology", "Visual hygiene counseling"],
    medications: ["Artificial tears QID", "Timolol 0.5% drops BID", "Latanoprost 0.005% nocte"],
    recommendedUploads: [
      "Refraction sheets or autorefractor printouts",
      "OCT images or visual field plots for glaucoma screening",
      "Signed spectacle or contact lens prescriptions",
    ],
    dropdowns: [
      { field: "severity", label: "Severity", options: ["Mild", "Moderate", "Severe"], required: true },
      { field: "laterality", label: "Laterality", options: ["Right eye", "Left eye", "Both eyes"], required: true },
      { field: "grade", label: "Glaucoma risk", options: ["Low", "Moderate", "High"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
    requiredDropdowns: ["severity", "laterality"],
  },
  audiologist: {
    placeholder: [
      "Chief Complaint: Hearing loss, tinnitus, ear fullness",
      "Examination: Otoscopy findings, pure tone audiometry results, tympanometry",
      "Assessment: Conductive/sensorineural hearing loss (mild/moderate/severe)",
      "Treatment: Hearing aid recommendation, ear wax removal, ENT referral",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Bilateral hearing loss",
        content:
          "Assessment: Bilateral mild-to-moderate sensorineural hearing loss confirmed on audiogram.\nTreatment: Discussed hearing aid trial and communication strategies.",
      },
      {
        label: "Wax impaction",
        content:
          "Examination: Impacted cerumen observed right ear with flat tympanogram.\nTreatment: Performed ear wax removal; planned repeat audiometry post-clearance.",
      },
      {
        label: "Tinnitus counseling",
        content:
          "Treatment: Provided tinnitus counseling with sound therapy recommendations and ENT referral for further evaluation.",
      },
    ],
    templates: [
      {
        label: "Normal hearing",
        value: "audiologist-normal",
        content:
          "Chief Complaint: Routine occupational hearing screening.\nExamination: Otoscopy clear bilaterally; pure tone thresholds within normal limits.\nAssessment: Normal hearing sensitivity.\nTreatment: Advised annual monitoring and hearing protection.",
      },
      {
        label: "Bilateral hearing loss",
        value: "audiologist-loss",
        content:
          "Chief Complaint: Difficulty following conversations in noise.\nExamination: Otoscopy unremarkable; audiogram shows bilateral moderate sloping SNHL; tympanometry type A.\nAssessment: Bilateral sensorineural hearing loss.\nTreatment: Recommended bilateral behind-the-ear hearing aids and communication strategies handout.",
      },
      {
        label: "Wax impaction",
        value: "audiologist-wax",
        content:
          "Chief Complaint: Sudden ear fullness on right side.\nExamination: Impacted cerumen right ear; tympanogram type B.\nAssessment: Conductive hearing loss secondary to cerumen impaction.\nTreatment: Completed ear wax removal; scheduled repeat audiogram in one week.",
      },
    ],
    procedures: ["Hearing aid counseling", "Pure tone audiometry", "Ear wax removal", "ENT referral"],
    medications: ["Cerumenolytic drops nightly x5", "Short course oral steroids (if indicated)", "No medication required"],
    recommendedUploads: [
      "Pure tone audiograms and tympanometry traces",
      "Hearing aid fitting reports or real ear measurements",
      "Referral letters to ENT specialists when issued",
    ],
    dropdowns: [
      { field: "severity", label: "Loss severity", options: ["Mild", "Moderate", "Moderately severe", "Severe"] },
      { field: "laterality", label: "Laterality", options: ["Right", "Left", "Bilateral"] },
      { field: "grade", label: "Tympanogram", options: ["Type A", "Type B", "Type C"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
  },
  gynaecologist: {
    placeholder: [
      "Chief Complaint: Menstrual irregularity, pelvic pain, contraception, pregnancy",
      "Examination: Menstrual history (LMP, cycle), pelvic exam, Pap smear, pregnancy test",
      "Assessment: Dysmenorrhea, PCOS, fibroids, normal pregnancy",
      "Treatment: Contraception counseling, hormonal therapy, prenatal care",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Antenatal visit",
        content:
          "Assessment: Normal intrauterine pregnancy at 20 weeks with reassuring fetal heart rate.\nTreatment: Reviewed antenatal plan, supplements, and danger signs.",
      },
      {
        label: "PCOS counseling",
        content:
          "Treatment: Provided lifestyle counseling for PCOS management; discussed contraceptive options and follow-up ultrasound.",
      },
      {
        label: "Pelvic pain workup",
        content:
          "Examination: Pelvic exam revealed uterine tenderness; ordered pelvic ultrasound and STI screening.",
      },
    ],
    templates: [
      {
        label: "Normal gynae exam",
        value: "gynae-normal",
        content:
          "Chief Complaint: Routine family planning visit.\nExamination: Menstrual cycles regular; pelvic exam normal; Pap smear up to date.\nAssessment: Well woman visit.\nTreatment: Continued contraception counseling and yearly follow-up.",
      },
      {
        label: "Antenatal visit",
        value: "gynae-antenatal",
        content:
          "Chief Complaint: Routine antenatal review at 24 weeks.\nExamination: Fundal height appropriate, fetal heart 150 bpm, urine negative for protein/glucose.\nAssessment: Uncomplicated pregnancy.\nTreatment: Continued prenatal care, supplements, and next visit in 4 weeks.",
      },
      {
        label: "Family planning",
        value: "gynae-family",
        content:
          "Chief Complaint: Desire for contraception.\nExamination: LMP 28 days ago, pelvic exam normal.\nAssessment: Contraceptive counseling visit.\nTreatment: Initiated combined oral contraceptive; counselled on adherence and warning signs.",
      },
    ],
    procedures: ["Contraception counseling", "Hormonal therapy initiation", "Prenatal care review", "Pap smear"],
    medications: ["Combined oral contraceptive daily", "Prenatal vitamins OD", "Progesterone-only pill"],
    recommendedUploads: [
      "Pelvic or obstetric ultrasound reports and key images",
      "Pap smear or HPV/cytology laboratory results",
      "Consent forms or procedure notes for interventions performed",
    ],
    dropdowns: [
      { field: "severity", label: "Symptom severity", options: ["Mild", "Moderate", "Severe"] },
      { field: "laterality", label: "Pelvic laterality", options: ["Right adnexa", "Left adnexa", "Bilateral", "Not applicable"] },
      { field: "grade", label: "Pregnancy risk", options: ["Low", "Medium", "High"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
  },
  ultrasound: {
    placeholder: [
      "Chief Complaint: Pregnancy dating, abdominal pain, organ assessment",
      "Examination: Scan type, gestational age, fetal biometry, organ visualization",
      "Assessment: Normal intrauterine pregnancy, abdominal pathology",
      "Treatment: Report findings, obstetric follow-up, surgical referral",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Normal obstetric scan",
        content:
          "Assessment: Single live intrauterine pregnancy with biometrics consistent with dates.\nTreatment: Routine obstetric follow-up advised.",
      },
      {
        label: "Gallstones detected",
        content:
          "Assessment: Multiple gallstones visualised without cholecystitis features.\nTreatment: Referred to general surgery for elective management.",
      },
      {
        label: "Liver assessment",
        content:
          "Examination: Liver homogeneous, no focal lesions; portal vein flow normal.",
      },
    ],
    templates: [
      {
        label: "Normal obstetric scan",
        value: "ultrasound-obstetric",
        content:
          "Chief Complaint: Pregnancy dating scan.\nExamination: Transabdominal ultrasound; GA 18+4 weeks; fetal biometry within normal range; placenta posterior.\nAssessment: Normal intrauterine pregnancy.\nTreatment: Continue routine antenatal care; follow-up at 24 weeks.",
      },
      {
        label: "Gallstones detected",
        value: "ultrasound-gallstones",
        content:
          "Chief Complaint: Right upper quadrant pain.\nExamination: Abdominal ultrasound showing gallstones with acoustic shadowing; no ductal dilatation.\nAssessment: Cholelithiasis without cholecystitis.\nTreatment: Discussed findings; referred to general surgery for elective review.",
      },
      {
        label: "Liver assessment",
        value: "ultrasound-liver",
        content:
          "Chief Complaint: Elevated liver enzymes.\nExamination: Hepatic ultrasound reveals normal echotexture, no focal lesions, patent hepatic vasculature.\nAssessment: Normal hepatic ultrasound.\nTreatment: Findings relayed to referring clinician; follow-up as clinically indicated.",
      },
    ],
    procedures: ["Obstetric follow-up", "Surgical referral", "Detailed organ assessment"],
    medications: ["No medication required", "Analgesia as per referring clinician"],
    recommendedUploads: [
      "Representative ultrasound image captures or cine loops",
      "Formal sonographer or radiologist report",
      "Communication or referral note back to the requesting clinician",
    ],
    dropdowns: [
      { field: "severity", label: "Findings severity", options: ["Normal", "Mild deviation", "Significant deviation"], required: true },
      { field: "laterality", label: "Laterality", options: ["Right", "Left", "Bilateral", "Midline", "Not applicable"] },
      { field: "grade", label: "Recommendation urgency", options: ["Routine", "Soon", "Urgent"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
    requiredDropdowns: ["severity"],
  },
  psychology: {
    placeholder: [
      "Chief Complaint: Depression, anxiety, behavioral issues, trauma",
      "Examination: Mental status exam (appearance, mood, thought content, cognition)",
      "Assessment: Depression (mild/moderate/severe), anxiety disorder, PTSD",
      "Treatment: CBT initiated, psychotherapy sessions, psychiatric referral",
    ].join("\n"),
    guidance: [],
    quickSnippets: [
      {
        label: "Anxiety assessment",
        content:
          "Assessment: Generalised anxiety disorder features with persistent worry.\nTreatment: Initiated CBT plan focusing on relaxation and cognitive restructuring.",
      },
      {
        label: "Crisis intervention",
        content:
          "Treatment: Conducted crisis intervention session; established safety plan and arranged urgent psychiatric consultation.",
      },
      {
        label: "Normal mental status",
        content:
          "Examination: Mental status exam reveals well-groomed appearance, euthymic mood, coherent thought processes, intact cognition.",
      },
    ],
    templates: [
      {
        label: "Normal mental status",
        value: "psychology-normal",
        content:
          "Chief Complaint: Stress related to workload.\nExamination: Mental status exam within normal limits.\nAssessment: Adjustment disorder.\nTreatment: Initiated supportive psychotherapy and stress-management techniques.",
      },
      {
        label: "Anxiety assessment",
        value: "psychology-anxiety",
        content:
          "Chief Complaint: Persistent anxiety and restlessness.\nExamination: MSE notable for anxious affect, no psychosis, cognition intact.\nAssessment: Generalised anxiety disorder.\nTreatment: Started CBT, provided breathing exercises, and scheduled weekly sessions.",
      },
      {
        label: "Crisis intervention",
        value: "psychology-crisis",
        content:
          "Chief Complaint: Acute distress following traumatic event.\nExamination: MSE with labile affect, intrusive memories, no suicidal ideation.\nAssessment: Acute stress reaction.\nTreatment: Delivered crisis intervention, safety plan, and referral to psychiatry for medication review.",
      },
    ],
    procedures: ["CBT session", "Psychotherapy follow-up", "Psychiatric referral", "Safety planning"],
    medications: ["Psychiatric referral for pharmacotherapy", "Sleep hygiene strategies", "Relaxation techniques"],
    recommendedUploads: [
      "Psychometric assessment score sheets or inventories",
      "Session summaries or progress note exports for continuity",
      "Signed consent forms or safety plans when indicated",
    ],
    dropdowns: [
      { field: "severity", label: "Symptom severity", options: ["Mild", "Moderate", "Severe", "Crisis"], required: true },
      { field: "laterality", label: "Presentation focus", options: ["Individual", "Family", "Group", "Not applicable"] },
      { field: "grade", label: "Risk level", options: ["Low", "Medium", "High"] },
    ],
    requiredSections: ["Chief Complaint", "Examination", "Assessment", "Treatment"],
    requiredDropdowns: ["severity"],
  },
}

Object.assign(SPECIALIST_NOTE_CONFIG, {
  dental_consultation: SPECIALIST_NOTE_CONFIG.dentist,
  optometry_assessment: SPECIALIST_NOTE_CONFIG.optometrist,
  audiology_assessment: SPECIALIST_NOTE_CONFIG.audiologist,
  gynaecology_consultation: SPECIALIST_NOTE_CONFIG.gynaecologist,
  ultrasound_scan: SPECIALIST_NOTE_CONFIG.ultrasound,
  psychology_session: SPECIALIST_NOTE_CONFIG.psychology,
  psychologist: SPECIALIST_NOTE_CONFIG.psychology,
})

type DentistSectionKey = "chiefComplaint" | "history" | "examination" | "diagnostics" | "procedure" | "plan"

const DENTIST_SECTION_ORDER: DentistSectionKey[] = [
  "chiefComplaint",
  "history",
  "examination",
  "diagnostics",
  "procedure",
  "plan",
]

const DENTIST_SECTION_LABELS: Record<DentistSectionKey, string> = {
  chiefComplaint: "Chief Complaint",
  history: "History",
  examination: "Examination",
  diagnostics: "Assessment",
  procedure: "Procedure",
  plan: "Treatment",
}

const DENTIST_SECTION_DISPLAY_LABELS: Record<DentistSectionKey, string> = {
  chiefComplaint: "Chief Complaint",
  history: "Medical & Dental History",
  examination: "Clinical Examination",
  diagnostics: "Assessment & Diagnostics",
  procedure: "Procedures Performed",
  plan: "Management & Follow-up Plan",
}

const DENTIST_LABEL_TO_KEY: Record<string, DentistSectionKey> = DENTIST_SECTION_ORDER.reduce(
  (acc, key) => {
    acc[DENTIST_SECTION_LABELS[key].toLowerCase()] = key
    return acc
  },
  {} as Record<string, DentistSectionKey>,
)

const composeDentistStructuredContent = (
  sections: Partial<Record<DentistSectionKey, string>>,
): string => {
  return DENTIST_SECTION_ORDER.map((key) => {
    const value = sections[key]?.trim()
    if (!value) return null
    return `${DENTIST_SECTION_LABELS[key]}:\n${value}`
  })
    .filter(Boolean)
    .join("\n\n")
}

const parseDentistStructuredContent = (
  content?: string,
): Partial<Record<DentistSectionKey, string>> => {
  const result: Partial<Record<DentistSectionKey, string>> = {}
  if (!content) return result
  const normalized = content.replace(/\r\n/g, "\n").trim()
  if (!normalized) return result

  const blocks = normalized.split(/\n\s*\n/)
  for (const block of blocks) {
    const lines = block.split("\n")
    if (!lines.length) continue
    const header = lines[0]?.replace(/:\s*$/, "").trim().toLowerCase()
    if (!header) continue
    const key = DENTIST_LABEL_TO_KEY[header]
    if (!key) continue
    const body = lines.slice(1).join("\n").trim()
    if (body) {
      result[key] = body
    }
  }
  return result
}

const formatSpecialistLabel = (value: string) =>
  value
    .split(/[_\s-]+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")

const arraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

const orderSpecialists = (keys: string[], catalog: SpecialistDefinition[]) => {
  const uniqueKeys = Array.from(new Set(keys))
  if (!catalog.length) {
    return uniqueKeys.sort()
  }

  const ordering = new Map<string, number>()
  catalog.forEach((entry, index) => ordering.set(entry.specialist_type, index))

  return uniqueKeys.sort((a, b) => {
    const aIndex = ordering.has(a) ? ordering.get(a)! : Number.MAX_SAFE_INTEGER
    const bIndex = ordering.has(b) ? ordering.get(b)! : Number.MAX_SAFE_INTEGER
    if (aIndex === bIndex) {
      return a.localeCompare(b)
    }
    return aIndex - bIndex
  })
}

const appendSnippetUnique = (content: string, snippet: string) => {
  if (!snippet) return content
  if (!content) return snippet.trim()
  const normalizedContent = content.toLowerCase()
  if (normalizedContent.includes(snippet.trim().toLowerCase())) {
    return content
  }
  return `${content.trim()}\n\n${snippet.trim()}`.trim()
}

const upsertStructuredLine = (content: string, label: string, value?: string) => {
  const lines = content.split(/\r?\n/)
  const filtered = lines.filter((line) => !line.trim().toLowerCase().startsWith(`${label.toLowerCase()}:`)).filter((line) => line.trim().length > 0)

  if (!value || value === "") {
    return filtered.join("\n").trim()
  }

  return [`${label}: ${value}`, ...filtered].join("\n").trim()
}

const readDropdownValue = (draft: SpecialistNoteDraft | undefined, field: SpecialistDropdownType): string => {
  if (!draft) return ""
  switch (field) {
    case "severity":
      return draft.severity ?? ""
    case "laterality":
      return draft.laterality ?? ""
    case "grade":
      return draft.grade ?? ""
    default:
      return ""
  }
}

const applyDropdownValue = (
  draft: SpecialistNoteDraft,
  field: SpecialistDropdownType,
  value?: string,
): SpecialistNoteDraft => {
  const normalized = value && value.trim().length > 0 ? value : undefined
  switch (field) {
    case "severity":
      return { ...draft, severity: normalized }
    case "laterality":
      return { ...draft, laterality: normalized }
    case "grade":
      return { ...draft, grade: normalized }
    default:
      return draft
  }
}

const normalizeRoleValue = (role?: string | null) => (role ? role.toLowerCase().replace(/\s+/g, "_") : "")

const rolesAlign = (stepRole: string, activeRole: string) => {
  const normalizedStep = normalizeRoleValue(stepRole)
  const normalizedActive = normalizeRoleValue(activeRole)
  if (normalizedActive === "administrator") return true
  if (normalizedActive === normalizedStep) return true
  if (normalizedActive === "social_work" && normalizedStep === "social_worker") return true
  if (normalizedActive === "social_worker" && normalizedStep === "social_work") return true
  return false
}

const BASE_WORKFLOW_DEPENDENCIES: Record<string, WorkflowStep["id"][]> = {
  registration: [],
  nursing: ["registration"],
  doctor: ["nursing"],
  counseling: ["doctor"],
  closure: ["nursing", "doctor", "counseling"],
}

const getStepDependencies = (step: WorkflowStep, steps: WorkflowStep[]) => {
  if (!step) return []
  if (step.isSpecialist && step.specialistType) {
    return ["doctor"]
  }
  if (step.id === "closure") {
    const specialistIds = steps.filter((s) => s.isSpecialist).map((s) => s.id)
    return [...BASE_WORKFLOW_DEPENDENCIES.closure, ...specialistIds]
  }
  return BASE_WORKFLOW_DEPENDENCIES[step.id] || []
}

const listIncompleteDependencies = (stepId: WorkflowStep["id"], steps: WorkflowStep[]) => {
  const step = steps.find((s) => s.id === stepId)
  if (!step) return []
  return getStepDependencies(step, steps).filter(
    (dependency) => steps.find((s) => s.id === dependency)?.status !== "completed",
  )
}

const canAccessStepForRole = (
  step: WorkflowStep | undefined,
  steps: WorkflowStep[],
  activeRole: string,
  options?: { allowCompleted?: boolean },
) => {
  if (!step) return false
  const allowCompleted = options?.allowCompleted ?? true
  if (!rolesAlign(step.role, activeRole)) return false
  if (allowCompleted && step.status === "completed") return true
  return listIncompleteDependencies(step.id, steps).length === 0
}

interface ComposeWorkflowArgs {
  userRole: string
  selectedSpecialists: string[]
  specialistCatalog: SpecialistDefinition[]
  statusLookup: Record<string, WorkflowStatusSnapshot>
  previousSteps: WorkflowStep[]
}

const composeWorkflowSteps = ({
  userRole,
  selectedSpecialists,
  specialistCatalog,
  statusLookup,
  previousSteps,
}: ComposeWorkflowArgs): WorkflowStep[] => {
  const orderedSelection = orderSpecialists(selectedSpecialists, specialistCatalog)

  const baseSteps: WorkflowStep[] = [
    {
      id: "registration",
      title: "Patient Check-in",
      icon: UserCheck,
      role: "clerk",
      status: "pending",
    },
    {
      id: "nursing",
      title: "Nursing Assessment",
      icon: Heart,
      role: "nurse",
      status: "pending",
    },
    {
      id: "doctor",
      title: "Doctor Consultation",
      icon: Stethoscope,
      role: "doctor",
      status: "pending",
    },
  ]

  const specialistSteps: WorkflowStep[] = orderedSelection.map((specialistType) => {
    const catalogEntry = specialistCatalog.find((entry) => entry.specialist_type === specialistType)
    const role = catalogEntry?.role ?? specialistType
    const noteType = catalogEntry?.note_type ?? formatSpecialistLabel(specialistType)
    const label = catalogEntry?.label ?? formatSpecialistLabel(specialistType)
    const Icon = SPECIALIST_ICON_MAP[specialistType] ?? Clipboard

    return {
      id: `specialist:${specialistType}`,
      title: label,
      icon: Icon,
      role,
      status: "pending",
      isSpecialist: true,
      specialistType,
      noteType,
    }
  })

  const tailSteps: WorkflowStep[] = [
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
  ]

  const steps = [...baseSteps, ...specialistSteps, ...tailSteps]

  // Apply server-provided status overrides
  const statusApplied: WorkflowStep[] = steps.map((step) => {
    const snapshot = statusLookup[step.id]
    if (!snapshot) {
      return step
    }

    const nextStatus: WorkflowStep["status"] = snapshot.completed ? "completed" : step.status

    return {
      ...step,
      role: snapshot.role || step.role,
      noteType: snapshot.noteType || step.noteType,
      status: nextStatus,
      completedAt: snapshot.completedAt ?? step.completedAt,
    }
  })

  // Preserve locally completed steps when server data is absent
  const reconciled: WorkflowStep[] = statusApplied.map((step) => {
    const previous = previousSteps.find((prev) => prev.id === step.id)
    if (previous && previous.status === "completed" && step.status !== "completed") {
      return {
        ...step,
        status: "completed",
        completedAt: step.completedAt ?? previous.completedAt,
        completedBy: step.completedBy ?? previous.completedBy,
      }
    }
    if (previous && previous.status === "in-progress" && step.status === "pending") {
      return { ...step, status: "in-progress" }
    }
    return step
  })

  // Reset any lingering in-progress markers before recomputing
  const cleaned: WorkflowStep[] = reconciled.map((step) =>
    step.status === "in-progress"
      ? {
          ...step,
          status: "pending",
        }
      : step,
  )

  const firstActionable = cleaned.findIndex(
    (step) =>
      step.status !== "completed" && canAccessStepForRole(step, cleaned, userRole, { allowCompleted: false }),
  )

  if (firstActionable >= 0) {
    cleaned[firstActionable] = { ...cleaned[firstActionable], status: "in-progress" }
  }

  return cleaned
}

export function ClinicalWorkflow({
  patientId,
  patientName,
  userRole,
  username,
  onWorkflowComplete,
}: ClinicalWorkflowProps) {
  const normalizedUserRole = useMemo(() => normalizeRoleValue(userRole), [userRole])
  const canEditSpecialistSelection = useMemo(
    () => ["administrator", "doctor", "nurse", "clerk"].includes(normalizedUserRole),
    [normalizedUserRole],
  )
  const isSpecialistRole = useMemo(() => SPECIALIST_ROLE_KEYS.has(normalizedUserRole), [normalizedUserRole])
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

  // Vital signs validation state
  const [vitalsValidation, setVitalsValidation] = useState<AllVitalsValidation | null>(null)

  const [clinicalNotes, setClinicalNotes] = useState<ClinicalNotes>({
    nursingAssessment: "",
    doctorDiagnosis: "",
    treatmentPlan: "",
    prescriptions: "",
    icd10Codes: "",
    followUpRequired: false,
    followUpDate: "",
    followUpInstructions: "",
    counselingNotes: "",
    mentalHealthScreening: "",
    referrals: "",
    finalNotes: "",
  })

  const [showReferral, setShowReferral] = useState(false)
  const [patientPolmedStatus, setPatientPolmedStatus] = useState<boolean>(false)
  const [currentReferralContext, setCurrentReferralContext] = useState<string>("")
  const [patientDetails, setPatientDetails] = useState<any>(null)

  // Enhanced doctor consultation state
  const [medications, setMedications] = useState<Medication[]>([])
  const [investigations, setInvestigations] = useState<string[]>([])
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([])
  const [smartSuggestionLogId, setSmartSuggestionLogId] = useState<number | null>(null)
  const [smartSuggestionLoading, setSmartSuggestionLoading] = useState(false)
  const smartSuggestionAbortRef = useRef<AbortController | null>(null)
  const smartSuggestionRequestIdRef = useRef(0)
  const [activeInput, setActiveInput] = useState<string>("")
  const processingOfflineQueueRef = useRef(false)
  const syncFromServerRef = useRef<(() => Promise<void>) | null>(null)

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

  const [specialistCatalog, setSpecialistCatalog] = useState<SpecialistDefinition[]>([])
  const [selectedSpecialists, setSelectedSpecialists] = useState<string[]>([])
  const [specialistNotes, setSpecialistNotes] = useState<Record<string, SpecialistNoteDraft>>({})
  const [workflowStatusById, setWorkflowStatusById] = useState<Record<string, WorkflowStatusSnapshot>>({})
  const lastSyncedSpecialistsRef = useRef<string[] | null>(null)
  const syncingSpecialistsRef = useRef(false)
  const [helperPopoverOpen, setHelperPopoverOpen] = useState<Record<string, { procedures?: boolean; medications?: boolean }>>({})
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, DocumentUploadDraft>>({})
  const [recentUploadsByKey, setRecentUploadsByKey] = useState<Record<string, PatientDocument[]>>({})
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState<string | null>(null)
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(() =>
    composeWorkflowSteps({
      userRole,
      selectedSpecialists: [],
      specialistCatalog: [],
      statusLookup: {},
      previousSteps: [],
    }),
  )

  useEffect(() => {
    setWorkflowSteps((prev) =>
      composeWorkflowSteps({
        userRole,
        selectedSpecialists,
        specialistCatalog,
        statusLookup: workflowStatusById,
        previousSteps: prev,
      }),
    )
  }, [userRole, selectedSpecialists, specialistCatalog, workflowStatusById])

  // Fetch patient details and POLMED status
  useEffect(() => {
    let isMounted = true
    apiService
      .getPatient(Number(patientId))
      .then((response) => {
        if (!isMounted) return
        if (response.success && response.data) {
          setPatientDetails(response.data)
          // Use is_palmed_member from database instead of checking medical_aid_number
          setPatientPolmedStatus(response.data.is_palmed_member || false)
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch patient details", error)
      })

    return () => {
      isMounted = false
    }
  }, [patientId])

  useEffect(() => {
    let isMounted = true
    apiService
      .getSpecialistCatalog()
      .then((response) => {
        if (!isMounted) return
        if (response.success && Array.isArray(response.data)) {
          setSpecialistCatalog(response.data)
        } else if (!response.success && response.error) {
          toast({ title: "Unable to load specialists", description: response.error, variant: "destructive" })
        }
      })
      .catch((error) => {
        if (isMounted) {
          console.warn("Failed to fetch specialist catalog", error)
          toast({
            title: "Unable to load specialists",
            description: "Specialist catalog could not be retrieved.",
            variant: "destructive",
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [toast])

  useEffect(() => {
    if (!specialistCatalog.length) return
    setSelectedSpecialists((prev) => orderSpecialists(prev, specialistCatalog))
  }, [specialistCatalog])

  useEffect(() => {
    setSpecialistNotes((prev) => {
      const next = { ...prev }
      let mutated = false
      Object.keys(next).forEach((key) => {
        if (!selectedSpecialists.includes(key)) {
          delete next[key]
          mutated = true
        }
      })
      return mutated ? next : prev
    })
  }, [selectedSpecialists])

  useEffect(() => {
    if (!visitId || !canEditSpecialistSelection) {
      return
    }

    const orderedSelection = orderSpecialists(selectedSpecialists, specialistCatalog)
    const lastSynced = lastSyncedSpecialistsRef.current

    const hasSyncedSnapshot = Array.isArray(lastSynced)
    if (hasSyncedSnapshot && arraysEqual(lastSynced, orderedSelection)) {
      return
    }

    if (syncingSpecialistsRef.current) {
      return
    }

    let isActive = true
    syncingSpecialistsRef.current = true

    apiService
      .updateVisitSpecialists(visitId, orderedSelection)
      .then((response) => {
        if (!isActive) return

        if (response.success && Array.isArray(response.data?.specialist_stages)) {
          const reconciled = orderSpecialists(response.data.specialist_stages, specialistCatalog)
          lastSyncedSpecialistsRef.current = reconciled
          if (!arraysEqual(reconciled, orderedSelection)) {
            setSelectedSpecialists(reconciled)
          }
        } else if (response.success) {
          lastSyncedSpecialistsRef.current = orderedSelection
        } else {
          toast({
            title: "Unable to update visit specialists",
            description: response.error || "The specialist assignment could not be saved.",
            variant: "destructive",
          })
        }
      })
      .catch((error) => {
        if (!isActive) return
        console.warn("Failed to update visit specialists", error)
        toast({
          title: "Unable to update visit specialists",
          description: "An unexpected error occurred while saving specialist assignments.",
          variant: "destructive",
        })
      })
      .finally(() => {
        syncingSpecialistsRef.current = false
      })

    return () => {
      isActive = false
    }
  }, [visitId, selectedSpecialists, specialistCatalog, toast, canEditSpecialistSelection])

  const displayWorkflowSteps = useMemo(() => {
    const canViewAllSpecialists = normalizedUserRole === "administrator"

    return workflowSteps.filter((step) => {
      if (step.isSpecialist) {
        if (canViewAllSpecialists) {
          return true
        }
        return rolesAlign(step.role, userRole)
      }

      if (isSpecialistRole) {
        return rolesAlign(step.role, userRole)
      }

      return true
    })
  }, [isSpecialistRole, normalizedUserRole, workflowSteps, userRole])

  const visibleStepIds = useMemo(() => new Set(displayWorkflowSteps.map((step) => step.id)), [displayWorkflowSteps])

  const activeStepId = useMemo(() => {
    const current = workflowSteps[currentStep]
    if (current && visibleStepIds.has(current.id)) {
      return current.id
    }
    return displayWorkflowSteps[0]?.id
  }, [currentStep, displayWorkflowSteps, visibleStepIds, workflowSteps])
  const hasVisibleSteps = displayWorkflowSteps.length > 0

  const toggleSpecialistSelection = (specialistType: string) => {
    if (!canEditSpecialistSelection) return
    setSelectedSpecialists((prev) => {
      const exists = prev.includes(specialistType)
      const next = exists ? prev.filter((value) => value !== specialistType) : [...prev, specialistType]
      return orderSpecialists(next, specialistCatalog)
    })
  }

  const selectedSpecialistCount = selectedSpecialists.length

  const setSpecialistNoteDraft = (specialistType: string, draft: SpecialistNoteDraft) => {
    setSpecialistNotes((prev) => ({
      ...prev,
      [specialistType]: {
        ...(prev[specialistType] || {}),
        ...draft,
      },
    }))
  }

  const updateSpecialistNoteField = (
    specialistType: string,
    field: keyof SpecialistNoteDraft,
    value: SpecialistNoteDraft[typeof field],
  ) => {
    setSpecialistNotes((prev) => {
      const existing = prev[specialistType] || { content: "" }
      return {
        ...prev,
        [specialistType]: {
          ...existing,
          [field]: value,
        },
      }
    })
  }

  useEffect(() => {
    const current = workflowSteps[currentStep]
    if (current && visibleStepIds.has(current.id)) {
      return
    }

    const firstVisible = displayWorkflowSteps[0]
    if (firstVisible) {
      const targetIndex = workflowSteps.findIndex((step) => step.id === firstVisible.id)
      if (targetIndex >= 0 && targetIndex !== currentStep) {
        setCurrentStep(targetIndex)
      }
    }
  }, [currentStep, displayWorkflowSteps, visibleStepIds, workflowSteps])

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

  // Smart text analysis fallback when backend is unreachable
  const buildHeuristicSuggestions = useCallback((text: string, context: string): SmartSuggestion[] => {
    const suggestions: SmartSuggestion[] = []
    const textLower = text.toLowerCase()

    if (context === "diagnosis" || context === "assessment") {
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
      if (textLower.includes("fever") || textLower.includes("pyrexia")) {
        suggestions.push({
          type: "icd10",
          text: "Fever, unspecified",
          code: "R50.9",
          confidence: 0.85,
        })
      }
    }

    if (context === "treatment" || context === "assessment") {
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
      if (textLower.includes("diabetes") || textLower.includes("sugar")) {
        suggestions.push({
          type: "medication",
          text: "Metformin 500mg BD",
          confidence: 0.82,
        })
      }
    }

    return suggestions
  }, [])

  const normalizeSmartSuggestion = (item: SmartSuggestionRecord): SmartSuggestion => {
    const normalizedType = item.type === "icd10" || item.type === "medication" || item.type === "investigation"
      ? item.type
      : "icd10"

    return {
      type: normalizedType,
      text: typeof item.text === "string" ? item.text : "",
      code: typeof item.code === "string" && item.code.length > 0 ? item.code : undefined,
      confidence:
        typeof item.confidence === "number" && !Number.isNaN(item.confidence)
          ? Math.max(0, Math.min(1, item.confidence))
          : 0,
    }
  }

  const getConfidenceWidthClass = (confidence?: number) => {
    const value = typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : 0
    if (value >= 0.95) return "w-full"
    if (value >= 0.8) return "w-5/6"
    if (value >= 0.6) return "w-3/4"
    if (value >= 0.4) return "w-1/2"
    if (value >= 0.2) return "w-1/3"
    return value > 0 ? "w-1/6" : "w-0"
  }

  const requestSmartSuggestions = useCallback(
    async (text: string, context: string) => {
      const trimmed = text.trim()

      if (!trimmed) {
        if (smartSuggestionAbortRef.current) {
          smartSuggestionAbortRef.current.abort()
          smartSuggestionAbortRef.current = null
        }
        smartSuggestionRequestIdRef.current += 1
        setSmartSuggestions([])
        setSmartSuggestionLogId(null)
        return
      }

      setActiveInput(context)
      smartSuggestionRequestIdRef.current += 1
      const requestId = smartSuggestionRequestIdRef.current

      if (typeof AbortController !== "undefined") {
        if (smartSuggestionAbortRef.current) {
          smartSuggestionAbortRef.current.abort()
        }
        smartSuggestionAbortRef.current = new AbortController()
      }

      const signal = smartSuggestionAbortRef.current?.signal
      const fallbackSuggestions = buildHeuristicSuggestions(trimmed, context)
      setSmartSuggestions(fallbackSuggestions)
      setSmartSuggestionLogId(null)

      const suggestionType =
        context === "diagnosis"
          ? "icd10"
          : context === "treatment"
            ? "medication"
            : "all"

      try {
        setSmartSuggestionLoading(true)
        const response = await apiService.getSmartSuggestions(
          {
            input_text: trimmed,
            suggestion_type: suggestionType,
            patient_context: {
              patientId,
              visitId,
              userRole,
              username,
              activeInput: context,
              workflowStep: workflowSteps[currentStep]?.id,
              vitals: vitalSigns,
              clinicalNotes,
            },
          },
          { signal },
        )

        if (requestId !== smartSuggestionRequestIdRef.current) {
          return
        }

        if (response.success && response.data) {
          const serverSuggestions = Array.isArray(response.data.suggestions)
            ? response.data.suggestions.map(normalizeSmartSuggestion)
            : []
          setSmartSuggestions(serverSuggestions.length ? serverSuggestions : fallbackSuggestions)
          setSmartSuggestionLogId(response.data.log_id ?? null)
        } else {
          setSmartSuggestions(fallbackSuggestions)
          setSmartSuggestionLogId(null)
        }
      } catch (error) {
        if ((error as any)?.name === "AbortError") {
          return
        }
        console.warn("Smart suggestion fetch failed:", error)
        if (requestId === smartSuggestionRequestIdRef.current) {
          setSmartSuggestions(buildHeuristicSuggestions(trimmed, context))
          setSmartSuggestionLogId(null)
        }
      } finally {
        if (requestId === smartSuggestionRequestIdRef.current) {
          setSmartSuggestionLoading(false)
        }
        if (smartSuggestionAbortRef.current && smartSuggestionAbortRef.current.signal === signal) {
          smartSuggestionAbortRef.current = null
        }
      }
    },
    [
      buildHeuristicSuggestions,
      patientId,
      visitId,
      userRole,
      username,
      workflowSteps,
      currentStep,
      vitalSigns,
      clinicalNotes,
    ],
  )

  const searchICD10 = useCallback(async (query: string) => {
    if (query.length < 1) {
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

    if (icd10SearchQuery.length >= 1) {
      searchTimeoutRef.current = setTimeout(() => {
        searchICD10(icd10SearchQuery)
      }, 150)
    } else {
      setIcd10SearchResults([])
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [icd10SearchQuery, searchICD10])

  useEffect(() => {
    return () => {
      if (smartSuggestionAbortRef.current) {
        smartSuggestionAbortRef.current.abort()
        smartSuggestionAbortRef.current = null
      }
    }
  }, [])

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

  const canAccessStep = (step: WorkflowStep) => canAccessStepForRole(step, workflowSteps, userRole)

  const completeCurrentStep = () => {
    if (completingStep) return

    const doComplete = async () => {
      setCompletingStep(true)

      const currentStepData = workflowSteps[currentStep]
      if (!currentStepData) {
        toast({
          title: "No step selected",
          description: "Select a workflow stage before completing.",
          variant: "destructive",
        })
        return
      }

      const unmetDependencies = listIncompleteDependencies(currentStepData.id, workflowSteps)
      if (unmetDependencies.length > 0) {
        const dependencyTitles = workflowSteps
          .filter((step) => unmetDependencies.includes(step.id))
          .map((step) => step.title)
        toast({
          title: "Step locked",
          description: `Complete ${dependencyTitles.join(", ")} first.`,
          variant: "destructive",
        })
        return
      }

      if (!canAccessStepForRole(currentStepData, workflowSteps, userRole, { allowCompleted: false })) {
        toast({
          title: "Step unavailable",
          description: "This stage is not assigned to you or is not yet unlocked.",
          variant: "destructive",
        })
        return
      }

      const submissionPayload: WorkflowSubmissionPayload = {
        vitalSigns: { ...vitalSigns },
        clinicalNotes: { ...clinicalNotes },
        medications: medications.map((med) => ({ ...med })),
        investigations: [...investigations],
        selectedICD10Codes: selectedICD10Codes.map((code) => ({ ...code })),
        persistVitals: false,
        specialistNotes: {},
      }

      if (currentStepData.isSpecialist && currentStepData.specialistType) {
        const specialistType = currentStepData.specialistType
        const noteDraft = specialistNotes[specialistType]
        const content = noteDraft?.content?.trim()
        if (!content) {
          toast({
            title: "❌ Add specialist notes",
            description: `Document findings for ${currentStepData.title} before completing the stage.`,
            variant: "destructive",
          })
          return
        }

        const config = SPECIALIST_NOTE_CONFIG[specialistType]
        if (config) {
          const normalizedContent = content.toLowerCase()
          const missingSections = config.requiredSections.filter(
            (section) => !normalizedContent.includes(section.toLowerCase()),
          )
          if (missingSections.length) {
            toast({
              title: "❌ Complete required sections",
              description: `Include: ${missingSections.join(", ")}.`,
              variant: "destructive",
            })
            return
          }

          const requiredDropdowns = config.requiredDropdowns ?? []
          if (requiredDropdowns.length) {
            const dropdownLabelMap = new Map(config.dropdowns.map((dropdown) => [dropdown.field, dropdown.label]))
            const missingDropdowns = requiredDropdowns.filter((field) => {
              const value = readDropdownValue(noteDraft, field)
              return !value || !value.trim()
            })

            if (missingDropdowns.length) {
              const missingLabels = missingDropdowns.map((field) => dropdownLabelMap.get(field) || field)
              toast({
                title: "❌ Select structured details",
                description: `Complete: ${missingLabels.join(", ")}.`,
                variant: "destructive",
              })
              return
            }
          }

          // Enhanced validation: Check minimum content length for clinical validity
          if (content.length < 50) {
            toast({
              title: "❌ Insufficient clinical details",
              description: `Please provide more detailed documentation for ${currentStepData.title}. Minimum 50 characters required.`,
              variant: "destructive",
            })
            return
          }

          // Enhanced validation: Check for follow-up requirements when indicated
          if (noteDraft?.followUpRequired && !noteDraft?.followUpDate) {
            toast({
              title: "❌ Follow-up date required",
              description: "Please specify a follow-up date when follow-up is required.",
              variant: "destructive",
            })
            return
          }
        }

        submissionPayload.specialistNotes = {
          [specialistType]: {
            content,
            noteType: currentStepData.noteType,
            followUpRequired: noteDraft?.followUpRequired,
            followUpDate: noteDraft?.followUpDate,
          },
        }
      }

      // Enhanced validation for all workflow steps
      if (currentStepData.id === "nursing") {
        const hasVitalSigns = Object.values(submissionPayload.vitalSigns).some(value => value.trim() !== "")
        const hasNursingNotes = submissionPayload.clinicalNotes.nursingAssessment?.trim()
        
        if (!hasVitalSigns && !hasNursingNotes) {
          toast({
            title: "❌ Incomplete nursing assessment",
            description: "Please record vital signs or add nursing assessment notes before completing this step.",
            variant: "destructive",
          })
          return
        }

        // Validate nursing assessment minimum length
        if (hasNursingNotes && hasNursingNotes.length < 20) {
          toast({
            title: "❌ Insufficient nursing notes",
            description: "Please provide more detailed nursing assessment (minimum 20 characters).",
            variant: "destructive",
          })
          return
        }

        // Validate vital signs format if provided
        if (hasVitalSigns) {
          const { bloodPressureSystolic, bloodPressureDiastolic, pulse, temperature } = submissionPayload.vitalSigns
          
          if (bloodPressureSystolic && !bloodPressureDiastolic) {
            toast({
              title: "❌ Incomplete blood pressure",
              description: "Please provide both systolic and diastolic blood pressure readings.",
              variant: "destructive",
            })
            return
          }

          if (bloodPressureDiastolic && !bloodPressureSystolic) {
            toast({
              title: "❌ Incomplete blood pressure",
              description: "Please provide both systolic and diastolic blood pressure readings.",
              variant: "destructive",
            })
            return
          }
        }
      }

      if (currentStepData.id === "doctor") {
        const diagSegments: string[] = []
        if (submissionPayload.clinicalNotes.icd10Codes)
          diagSegments.push(`ICD-10: ${submissionPayload.clinicalNotes.icd10Codes}`)
        if (submissionPayload.clinicalNotes.doctorDiagnosis)
          diagSegments.push(`Diagnosis: ${submissionPayload.clinicalNotes.doctorDiagnosis}`)
        const diagContent = diagSegments.join("\n")

        const treatmentSegments: string[] = []
        if (submissionPayload.clinicalNotes.treatmentPlan)
          treatmentSegments.push(`Treatment: ${submissionPayload.clinicalNotes.treatmentPlan}`)
        if (submissionPayload.medications.length > 0) {
          treatmentSegments.push(
            `Medications: ${submissionPayload.medications
              .map((m) => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`)
              .join(", ")}`,
          )
        }
        if (submissionPayload.investigations.length > 0) {
          treatmentSegments.push(`Investigations: ${submissionPayload.investigations.join(", ")}`)
        }
        if (submissionPayload.clinicalNotes.referrals) {
          treatmentSegments.push(`Referrals: ${submissionPayload.clinicalNotes.referrals}`)
        }
        if (submissionPayload.clinicalNotes.followUpInstructions) {
          treatmentSegments.push(`Follow-up instructions: ${submissionPayload.clinicalNotes.followUpInstructions}`)
        }
        const treatContent = treatmentSegments.join("\n")

        if (!diagContent && !treatContent) {
          toast({
            title: "❌ Incomplete doctor consultation",
            description: "Please add a diagnosis and/or treatment plan before completing this step.",
            variant: "destructive",
          })
          return
        }

        // Validate diagnosis minimum length
        const diagnosis = submissionPayload.clinicalNotes.doctorDiagnosis?.trim()
        if (diagnosis && diagnosis.length < 10) {
          toast({
            title: "❌ Insufficient diagnosis details",
            description: "Please provide a more detailed diagnosis (minimum 10 characters).",
            variant: "destructive",
          })
          return
        }

        // Validate treatment plan minimum length
        const treatment = submissionPayload.clinicalNotes.treatmentPlan?.trim()
        if (treatment && treatment.length < 10) {
          toast({
            title: "❌ Insufficient treatment details",
            description: "Please provide a more detailed treatment plan (minimum 10 characters).",
            variant: "destructive",
          })
          return
        }

        // Validate medication completeness
        for (const med of submissionPayload.medications) {
          if (!med.name?.trim() || !med.dosage?.trim() || !med.frequency?.trim() || !med.duration?.trim()) {
            toast({
              title: "❌ Incomplete medication details",
              description: "Please complete all medication fields (name, dosage, frequency, duration).",
              variant: "destructive",
            })
            return
          }
        }

        // Validate follow-up date when follow-up is required
        if (submissionPayload.clinicalNotes.followUpRequired && !submissionPayload.clinicalNotes.followUpDate?.trim()) {
          toast({
            title: "❌ Follow-up date required",
            description: "Please specify a follow-up date when follow-up is required.",
            variant: "destructive",
          })
          return
        }
      }

      if (currentStepData.id === "counseling") {
        const hasMentalHealthScreening = submissionPayload.clinicalNotes.mentalHealthScreening?.trim()
        const hasCounselingNotes = submissionPayload.clinicalNotes.counselingNotes?.trim()
        
        if (!hasMentalHealthScreening && !hasCounselingNotes) {
          toast({
            title: "❌ Incomplete counseling session",
            description: "Please add mental health screening results or counseling notes before completing this step.",
            variant: "destructive",
          })
          return
        }

        // Validate counseling notes minimum length
        if (hasCounselingNotes && hasCounselingNotes.length < 30) {
          toast({
            title: "❌ Insufficient counseling notes",
            description: "Please provide more detailed counseling documentation (minimum 30 characters).",
            variant: "destructive",
          })
          return
        }

        // Validate mental health screening minimum length
        if (hasMentalHealthScreening && hasMentalHealthScreening.length < 20) {
          toast({
            title: "❌ Insufficient screening details",
            description: "Please provide more detailed mental health screening (minimum 20 characters).",
            variant: "destructive",
          })
          return
        }
      }

      if (currentStepData.id === "closure") {
        const hasFinalNotes = submissionPayload.clinicalNotes.finalNotes?.trim()
        
        if (!hasFinalNotes) {
          toast({
            title: "❌ Incomplete file closure",
            description: "Please add final notes or summary before closing the file.",
            variant: "destructive",
          })
          return
        }

        // Validate final notes minimum length
        if (hasFinalNotes.length < 30) {
          toast({
            title: "❌ Insufficient closure summary",
            description: "Please provide a more comprehensive summary for file closure (minimum 30 characters).",
            variant: "destructive",
          })
          return
        }
      }

      const isOffline = typeof navigator !== "undefined" && !offlineManager.getConnectionStatus?.()
      const updatedSteps = [...workflowSteps]

      if (isOffline) {
        submissionPayload.persistVitals = currentStepData.id === "nursing"
        queueOfflineSubmission({
          patientId: Number(patientId),
          visitId,
          stepId: currentStepData.id,
          username,
          payload: submissionPayload,
        })

        updatedSteps[currentStep] = {
          ...currentStepData,
          status: "completed",
          completedBy: `${username} (offline)`,
          completedAt: new Date().toISOString(),
        }

        const nextIdx = currentStep + 1
        if (nextIdx < updatedSteps.length) {
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
                title: `${currentStepData.title} captured offline`,
                description: `${nextStep.title} is waiting for the ${nextRoleLabel}.`,
              })
            }
          }
        }

        setWorkflowSteps(updatedSteps)
        if (currentStep >= updatedSteps.length - 1) {
          toast({
            title: "Workflow completed successfully!",
            description: "All clinical workflow steps have been completed offline and will sync when connection is restored.",
          })
          onWorkflowComplete()
        }
        toast({
          title: `${currentStepData.title} queued for sync`,
          description: "Step captured offline and will sync automatically once you reconnect.",
        })
        return
      }

      try {
        const result = await submitStepToServer({
          stepId: currentStepData.id,
          patientId: Number(patientId),
          visitId,
          payload: { ...submissionPayload, persistVitals: false },
        })

        if (result.visitId && result.visitId !== visitId) {
          setVisitId(result.visitId)
        }

        if (result.warnings.length) {
          result.warnings.forEach((message) =>
            toast({ title: "⚠️ Partial success", description: message, variant: "default" }),
          )
        } else {
          // Success message for successful step completion
          let successDescription = "Your clinical data has been saved and synced to the server."
          
          if (currentStepData.id === "doctor") {
            successDescription = "Doctor consultation notes, diagnosis, and treatment plan have been successfully submitted and saved."
          } else if (currentStepData.id === "counseling") {
            successDescription = "Counseling session notes and mental health screening have been successfully submitted and saved."
          } else if (currentStepData.id === "closure") {
            successDescription = "Patient file has been closed successfully. All clinical workflow steps are now complete."
          }
          
          toast({
            title: `✅ ${currentStepData.title} Completed Successfully!`,
            description: successDescription,
            duration: 5000,
          })
        }
      } catch (error) {
        const description = error instanceof Error ? error.message : String(error)
        toast({ title: "Save failed", description, variant: "destructive" })
        throw error
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
      } else {
        onWorkflowComplete()
      }

      setWorkflowSteps(updatedSteps)
      await processOfflineQueue()
    }

    doComplete()
      .catch((error) => {
        if (error instanceof Error) {
          console.warn("Workflow completion error", error)
        }
      })
      .finally(() => {
        setCompletingStep(false)
      })
  }

  const updateVitalSigns = (field: keyof VitalSigns, value: string) => {
    setVitalSigns((prev) => {
      const updated = { ...prev, [field]: value }
      // Real-time validation of all vitals
      const validation = validateAllVitalSigns({
        systolic_bp: updated.bloodPressureSystolic,
        diastolic_bp: updated.bloodPressureDiastolic,
        heart_rate: updated.pulse,
        temperature: updated.temperature,
        weight: updated.weight,
        height: updated.height,
        oxygen_saturation: updated.oxygenSaturation,
        respiratory_rate: updated.respiratoryRate,
      })
      setVitalsValidation(validation)
      return updated
    })
  }

  const updateClinicalNotes = (field: keyof ClinicalNotes, value: string) => {
    setClinicalNotes((prev) => ({ ...prev, [field]: value }))
  }

  const queueOfflineSubmission = useCallback(
    (entry: Omit<QueuedWorkflowSubmission, "id" | "createdAt">) => {
      const existing = readOfflineWorkflowQueue()
      const newEntry: QueuedWorkflowSubmission = {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        createdAt: Date.now(),
        patientId: entry.patientId,
        visitId: entry.visitId,
        stepId: entry.stepId,
        username: entry.username,
        payload: JSON.parse(JSON.stringify(entry.payload)) as WorkflowSubmissionPayload,
      }
      writeOfflineWorkflowQueue([...existing, newEntry])
      return newEntry
    },
    [],
  )

  const updateHelperPopoverState = (specialistType: string, kind: "procedures" | "medications", open: boolean) => {
    setHelperPopoverOpen((prev) => ({
      ...prev,
      [specialistType]: {
        ...(prev[specialistType] || {}),
        [kind]: open,
      },
    }))
  }

  const submitStepToServer = useCallback(
    async ({
      stepId,
      patientId: numericPatientId,
      visitId: providedVisitId,
      payload,
    }: {
      stepId: WorkflowStep["id"]
      patientId: number
      visitId?: number | null
      payload: WorkflowSubmissionPayload
    }): Promise<{ visitId: number; warnings: string[] }> => {
      let workingVisitId = providedVisitId ?? null

      if (!workingVisitId) {
        const created = await apiService.createVisit(numericPatientId, {
          specialists: selectedSpecialists,
        })
        if (!created.success || !created.data?.visit_id) {
          throw new Error(created.error || "Unable to create a visit record.")
        }
        workingVisitId = created.data.visit_id
        lastSyncedSpecialistsRef.current = null
      }

      const warnings: string[] = []
      const shouldPersistVitals = !!payload.persistVitals && stepId === "nursing"

      if (shouldPersistVitals) {
        const numberOrUndefined = (value?: string) => {
          if (!value || value.trim() === "") return undefined
          const parsed = Number(value)
          return Number.isNaN(parsed) ? undefined : parsed
        }

        const vitalsPayload = {
          systolic_bp: numberOrUndefined(payload.vitalSigns.bloodPressureSystolic),
          diastolic_bp: numberOrUndefined(payload.vitalSigns.bloodPressureDiastolic),
          heart_rate: numberOrUndefined(payload.vitalSigns.pulse),
          temperature: numberOrUndefined(payload.vitalSigns.temperature),
          weight: numberOrUndefined(payload.vitalSigns.weight),
          height: numberOrUndefined(payload.vitalSigns.height),
          oxygen_saturation: numberOrUndefined(payload.vitalSigns.oxygenSaturation),
          respiratory_rate: numberOrUndefined(payload.vitalSigns.respiratoryRate),
          nursing_notes: payload.clinicalNotes.nursingAssessment?.trim() || undefined,
        }

        const hasVitals = Object.values(vitalsPayload).some((value) => value !== undefined && value !== "")
        if (hasVitals) {
          const vitalsResponse = await apiService.addVitalSigns(workingVisitId, vitalsPayload)
          if (!vitalsResponse.success) {
            warnings.push(vitalsResponse.error || "Failed to sync vital signs.")
          }
        }
      }

      if (stepId === "nursing") {
        const content = payload.clinicalNotes.nursingAssessment?.trim() || "Nursing assessment completed."
        if (content) {
          const response = await apiService.createClinicalNote(workingVisitId, {
            note_type: "Assessment",
            content,
            follow_up_required: payload.clinicalNotes.followUpRequired || false,
            follow_up_date:
              payload.clinicalNotes.followUpRequired && payload.clinicalNotes.followUpDate
                ? payload.clinicalNotes.followUpDate
                : undefined,
          })
          if (!response.success) {
            warnings.push(response.error || "Failed to sync nursing assessment note.")
          }
        }
      }

      if (stepId === "doctor") {
        const parseList = (input?: string) =>
          (input || "")
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)

        const icd10String = payload.clinicalNotes.icd10Codes
        const diagSegments = [] as string[]
        if (icd10String) diagSegments.push(`ICD-10: ${icd10String}`)
        if (payload.clinicalNotes.doctorDiagnosis)
          diagSegments.push(`Diagnosis: ${payload.clinicalNotes.doctorDiagnosis}`)
        const diagContent = diagSegments.join("\n")

        const treatmentSegments = [] as string[]
        if (payload.clinicalNotes.treatmentPlan)
          treatmentSegments.push(`Treatment: ${payload.clinicalNotes.treatmentPlan}`)
        if (payload.medications.length > 0) {
          treatmentSegments.push(
            `Medications: ${payload.medications
              .map((m) => `${m.name} ${m.dosage} ${m.frequency} for ${m.duration}`)
              .join(", ")}`,
          )
        }
        if (payload.investigations.length > 0) {
          treatmentSegments.push(`Investigations: ${payload.investigations.join(", ")}`)
        }
        if (payload.clinicalNotes.referrals) {
          treatmentSegments.push(`Referrals: ${payload.clinicalNotes.referrals}`)
        }
        if (payload.clinicalNotes.followUpInstructions) {
          treatmentSegments.push(`Follow-up instructions: ${payload.clinicalNotes.followUpInstructions}`)
        }
        const treatContent = treatmentSegments.join("\n")

        if (!diagContent && !treatContent) {
          throw new Error("Add a diagnosis and/or treatment before saving.")
        }

        if (diagContent) {
          const response = await apiService.createClinicalNote(workingVisitId, {
            note_type: "Diagnosis",
            content: diagContent,
            icd10_codes: parseList(icd10String),
            follow_up_required: payload.clinicalNotes.followUpRequired || false,
            follow_up_date:
              payload.clinicalNotes.followUpRequired && payload.clinicalNotes.followUpDate
                ? payload.clinicalNotes.followUpDate
                : undefined,
          })
          if (!response.success) {
            throw new Error(response.error || "Failed to sync diagnosis note.")
          }
        }

        if (treatContent) {
          const response = await apiService.createClinicalNote(workingVisitId, {
            note_type: "Treatment",
            content: treatContent,
            medications_prescribed: payload.medications.map((m) => `${m.name} ${m.dosage} ${m.frequency}`),
            follow_up_required: payload.clinicalNotes.followUpRequired || false,
            follow_up_date:
              payload.clinicalNotes.followUpRequired && payload.clinicalNotes.followUpDate
                ? payload.clinicalNotes.followUpDate
                : undefined,
          })
          if (!response.success) {
            throw new Error(response.error || "Failed to sync treatment note.")
          }
        }
      }

      if (stepId.startsWith("specialist:")) {
        const specialistType = stepId.split(":")[1]
        const draft = payload.specialistNotes?.[specialistType]
        const content = draft?.content?.trim()
        if (!draft || !content) {
          throw new Error("Add specialist notes before saving.")
        }

        const fallbackNoteType =
          specialistCatalog.find((entry) => entry.specialist_type === specialistType)?.note_type ||
          formatSpecialistLabel(specialistType)

        const response = await apiService.createClinicalNote(workingVisitId, {
          note_type: (draft.noteType || fallbackNoteType) as CreateClinicalNoteRequest["note_type"],
          content,
          follow_up_required: Boolean(draft.followUpRequired),
          follow_up_date:
            draft.followUpRequired && draft.followUpDate ? draft.followUpDate : undefined,
        })

        if (!response.success) {
          throw new Error(response.error || "Failed to sync specialist note.")
        }
      }

      if (stepId === "counseling") {
        const content =
          [
            payload.clinicalNotes.mentalHealthScreening &&
              `Screening: ${payload.clinicalNotes.mentalHealthScreening}`,
            payload.clinicalNotes.counselingNotes && `Notes: ${payload.clinicalNotes.counselingNotes}`,
          ]
            .filter(Boolean)
            .join("\n") || "Counseling session completed."

        const response = await apiService.createClinicalNote(workingVisitId, {
          note_type: "Counseling",
          content,
          follow_up_required: payload.clinicalNotes.followUpRequired || false,
          follow_up_date:
            payload.clinicalNotes.followUpRequired && payload.clinicalNotes.followUpDate
              ? payload.clinicalNotes.followUpDate
              : undefined,
        })
        if (!response.success) {
          throw new Error(response.error || "Failed to sync counseling note.")
        }
      }

      if (stepId === "closure") {
        const content = payload.clinicalNotes.finalNotes?.trim() || "File closed."
        const response = await apiService.createClinicalNote(workingVisitId, {
          note_type: "Closure",
          content,
        })
        if (!response.success) {
          throw new Error(response.error || "Failed to sync closure note.")
        }
      }

      return { visitId: workingVisitId, warnings }
    },
    [selectedSpecialists, specialistCatalog],
  )

  const processOfflineQueue = useCallback(async () => {
    if (!offlineManager.getConnectionStatus?.()) return
    if (processingOfflineQueueRef.current) return
    processingOfflineQueueRef.current = true

    try {
      const queued = readOfflineWorkflowQueue()
      if (!queued.length) return

      const visitIdMap = new Map<number, number>()
      const remaining: QueuedWorkflowSubmission[] = []
      let syncedAny = false

      const ordered = [...queued].sort((a, b) => a.createdAt - b.createdAt)

      for (const item of ordered) {
        const targetPatientId = Number(item.patientId)
        const mappedVisitId = visitIdMap.get(targetPatientId) ?? item.visitId ?? null
        try {
          const result = await submitStepToServer({
            stepId: item.stepId,
            patientId: targetPatientId,
            visitId: mappedVisitId,
            payload: item.payload,
          })

          visitIdMap.set(targetPatientId, result.visitId)
          if (targetPatientId === Number(patientId) && (!visitId || visitId !== result.visitId)) {
            setVisitId(result.visitId)
          }
          if (result.warnings.length) {
            result.warnings.forEach((message) =>
              toast({ title: "Sync warning", description: message, variant: "destructive" }),
            )
          }
          syncedAny = true
        } catch (error) {
          console.warn("Failed to replay offline workflow submission", error)
          remaining.push(item)
        }
      }

      writeOfflineWorkflowQueue(remaining)

      if (syncedAny) {
        toast({
          title: "Offline workflow synced",
          description: "Pending workflow steps were sent to the server.",
        })
        await syncFromServerRef.current?.()
      }
    } finally {
      processingOfflineQueueRef.current = false
    }
  }, [patientId, submitStepToServer, toast, visitId])

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleOnline = () => {
      processOfflineQueue().catch((error) => console.warn("Failed to process offline queue", error))
    }

    window.addEventListener("online", handleOnline)
    processOfflineQueue().catch((error) => console.warn("Failed to process offline queue", error))

    return () => {
      window.removeEventListener("online", handleOnline)
    }
  }, [processOfflineQueue])

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

  const selectWorkflowStep = useCallback(
    (stepId: string) => {
      if (!visibleStepIds.has(stepId)) {
        return
      }

      const targetIndex = workflowSteps.findIndex((step) => step.id === stepId)
      if (targetIndex >= 0) {
        setCurrentStep(targetIndex)
      }
    },
    [visibleStepIds, workflowSteps],
  )

  const updateDocumentDraft = useCallback((key: string, patch: Partial<DocumentUploadDraft>) => {
    setDocumentDrafts((prev) => {
      const existing = prev[key] ?? { file: null, documentType: "report", notes: "", isConfidential: false }
      return {
        ...prev,
        [key]: {
          ...existing,
          ...patch,
        },
      }
    })
  }, [])

  const resetDocumentDraft = useCallback(
    (key: string) => {
      setDocumentDrafts((prev) => {
        const existing = prev[key]
        if (!existing) {
          return prev
        }
        return {
          ...prev,
          [key]: {
            ...existing,
            file: null,
            notes: "",
          },
        }
      })

      const input = fileInputsRef.current[key]
      if (input) {
        input.value = ""
      }
    },
    [fileInputsRef],
  )

  const ensureActiveVisit = useCallback(async (): Promise<number | null> => {
    if (visitId) {
      return visitId
    }

    const created = await apiService.createVisit(Number(patientId), {})
    if (!created.success || !created.data?.visit_id) {
      toast({
        title: "Unable to start visit",
        description: created.error || "Could not create a visit before uploading documents.",
        variant: "destructive",
      })
      return null
    }

    const newVisitId = created.data.visit_id
    setVisitId(newVisitId)
    return newVisitId
  }, [patientId, toast, visitId])

  const handleDocumentUpload = useCallback(
    async (specialistKey: string, specialistType: string, workflowStep: string, draft: DocumentUploadDraft) => {
      if (!draft.file) {
        toast({ title: "Select a file first", description: "Choose a document to upload." })
        return
      }

      if (typeof window !== "undefined" && !navigator.onLine) {
        toast({
          title: "Offline",
          description: "Connect to the internet before uploading supporting documents.",
          variant: "destructive",
        })
        return
      }

      setUploadingDocumentKey(specialistKey)
      try {
        const visitForUpload = await ensureActiveVisit()
        if (!visitForUpload) {
          return
        }

        const response = await apiService.uploadPatientDocument(Number(patientId), {
          file: draft.file,
          visitId: visitForUpload,
          documentType: draft.documentType,
          specialistType,
          workflowStep,
          isConfidential: draft.isConfidential,
          notes: draft.notes.trim().length ? draft.notes.trim() : undefined,
        })

        if (!response.success || !response.data) {
          toast({
            title: "Upload failed",
            description: response.error || "The document could not be uploaded.",
            variant: "destructive",
          })
          return
        }

        const uploadedDocument = response.data
        toast({
          title: "Document uploaded",
          description: uploadedDocument.file_name || "Supporting document attached.",
        })

        setRecentUploadsByKey((prev) => {
          const current = prev[specialistKey] ?? []
          return {
            ...prev,
            [specialistKey]: [uploadedDocument, ...current].slice(0, MAX_RECENT_UPLOADS),
          }
        })
        resetDocumentDraft(specialistKey)
      } catch (error: any) {
        console.error("Document upload error", error)
        toast({
          title: "Upload error",
          description: error?.message || "Unexpected error while uploading the document.",
          variant: "destructive",
        })
      } finally {
        setUploadingDocumentKey((current) => (current === specialistKey ? null : current))
      }
    },
    [ensureActiveVisit, patientId, resetDocumentDraft, toast],
  )

  const applySuggestion = (suggestion: SmartSuggestion) => {
    const logId = smartSuggestionLogId
    switch (suggestion.type) {
      case "icd10":
        if (suggestion.code && !clinicalNotes.icd10Codes.includes(suggestion.code)) {
          const existingCodes = clinicalNotes.icd10Codes ? clinicalNotes.icd10Codes + ", " : ""
          updateClinicalNotes("icd10Codes", existingCodes + suggestion.code)
        }
        break
      case "medication":
        const [name] = suggestion.text.split(" ")
        addQuickMedication(name.toLowerCase())
        break
      case "investigation":
        if (suggestion.text && !investigations.includes(suggestion.text)) {
          setInvestigations((prev) => [...prev, suggestion.text])
        }
        break
    }
    setSmartSuggestions([])
    setSmartSuggestionLogId(null)

    if (logId) {
      const feedbackScore = suggestion.confidence
        ? Math.min(5, Math.max(1, Math.round(suggestion.confidence * 5)))
        : undefined
      apiService
        .sendSmartSuggestionFeedback(logId, {
          was_accepted: true,
          feedback_score: feedbackScore,
          feedback_notes: suggestion.code ? `Accepted ${suggestion.code}` : suggestion.text,
        })
        .catch((error: any) => console.warn("Failed to record smart suggestion feedback:", error))
    }
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
        const workflow = await apiService.getWorkflowStatus(vId)
        if (workflow.success && Array.isArray(workflow.data)) {
          const selectedKeys: string[] = []
          const statusMap: Record<string, WorkflowStatusSnapshot> = {}

          for (const stage of workflow.data as any[]) {
            const stageName = String(stage.stage || "")
            const specialistType = stage.specialist_type
            const normalizedStage = stageName.toLowerCase()

            if (specialistType) {
              selectedKeys.push(specialistType)
              const stepId = `specialist:${specialistType}`
              statusMap[stepId] = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                role: stage.role,
                noteType: stage.note_type,
                isSpecialist: true,
                specialistType,
                title: stageName,
              }
              continue
            }

            if (normalizedStage.includes("registration")) {
              statusMap.registration = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                title: stageName,
              }
            } else if (normalizedStage.includes("nursing")) {
              statusMap.nursing = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                title: stageName,
                role: "nurse",
              }
            } else if (normalizedStage.includes("doctor")) {
              statusMap.doctor = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                title: stageName,
                role: "doctor",
              }
            } else if (normalizedStage.includes("counsel")) {
              statusMap.counseling = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                title: stageName,
                role: "social_worker",
              }
            } else if (normalizedStage.includes("closure")) {
              statusMap.closure = {
                completed: Boolean(stage.completed),
                completedAt: stage.completed_at,
                title: stageName,
                role: "doctor",
              }
            }
          }

          setWorkflowStatusById(statusMap)

          const orderedKeys = orderSpecialists(selectedKeys, specialistCatalog)
          if (!arraysEqual(orderedKeys, selectedSpecialists)) {
            setSelectedSpecialists(orderedKeys)
            lastSyncedSpecialistsRef.current = orderedKeys
          }

          setWorkflowSteps((prev) =>
            composeWorkflowSteps({
              userRole,
              selectedSpecialists: orderedKeys,
              specialistCatalog,
              statusLookup: statusMap,
              previousSteps: prev,
            }),
          )

          const recomposed = composeWorkflowSteps({
            userRole,
            selectedSpecialists: orderedKeys,
            specialistCatalog,
            statusLookup: statusMap,
            previousSteps: workflowSteps,
          })

          const firstActionableLocalIdx = recomposed.findIndex((step) =>
            step.status !== "completed" &&
            canAccessStepForRole(step, recomposed, userRole, { allowCompleted: false }),
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

        let importedIcd10Codes: string[] = []
        try {
          const diagnosisNode = (notes || []).find((n: any) => n.note_type === "Diagnosis")
          if (diagnosisNode) {
            const source = diagnosisNode.icd10_codes ?? diagnosisNode.content
            if (Array.isArray(source)) {
              importedIcd10Codes = source.filter((code: any) => typeof code === "string" && code.trim().length > 0)
            } else if (typeof source === "string" && source.trim().length > 0) {
              try {
                const parsed = JSON.parse(source)
                if (Array.isArray(parsed)) {
                  importedIcd10Codes = parsed.filter((code: any) => typeof code === "string" && code.trim().length > 0)
                }
              } catch {
                const extracted = source.match(/ICD-10\s*:\s*([^\n]+)/i)
                const raw = extracted ? extracted[1] : source
                importedIcd10Codes = raw
                  .split(/[,;\n]/)
                  .map((value) => value.trim())
                  .filter((value) => value.length > 0 && /^[A-Za-z0-9.]+$/.test(value))
              }
            }
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
            icd10Codes:
              prev.icd10Codes || (importedIcd10Codes.length > 0 ? importedIcd10Codes.join(", ") : prev.icd10Codes),
          }))
        }

        if (importedIcd10Codes.length > 0) {
          setSelectedICD10Codes((prev) => {
            if (prev.length > 0) return prev
            return importedIcd10Codes.map((code) => ({ code, description: code }))
          })
        }
      }
    }
    syncFromServerRef.current = syncFromServer
    syncFromServer()
  }, [patientId, userRole])

  const saveVitals = async () => {
    // Check for required fields
    const requiredFields = [
      { value: vitalSigns.bloodPressureSystolic, name: 'Blood Pressure (Systolic)' },
      { value: vitalSigns.bloodPressureDiastolic, name: 'Blood Pressure (Diastolic)' },
      { value: vitalSigns.pulse, name: 'Pulse/Heart Rate' },
      { value: vitalSigns.temperature, name: 'Temperature' },
      { value: vitalSigns.weight, name: 'Weight' },
      { value: vitalSigns.height, name: 'Height' },
      { value: vitalSigns.oxygenSaturation, name: 'Oxygen Saturation' },
      { value: vitalSigns.respiratoryRate, name: 'Respiratory Rate' },
    ]

    const emptyFields = requiredFields.filter(field => !field.value || field.value.trim() === '')
    
    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(f => f.name).join(', ')
      toast({
        title: "❌ Required Fields Missing",
        description: `Please complete the following fields: ${fieldNames}`,
        variant: "destructive",
        duration: 6000,
      })
      return
    }

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

    // Validate vital signs before saving
    const validation = validateAllVitalSigns(payload)
    
    // Check for critical values - warn but allow save
    if (validation.anyCritical) {
      const criticalFields: string[] = []
      if (validation.systolic_bp.status === "critical") criticalFields.push(`Systolic: ${validation.systolic_bp.message}`)
      if (validation.diastolic_bp.status === "critical") criticalFields.push(`Diastolic: ${validation.diastolic_bp.message}`)
      if (validation.heart_rate.status === "critical") criticalFields.push(`HR: ${validation.heart_rate.message}`)
      if (validation.temperature.status === "critical") criticalFields.push(`Temp: ${validation.temperature.message}`)
      
      toast({
        title: "⚠️ Critical Values - Review Required",
        description: criticalFields.slice(0, 2).join(" | "),
        variant: "destructive",
      })
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

      toast({ 
        title: "✅ Vital Signs Submitted Successfully!", 
        description: "All vital signs have been recorded and saved to the patient record. You can now proceed to the next step.", 
        duration: 5000 
      })
      completeCurrentStep()
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e), variant: "destructive" })
    } finally {
      setSavingVitals(false)
    }
  }

  const getStepContent = (step: WorkflowStep) => {
    if (step.isSpecialist && step.specialistType) {
      const noteDraft: SpecialistNoteDraft = specialistNotes[step.specialistType] || {
        content: "",
        followUpRequired: false,
        followUpDate: "",
        noteType: step.noteType,
      }

      const Icon = SPECIALIST_ICON_MAP[step.specialistType] ?? Clipboard
      const config = SPECIALIST_NOTE_CONFIG[step.specialistType]
      const quickSnippets = config?.quickSnippets ?? []
      const templates = config?.templates ?? []
      const dropdowns = config?.dropdowns ?? []
      const procedures = config?.procedures ?? []
      const medications = config?.medications ?? []
      const guidanceSections = config?.guidance ?? []
      const recommendedUploads = config?.recommendedUploads ?? []
      const specialistKey = step.specialistType ?? step.id
      const documentDraft = documentDrafts[specialistKey] ?? {
        file: null,
        documentType: "report",
        notes: "",
        isConfidential: false,
      }
      const recentUploads = recentUploadsByKey[specialistKey] ?? []
      const uploadInProgress = uploadingDocumentKey === specialistKey
      const helperState = helperPopoverOpen[step.specialistType] || {}
      const normalizedSpecialistType =
        step.specialistType === "dental_consultation" ? "dentist" : step.specialistType
      const isDentist = normalizedSpecialistType === "dentist"
      const dentistSections = isDentist
        ? noteDraft.structuredSections ?? parseDentistStructuredContent(noteDraft.content)
        : null

      const handleTemplateSelect = (value: string) => {
        if (!config || value === TEMPLATE_CUSTOM_VALUE || !value) {
          setSpecialistNoteDraft(step.specialistType!, {
            ...noteDraft,
            selectedTemplate: undefined,
            noteType: step.noteType,
          })
          return
        }

        const template = templates.find((item) => item.value === value)
        if (!template) return

        if (isDentist) {
          const parsedTemplateSections = parseDentistStructuredContent(template.content)
          const structuredContent = composeDentistStructuredContent(parsedTemplateSections)
          setSpecialistNoteDraft(step.specialistType!, {
            ...noteDraft,
            structuredSections: parsedTemplateSections,
            content: structuredContent,
            selectedTemplate: value,
            noteType: step.noteType,
          })
          return
        }

        setSpecialistNoteDraft(step.specialistType!, {
          ...noteDraft,
          content: template.content,
          selectedTemplate: value,
          noteType: step.noteType,
        })
      }

      const handleQuickSnippet = (snippet: string) => {
        if (isDentist) {
          const currentSections: Partial<Record<DentistSectionKey, string>> = {
            ...(dentistSections ?? {}),
          }
          const existingPlan = currentSections.plan?.trim()
          const mergedPlan = existingPlan?.length
            ? `${existingPlan}\n\n${snippet.trim()}`
            : snippet.trim()
          currentSections.plan = mergedPlan.trim()
          const structuredContent = composeDentistStructuredContent(currentSections)
          setSpecialistNoteDraft(step.specialistType!, {
            ...noteDraft,
            structuredSections: currentSections,
            content: structuredContent,
            noteType: step.noteType,
          })
          return
        }

        const updated = appendSnippetUnique(noteDraft.content, snippet)
        setSpecialistNoteDraft(step.specialistType!, {
          ...noteDraft,
          content: updated,
          noteType: step.noteType,
        })
      }

      const handleDropdownChange = (dropdown: SpecialistDropdownConfig, value: string) => {
        const normalized = value === SELECT_EMPTY_VALUE ? undefined : value
        const updatedContent = upsertStructuredLine(noteDraft.content, dropdown.label, normalized)
        const baseDraft: SpecialistNoteDraft = {
          ...noteDraft,
          content: updatedContent,
          noteType: step.noteType,
        }

        if (isDentist) {
          const nextSections = parseDentistStructuredContent(updatedContent)
          const dentistDraft: SpecialistNoteDraft = {
            ...baseDraft,
            structuredSections: nextSections,
          }
          const nextDraft = applyDropdownValue(dentistDraft, dropdown.field, normalized)
          setSpecialistNoteDraft(step.specialistType!, nextDraft)
          return
        }

        const nextDraft = applyDropdownValue(baseDraft, dropdown.field, normalized)
        setSpecialistNoteDraft(step.specialistType!, nextDraft)
      }

      const handleAutoCompleteInsert = (kind: "procedures" | "medications", entry: string) => {
        if (isDentist) {
          const currentSections: Partial<Record<DentistSectionKey, string>> = {
            ...(dentistSections ?? {}),
          }
          const targetKey: DentistSectionKey = kind === "procedures" ? "procedure" : "plan"
          const existing = currentSections[targetKey]?.trim()
          const snippet = kind === "procedures" ? `Procedure: ${entry}` : `Medication: ${entry}`
          currentSections[targetKey] = existing?.length ? `${existing}\n${snippet}` : snippet
          const structuredContent = composeDentistStructuredContent(currentSections)
          setSpecialistNoteDraft(step.specialistType!, {
            ...noteDraft,
            structuredSections: currentSections,
            content: structuredContent,
            noteType: step.noteType,
          })
          updateHelperPopoverState(step.specialistType!, kind, false)
          return
        }

        const heading = kind === "procedures" ? "Treatment" : "Medication"
        const snippet = `${heading}: ${entry}`
        const updated = appendSnippetUnique(noteDraft.content, snippet)
        setSpecialistNoteDraft(step.specialistType!, {
          ...noteDraft,
          content: updated,
          noteType: step.noteType,
        })
        updateHelperPopoverState(step.specialistType!, kind, false)
      }

      const placeholder =
        config?.placeholder || `Document the ${step.title.toLowerCase()} findings, interventions, and plans.`

      const templateSelectValue =
        noteDraft.selectedTemplate && noteDraft.selectedTemplate.length > 0
          ? noteDraft.selectedTemplate
          : TEMPLATE_CUSTOM_VALUE

      if (isDentist) {
        const getDentistSectionValue = (key: DentistSectionKey) => (
          dentistSections?.[key] ?? ""
        )

        const updateDentistSection = (key: DentistSectionKey, nextValue: string) => {
          const currentSections: Partial<Record<DentistSectionKey, string>> = {
            ...(dentistSections ?? {}),
          }
          const trimmed = nextValue.trim()
          if (trimmed.length) {
            currentSections[key] = nextValue
          } else {
            delete currentSections[key]
          }
          const structuredContent = composeDentistStructuredContent(currentSections)
          setSpecialistNoteDraft(step.specialistType!, {
            ...noteDraft,
            structuredSections: currentSections,
            content: structuredContent,
            noteType: step.noteType,
          })
        }

        const dentistSummary = composeDentistStructuredContent(dentistSections ?? {})
        const vitalAlerts = generateVitalAlerts()
        const followUpDisplay = noteDraft.followUpDate
          ? new Date(noteDraft.followUpDate).toLocaleDateString("en-ZA", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "Not scheduled"

        return (
          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-background to-secondary/5 p-6 shadow-lg">
              <div className="absolute inset-0 bg-grid-white/5 mask-[radial-gradient(white,transparent_85%)]" />
              <div className="relative flex flex-col gap-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-2xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {patientName}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      ID: {patientId} • {new Date().toLocaleDateString("en-ZA", {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="bg-background/50 backdrop-blur-sm border-primary/30">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Dental Consultation
                    </Badge>
                    {noteDraft.selectedTemplate ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        Template: {templates.find((tpl) => tpl.value === noteDraft.selectedTemplate)?.label || "Custom"}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-primary/30 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">Next Follow-up</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{followUpDisplay}</p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">Caries Severity</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{noteDraft.severity || "Not captured"}</p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">Arch</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{noteDraft.laterality || "Not captured"}</p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-white/70 p-4 shadow-sm">
                    <p className="text-xs text-muted-foreground">Vitals Snapshot</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {vitalSigns.bloodPressureSystolic && vitalSigns.bloodPressureDiastolic
                        ? `${vitalSigns.bloodPressureSystolic}/${vitalSigns.bloodPressureDiastolic} mmHg`
                        : vitalSigns.pulse
                          ? `${vitalSigns.pulse} bpm`
                          : "No vitals recorded"}
                    </p>
                  </div>
                </div>

                {vitalAlerts.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {vitalAlerts.slice(0, 3).map((alert, index) => (
                      <div
                        key={index}
                        className={`rounded-xl border p-3 text-xs shadow-sm transition-all ${
                          alert.severity === "critical"
                            ? "border-red-400 bg-red-50"
                            : alert.severity === "caution"
                              ? "border-yellow-400 bg-yellow-50"
                              : "border-emerald-400 bg-emerald-50"
                        }`}
                      >
                        <p className="font-semibold text-foreground">{alert.parameter}</p>
                        <p className="mt-1 text-sm">{alert.value}</p>
                        <p className="text-[11px] text-muted-foreground">Ref: {alert.reference}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {guidanceSections.length > 0 && (
              <Alert className="bg-muted/40 border-primary/30">
                <AlertDescription className="text-xs leading-relaxed space-y-2">
                  <span className="block font-semibold text-primary">Dental consultation checklist</span>
                  {guidanceSections.map((section) => (
                    <div key={`${step.specialistType}-guide-${section.title}`}>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.title}
                      </p>
                      <ul className="ml-4 mt-1 space-y-1 list-disc">
                        {section.items.map((item, index) => (
                          <li key={`${step.specialistType}-guide-${section.title}-${index}`} className="text-[11px]">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {recommendedUploads.length > 0 ? (
              <Card className="border-dashed border-primary/30 bg-muted/40">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="rounded-md bg-primary/10 p-2">
                      <CloudUpload className="h-4 w-4 text-primary" />
                    </span>
                    <div>
                      <CardTitle className="text-sm">Recommended uploads</CardTitle>
                      <CardDescription>Upload supporting media to strengthen the clinical record.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
                      {recommendedUploads.map((item, index) => (
                        <li key={`${step.specialistType}-upload-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-background/60 p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Select file</Label>
                        <Input
                          type="file"
                          accept={ALLOWED_DOCUMENT_EXTENSIONS.join(",")}
                          disabled={uploadInProgress}
                          ref={(element) => {
                            if (!specialistKey) {
                              return
                            }
                            if (element) {
                              fileInputsRef.current[specialistKey] = element
                            } else {
                              delete fileInputsRef.current[specialistKey]
                            }
                          }}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            updateDocumentDraft(specialistKey, { file })
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {documentDraft.file
                            ? `${documentDraft.file.name} • ${formatFileSize(documentDraft.file.size)}`
                            : "No file selected"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Document type</Label>
                        <Select
                          value={documentDraft.documentType}
                          disabled={uploadInProgress}
                          onValueChange={(value) => updateDocumentDraft(specialistKey, { documentType: value })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={`${specialistKey}-doc-${option.value}`} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                      <Textarea
                        rows={2}
                        placeholder="Add context for this upload (optional)"
                        value={documentDraft.notes}
                        disabled={uploadInProgress}
                        onChange={(event) => updateDocumentDraft(specialistKey, { notes: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={documentDraft.isConfidential}
                          disabled={uploadInProgress}
                          onCheckedChange={(checked) =>
                            updateDocumentDraft(specialistKey, { isConfidential: Boolean(checked) })
                          }
                        />
                        Mark as confidential
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            handleDocumentUpload(
                              specialistKey,
                              normalizedSpecialistType ?? specialistKey,
                              step.id,
                              documentDraft,
                            )
                          }
                          disabled={uploadInProgress || !documentDraft.file}
                        >
                          {uploadInProgress ? "Uploading…" : "Upload document"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => resetDocumentDraft(specialistKey)}
                          disabled={uploadInProgress}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Uploads are linked to this visit so the multidisciplinary team can review supporting evidence in
                      real time.
                    </p>
                  </div>
                  {recentUploads.length > 0 ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-xs font-semibold text-primary">Recent uploads this session</p>
                      <ul className="mt-2 space-y-1">
                        {recentUploads.map((doc) => (
                          <li key={doc.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{doc.file_name}</span>
                            <span className="ml-2">
                              {(doc.document_type || "document").toString()} • {formatUploadTimestamp(doc.uploaded_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Tabs defaultValue="assessment" className="w-full">
              <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-muted/50 backdrop-blur-sm rounded-xl">
                <TabsTrigger value="assessment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                  <Clipboard className="w-4 h-4 mr-2" />
                  Assessment
                </TabsTrigger>
                <TabsTrigger value="diagnostics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                  <Search className="w-4 h-4 mr-2" />
                  Diagnostics
                </TabsTrigger>
                <TabsTrigger value="treatment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                  <Stethoscope className="w-4 h-4 mr-2" />
                  Treatment
                </TabsTrigger>
                <TabsTrigger value="summary" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assessment" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clipboard className="w-4 h-4" />
                      Subjective & History
                    </CardTitle>
                    <CardDescription>Capture the presenting complaint and relevant background.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.chiefComplaint}</Label>
                      <Textarea
                        rows={3}
                        placeholder="Patient reports sensitivity to cold drinks, bleeding when brushing..."
                        value={getDentistSectionValue("chiefComplaint")}
                        onChange={(event) => updateDentistSection("chiefComplaint", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.history}</Label>
                      <Textarea
                        rows={4}
                        placeholder="Medical history, previous dental interventions, medications, allergies..."
                        value={getDentistSectionValue("history")}
                        onChange={(event) => updateDentistSection("history", event.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="diagnostics" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      Examination & Assessment
                    </CardTitle>
                    <CardDescription>Document objective findings and diagnostic impressions.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.examination}</Label>
                      <Textarea
                        rows={4}
                        placeholder="Extra-oral and intra-oral findings, periodontal status, charting..."
                        value={getDentistSectionValue("examination")}
                        onChange={(event) => updateDentistSection("examination", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.diagnostics}</Label>
                      <Textarea
                        rows={4}
                        placeholder="Provisional / definitive diagnosis, radiographic interpretation, risk assessment..."
                        value={getDentistSectionValue("diagnostics")}
                        onChange={(event) => updateDentistSection("diagnostics", event.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {dropdowns.length ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-semibold">Structured Fields</CardTitle>
                      <CardDescription>Select standardized descriptors for quick reference.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-3">
                        {dropdowns.map((dropdown) => {
                          const currentValue = readDropdownValue(noteDraft, dropdown.field)
                          const selectValue = currentValue && currentValue.length > 0 ? currentValue : SELECT_EMPTY_VALUE
                          return (
                            <div key={`${step.specialistType}-dropdown-${dropdown.field}`} className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground">{dropdown.label}</Label>
                              <Select value={selectValue} onValueChange={(value) => handleDropdownChange(dropdown, value)}>
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder={`Select ${dropdown.label.toLowerCase()}`} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={SELECT_EMPTY_VALUE}>Not captured</SelectItem>
                                  {dropdown.options.map((option) => (
                                    <SelectItem key={`${dropdown.field}-${option}`} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="treatment" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Stethoscope className="w-4 h-4" />
                      Procedures & Plan
                    </CardTitle>
                    <CardDescription>Outline procedures performed and post-operative guidance.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {templates.length ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Templates</Label>
                        <Select value={templateSelectValue} onValueChange={handleTemplateSelect}>
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Choose a template or keep custom note" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={TEMPLATE_CUSTOM_VALUE}>Custom note</SelectItem>
                            {templates.map((template) => (
                              <SelectItem key={template.value} value={template.value}>
                                {template.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {quickSnippets.length ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Quick-fill snippets</Label>
                        <div className="flex flex-wrap gap-2">
                          {quickSnippets.map((snippet) => (
                            <Button
                              key={`${step.specialistType}-snippet-${snippet.label}`}
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-8 px-3 text-xs"
                              onClick={() => handleQuickSnippet(snippet.content)}
                            >
                              {snippet.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.procedure}</Label>
                      <Textarea
                        rows={4}
                        placeholder="Scaling completed, composite restoration teeth 36 & 37, local anaesthetic used..."
                        value={getDentistSectionValue("procedure")}
                        onChange={(event) => updateDentistSection("procedure", event.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{DENTIST_SECTION_DISPLAY_LABELS.plan}</Label>
                      <Textarea
                        rows={4}
                        placeholder="Oral hygiene instructions, analgesia, recall schedule, referral notes..."
                        value={getDentistSectionValue("plan")}
                        onChange={(event) => updateDentistSection("plan", event.target.value)}
                      />
                    </div>

                    {(procedures.length > 0 || medications.length > 0) && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">Auto-complete helpers</Label>
                        <div className="flex flex-wrap gap-2">
                          {procedures.length ? (
                            <Popover
                              open={helperState.procedures ?? false}
                              onOpenChange={(open) => updateHelperPopoverState(step.specialistType!, "procedures", open)}
                            >
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs">
                                  Insert procedure
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search procedures..." />
                                  <CommandList>
                                    <CommandEmpty>No procedures found.</CommandEmpty>
                                    <CommandGroup heading="Procedures">
                                      {procedures.map((procedure) => (
                                        <CommandItem
                                          key={`${step.specialistType}-procedure-${procedure}`}
                                          value={procedure}
                                          onSelect={() => handleAutoCompleteInsert("procedures", procedure)}
                                        >
                                          {procedure}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : null}

                          {medications.length ? (
                            <Popover
                              open={helperState.medications ?? false}
                              onOpenChange={(open) => updateHelperPopoverState(step.specialistType!, "medications", open)}
                            >
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs">
                                  Insert medication
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="Search medications..." />
                                  <CommandList>
                                    <CommandEmpty>No medications found.</CommandEmpty>
                                    <CommandGroup heading="Medications">
                                      {medications.map((medication) => (
                                        <CommandItem
                                          key={`${step.specialistType}-medication-${medication}`}
                                          value={medication}
                                          onSelect={() => handleAutoCompleteInsert("medications", medication)}
                                        >
                                          {medication}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Consultation Summary Preview
                    </CardTitle>
                    <CardDescription>Review the structured note that will be stored for this visit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {dentistSummary ? (
                      <Textarea value={dentistSummary} readOnly rows={10} className="font-mono text-xs bg-muted" />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Start documenting in the tabs above to generate a structured dental note summary.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`${step.specialistType}-follow-up`}
                  checked={Boolean(noteDraft.followUpRequired)}
                  onCheckedChange={(checked) =>
                    updateSpecialistNoteField(step.specialistType!, "followUpRequired", Boolean(checked))
                  }
                />
                <Label htmlFor={`${step.specialistType}-follow-up`} className="text-sm">
                  Follow-up required
                </Label>
              </div>

              {noteDraft.followUpRequired && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Follow-up date</Label>
                    <Input
                      type="date"
                      value={noteDraft.followUpDate || ""}
                      onChange={(event) =>
                        updateSpecialistNoteField(step.specialistType!, "followUpDate", event.target.value)
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Note type</Label>
                    <Input value={step.noteType || "Specialist"} readOnly className="bg-muted" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-xs text-muted-foreground">Capture findings for this specialist stage.</p>
            </div>
          </div>

          {recommendedUploads.length > 0 ? (
            <Card className="border-dashed border-primary/30 bg-muted/40">
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-primary/10 p-2">
                    <CloudUpload className="h-4 w-4 text-primary" />
                  </span>
                  <div>
                    <CardTitle className="text-sm">Recommended uploads</CardTitle>
                    <CardDescription>Attach supporting media via the Patient Documents panel.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
                  {recommendedUploads.map((item, index) => (
                    <li key={`${step.specialistType}-upload-${index}`}>{item}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  Uploads sync with this visit so the multidisciplinary team can review evidence-based documentation.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {guidanceSections.length > 0 && (
            <Alert className="bg-muted/40 border-primary/30">
              <AlertDescription className="text-xs leading-relaxed space-y-2">
                <span className="block font-semibold text-primary">Medical consultation checklist</span>
                {guidanceSections.map((section) => (
                  <div key={`${step.specialistType}-guide-${section.title}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                    </p>
                    <ul className="ml-4 mt-1 space-y-1 list-disc">
                      {section.items.map((item, index) => (
                        <li key={`${step.specialistType}-guide-${section.title}-${index}`} className="text-[11px]">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Consultation Notes</Label>
            <Textarea
              rows={8}
              placeholder={placeholder}
              value={noteDraft.content}
              onChange={(event) =>
                setSpecialistNoteDraft(step.specialistType!, {
                  ...noteDraft,
                  noteType: step.noteType,
                  content: event.target.value,
                })
              }
            />
          </div>

          {quickSnippets.length ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Quick-fill snippets</Label>
              <div className="flex flex-wrap gap-2">
                {quickSnippets.map((snippet) => (
                  <Button
                    key={`${step.specialistType}-snippet-${snippet.label}`}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 px-3 text-xs"
                    onClick={() => handleQuickSnippet(snippet.content)}
                  >
                    {snippet.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {templates.length ? (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Templates</Label>
              <Select
                value={templateSelectValue}
                onValueChange={handleTemplateSelect}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose a template or keep custom note" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TEMPLATE_CUSTOM_VALUE}>Custom note</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {dropdowns.length ? (
            <div className="grid gap-3 md:grid-cols-3">
              {dropdowns.map((dropdown) => {
                const currentValue = readDropdownValue(noteDraft, dropdown.field)
                const selectValue = currentValue && currentValue.length > 0 ? currentValue : SELECT_EMPTY_VALUE
                return (
                  <div key={`${step.specialistType}-dropdown-${dropdown.field}`} className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">{dropdown.label}</Label>
                    <Select value={selectValue} onValueChange={(value) => handleDropdownChange(dropdown, value)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder={`Select ${dropdown.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_EMPTY_VALUE}>Not captured</SelectItem>
                        {dropdown.options.map((option) => (
                          <SelectItem key={`${dropdown.field}-${option}`} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          ) : null}

          {(procedures.length > 0 || medications.length > 0) && (
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Auto-complete helpers</Label>
              <div className="flex flex-wrap gap-2">
                {procedures.length ? (
                  <Popover
                    open={helperState.procedures ?? false}
                    onOpenChange={(open) => updateHelperPopoverState(step.specialistType!, "procedures", open)}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs">
                        Insert procedure
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search procedures..." />
                        <CommandList>
                          <CommandEmpty>No procedures found.</CommandEmpty>
                          <CommandGroup heading="Procedures">
                            {procedures.map((procedure) => (
                              <CommandItem
                                key={`${step.specialistType}-procedure-${procedure}`}
                                value={procedure}
                                onSelect={() => handleAutoCompleteInsert("procedures", procedure)}
                              >
                                {procedure}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : null}

                {medications.length ? (
                  <Popover
                    open={helperState.medications ?? false}
                    onOpenChange={(open) => updateHelperPopoverState(step.specialistType!, "medications", open)}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs">
                        Insert medication
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search medications..." />
                        <CommandList>
                          <CommandEmpty>No medications found.</CommandEmpty>
                          <CommandGroup heading="Medications">
                            {medications.map((medication) => (
                              <CommandItem
                                key={`${step.specialistType}-medication-${medication}`}
                                value={medication}
                                onSelect={() => handleAutoCompleteInsert("medications", medication)}
                              >
                                {medication}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${step.specialistType}-follow-up`}
                checked={Boolean(noteDraft.followUpRequired)}
                onCheckedChange={(checked) =>
                  updateSpecialistNoteField(step.specialistType!, "followUpRequired", Boolean(checked))
                }
              />
              <Label htmlFor={`${step.specialistType}-follow-up`} className="text-sm">
                Follow-up required
              </Label>
            </div>

            {noteDraft.followUpRequired && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium">Follow-up date</Label>
                  <Input
                    type="date"
                    value={noteDraft.followUpDate || ""}
                    onChange={(event) =>
                      updateSpecialistNoteField(step.specialistType!, "followUpDate", event.target.value)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Note type</Label>
                  <Input value={step.noteType || "Specialist"} readOnly className="bg-muted" />
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    switch (step.id) {
      case "nursing": {
        const nursingStep = workflowSteps.find((s) => s.id === "nursing")
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Vital Signs <span className="text-red-500">*</span></h3>
              <p className="text-xs text-muted-foreground mb-3">All fields are required before submission</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Blood Pressure (mmHg) <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Systolic"
                      required
                      value={vitalSigns.bloodPressureSystolic}
                      onChange={(e) => updateVitalSigns("bloodPressureSystolic", e.target.value)}
                      className={!vitalSigns.bloodPressureSystolic ? "border-red-300" : ""}
                    />
                    <span className="self-center">/</span>
                    <Input
                      placeholder="Diastolic"
                      required
                      value={vitalSigns.bloodPressureDiastolic}
                      onChange={(e) => updateVitalSigns("bloodPressureDiastolic", e.target.value)}
                      className={!vitalSigns.bloodPressureDiastolic ? "border-red-300" : ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Temperature (°C) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="36.5"
                    required
                    value={vitalSigns.temperature}
                    onChange={(e) => updateVitalSigns("temperature", e.target.value)}
                    className={!vitalSigns.temperature ? "border-red-300" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Weight (kg) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="70"
                    required
                    value={vitalSigns.weight}
                    onChange={(e) => updateVitalSigns("weight", e.target.value)}
                    className={!vitalSigns.weight ? "border-red-300" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Height (cm) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="170"
                    required
                    value={vitalSigns.height}
                    onChange={(e) => updateVitalSigns("height", e.target.value)}
                    className={!vitalSigns.height ? "border-red-300" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pulse (bpm) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="72"
                    required
                    value={vitalSigns.pulse}
                    onChange={(e) => updateVitalSigns("pulse", e.target.value)}
                    className={!vitalSigns.pulse ? "border-red-300" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Oxygen Saturation (%) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="98"
                    required
                    value={vitalSigns.oxygenSaturation}
                    onChange={(e) => updateVitalSigns("oxygenSaturation", e.target.value)}
                    className={!vitalSigns.oxygenSaturation ? "border-red-300" : ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Respiratory Rate (breaths/min) <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="16"
                    required
                    value={vitalSigns.respiratoryRate}
                    onChange={(e) => updateVitalSigns("respiratoryRate", e.target.value)}
                    className={!vitalSigns.respiratoryRate ? "border-red-300" : ""}
                  />
                </div>
              </div>
            </div>

            {/* Real-time Validation Display */}
            {vitalsValidation && (() => {
              const validation = vitalsValidation
              return (
              <div className="space-y-3 p-4 rounded-lg border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Vital Signs Validation
                  </h3>
                  <Badge 
                    variant={validation.anyCritical ? "destructive" : validation.anyWarnings ? "outline" : "secondary"}
                    className={validation.anyCritical ? "bg-red-100 text-red-800" : validation.anyWarnings ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                  >
                    {validation.summary}
                  </Badge>
                </div>

                {/* Validation Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {vitalSigns.bloodPressureSystolic && validation.systolic_bp && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.systolic_bp.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.systolic_bp.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.systolic_bp.status)}</span>
                        Systolic BP
                      </div>
                      <div className="text-xs mt-1">{validation.systolic_bp.message}</div>
                    </div>
                  )}

                  {vitalSigns.bloodPressureDiastolic && validation.diastolic_bp && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.diastolic_bp.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.diastolic_bp.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.diastolic_bp.status)}</span>
                        Diastolic BP
                      </div>
                      <div className="text-xs mt-1">{validation.diastolic_bp.message}</div>
                    </div>
                  )}

                  {vitalSigns.temperature && validation.temperature && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.temperature.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.temperature.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.temperature.status)}</span>
                        Temperature
                      </div>
                      <div className="text-xs mt-1">{validation.temperature.message}</div>
                    </div>
                  )}

                  {vitalSigns.pulse && validation.heart_rate && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.heart_rate.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.heart_rate.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.heart_rate.status)}</span>
                        Heart Rate
                      </div>
                      <div className="text-xs mt-1">{validation.heart_rate.message}</div>
                    </div>
                  )}

                  {vitalSigns.oxygenSaturation && validation.oxygen_saturation && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.oxygen_saturation.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.oxygen_saturation.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.oxygen_saturation.status)}</span>
                        O2 Saturation
                      </div>
                      <div className="text-xs mt-1">{validation.oxygen_saturation.message}</div>
                    </div>
                  )}

                  {vitalSigns.weight && vitalSigns.height && validation.bmi && (
                    <div className={`p-2 rounded border-l-4 ${
                      validation.bmi.status === "critical" ? "border-red-500 bg-red-50" :
                      validation.bmi.status === "caution" ? "border-yellow-500 bg-yellow-50" :
                      "border-green-500 bg-green-50"
                    }`}>
                      <div className="font-semibold flex items-center gap-1">
                        <span>{getValidationIcon(validation.bmi.status)}</span>
                        BMI
                      </div>
                      <div className="text-xs mt-1">{validation.bmi.message}</div>
                    </div>
                  )}
                </div>

                {/* Legend */}
                <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-2 pt-2 border-t">
                  <span className="flex items-center gap-1"><span className="text-green-600 font-bold">🟢</span> Normal Range</span>
                  <span className="flex items-center gap-1"><span className="text-yellow-600 font-bold">🟡</span> Caution</span>
                  <span className="flex items-center gap-1"><span className="text-red-600 font-bold">🔴</span> Critical</span>
                </div>
              </div>)
            })()}

            <div className="space-y-2">
              <Label>
                Nursing Assessment Notes <RequiredAsterisk />
                <span className="text-xs text-muted-foreground ml-2">(or vital signs)</span>
              </Label>
              <Textarea
                placeholder="Record nursing assessment, observations, and screening results... (minimum 20 characters required)"
                value={clinicalNotes.nursingAssessment}
                onChange={(e) => updateClinicalNotes("nursingAssessment", e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {clinicalNotes.nursingAssessment.length}/20 characters
              </p>
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
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-primary/5 via-background to-secondary/5 p-6 shadow-lg">
              <div className="absolute inset-0 bg-grid-white/5 mask-[radial-gradient(white,transparent_85%)]" />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent">
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
                            ? "bg-linear-to-br from-red-500/10 to-red-600/5 border border-red-500/30 shadow-lg shadow-red-500/10"
                            : alert.severity === "caution"
                              ? "bg-linear-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                              : "bg-linear-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 shadow-lg shadow-green-500/10"
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
                      <Label className="text-sm font-medium">
                        Clinical Examination & Findings <RequiredAsterisk />
                      </Label>
                      <Textarea
                        placeholder="Document clinical findings, examination results, review of systems... (minimum 10 characters required)"
                        value={clinicalNotes.doctorDiagnosis}
                        onChange={(e) => {
                          updateClinicalNotes("doctorDiagnosis", e.target.value)
                          requestSmartSuggestions(e.target.value, "assessment")
                        }}
                        onFocus={() => setActiveInput("assessment")}
                        rows={6}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {clinicalNotes.doctorDiagnosis.length}/10 characters
                      </p>
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
                  <CardHeader className="bg-linear-to-r from-primary/5 to-secondary/5">
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
                        Primary Diagnosis <RequiredAsterisk />
                      </Label>
                      <Textarea
                        placeholder="Enter primary and differential diagnoses... (minimum 10 characters required)"
                        value={clinicalNotes.doctorDiagnosis}
                        onChange={(e) => {
                          updateClinicalNotes("doctorDiagnosis", e.target.value)
                          requestSmartSuggestions(e.target.value, "diagnosis")
                        }}
                        rows={4}
                        className="mt-2 resize-none border-primary/20 focus:border-primary focus:ring-primary/20"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {clinicalNotes.doctorDiagnosis.length}/10 characters
                      </p>
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
                            className="w-full justify-between text-left font-normal border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 bg-linear-to-r from-primary/5 to-transparent transition-all duration-200 h-auto py-3"
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
                        <PopoverContent className="w-[95vw] md:w-[600px] max-w-[600px] p-0 shadow-xl border-2" align="start">
                          <div className="border-b bg-muted/30 p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Target className="w-4 h-4" />
                              <span className="hidden md:inline">ICD-10-CM Code Search</span>
                              <span className="md:hidden">Search ICD-10</span>
                              {icd10SearchResults.length > 0 && (
                                <Badge variant="outline" className="ml-auto md:ml-0 text-xs">
                                  Showing {icd10SearchResults.length} / 25 results
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setIcd10SearchOpen(false)}
                              className="md:hidden h-6 w-6 p-0"
                              aria-label="Close search"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          <Command>
                            <CommandInput
                              placeholder="Search by code or condition (e.g., E11.9, diabetes)"
                              value={icd10SearchQuery}
                              onValueChange={setIcd10SearchQuery}
                              className="border-0 focus:ring-0 text-base"
                            />
                            
                            {/* Show selected codes in search popover */}
                            {selectedICD10Codes.length > 0 && (
                              <div className="border-b bg-blue-50 p-3">
                                <p className="text-xs font-medium text-blue-900 mb-2">
                                  ✅ Currently Selected ({selectedICD10Codes.length}):
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedICD10Codes.map((code, idx) => (
                                    <Badge 
                                      key={idx}
                                      variant="secondary" 
                                      className="bg-green-100 text-green-800 border-green-300 text-xs"
                                    >
                                      {code.code}
                                      <button
                                        onClick={() => removeICD10Code(code.code)}
                                        className="ml-1 hover:text-destructive"
                                      >
                                        ×
                                      </button>
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <CommandList className="max-h-96">
                              {icd10SearchLoading && (
                                <div className="p-8 text-center space-y-2">
                                  <div className="inline-flex flex-col items-center gap-3">
                                    <div className="w-5 h-5 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                                    <div>
                                      <p className="text-sm font-medium text-foreground">Searching ICD-10 database...</p>
                                      <p className="text-xs text-muted-foreground">Should take less than 1 second</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {!icd10SearchLoading && icd10SearchQuery.length < 1 && (
                                <div className="p-6 text-center space-y-3">
                                  <Brain className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                                  <div>
                                    <p className="text-sm font-medium text-foreground">Search ICD-10 Codes</p>
                                    <p className="text-xs text-muted-foreground mt-1">Type diagnosis, symptoms, or code (1+ characters)</p>
                                  </div>
                                  <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                    Examples: "diabetes" • "E11.9" • "fever" • "infection"
                                  </div>
                                </div>
                              )}

                              {!icd10SearchLoading &&
                                icd10SearchQuery.length >= 2 &&
                                icd10SearchResults.length === 0 && (
                                  <div className="p-6 text-center space-y-3">
                                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                                    <div>
                                      <p className="text-sm font-semibold text-foreground mb-1">
                                        No matches found for "{icd10SearchQuery}"
                                      </p>
                                      <p className="text-xs text-muted-foreground mb-3">
                                        Suggestions: try broader terms • check spelling • use code format (e.g., E11)
                                      </p>
                                      <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
                                        💡 <span className="font-medium">Tip:</span> Try searching for symptoms or use the quick access codes below
                                      </div>
                                    </div>
                                  </div>
                                )}

                              {!icd10SearchLoading && icd10SearchResults.length > 0 && (
                                <CommandGroup heading={`Top ${icd10SearchResults.length} ICD-10 matches`}>
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
                                        <div className={`shrink-0 w-3 h-3 rounded-full mt-2 transition-colors ${
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
                                        <div className="shrink-0 flex items-center">
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
                              <div className="flex items-center justify-between gap-2 flex-col md:flex-row">
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Zap className="w-3 h-3" />
                                  Click any code to add it
                                </p>
                                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-medium">Keyboard:</span>
                                  <kbd className="px-2 py-1 bg-muted rounded border text-xs font-mono">↑↓</kbd>
                                  <span>Navigate</span>
                                  <kbd className="px-2 py-1 bg-muted rounded border text-xs font-mono">Enter</kbd>
                                  <span>Select</span>
                                  <kbd className="px-2 py-1 bg-muted rounded border text-xs font-mono">Esc</kbd>
                                  <span>Close</span>
                                </div>
                              </div>
                              {selectedICD10Codes.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 p-2 rounded">
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
                                <span className="font-medium">Frequently Used ICD-10 Codes</span>
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
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                              {[
                                { code: "I10", desc: "Hypertension" },
                                { code: "E11.9", desc: "Type 2 Diabetes" }, 
                                { code: "J06.9", desc: "Upper Respiratory Infection" },
                                { code: "R50.9", desc: "Fever" },
                                { code: "R06.02", desc: "Shortness of Breath" },
                                { code: "M79.3", desc: "Panniculitis" },
                                { code: "K59.00", desc: "Constipation" },
                                { code: "Z00.00", desc: "General Medical Exam" }
                              ].filter(item => !selectedICD10Codes.find(c => c.code === item.code)).map((item) => {
                                return (
                                  <Button
                                    key={item.code}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => addICD10Code(item.code, item.desc)}
                                    className="text-xs h-8 px-2 font-mono transition-all justify-start hover:bg-primary/10 border border-transparent hover:border-primary/20"
                                    title={item.desc}
                                  >
                                    <span className="font-bold">{item.code}</span>
                                    <span className="text-xs opacity-70 ml-1 hidden md:inline">• {item.desc}</span>
                                  </Button>
                                )
                              })}
                            </div>
                          </div>
                          
                          {/* Search Tips */}
                          <div className="text-xs bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Brain className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="font-semibold text-blue-900 mb-1">💡 Search Tips:</p>
                                <ul className="space-y-1 text-blue-700">
                                  <li>🔍 Search by symptom: "diabetes", "hypertension", "fever"</li>
                                  <li>📝 Search by code: "E11", "I10", "J06" for partial matches</li>
                                  <li>✨ Select multiple codes in one search session</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {smartSuggestions.length > 0 && (
                      <Alert className="border-primary/30 bg-linear-to-r from-primary/5 to-secondary/5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <AlertDescription>
                          <div className="space-y-3">
                            <span className="text-sm font-semibold flex items-center gap-2">
                              <Zap className="w-4 h-4 text-yellow-500" />
                              AI-Powered Suggestions
                            </span>
                            {smartSuggestionLoading && (
                              <Badge variant="secondary" className="text-xs">
                                Updating…
                              </Badge>
                            )}
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
                                        className={`h-full bg-linear-to-r from-primary to-secondary rounded-full transition-all duration-300 ${getConfidenceWidthClass(suggestion.confidence)}`}
                                        aria-hidden="true"
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
                          requestSmartSuggestions(e.target.value, "treatment")
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
                        <Button variant="outline" size="sm" onClick={() => {
                          // Check if psychology is in selected specialists
                          const hasPsychology = selectedSpecialists.some(s => 
                            s.toLowerCase().includes('psychology') || s.toLowerCase().includes('psychologist')
                          )
                          setCurrentReferralContext(hasPsychology ? "Psychology" : "General")
                          setShowReferral(true)
                        }}>
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
                              value={clinicalNotes.followUpInstructions || ""}
                              onChange={(e) => updateClinicalNotes("followUpInstructions", e.target.value)}
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
                          {clinicalNotes.followUpInstructions && (
                            <p className="text-xs text-muted-foreground">
                              Instructions: {clinicalNotes.followUpInstructions}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" disabled={completingStep}>Save Draft</Button>
                      <Button onClick={completeCurrentStep} disabled={completingStep}>
                        {completingStep ? "Completing..." : "Complete Consultation"}
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
              <Label>
                Mental Health Screening <RequiredAsterisk />
                <span className="text-xs text-muted-foreground ml-2">(or counseling notes)</span>
              </Label>
              <Textarea
                placeholder="Record mental health assessment results and screening tools used... (minimum 20 characters required)"
                value={clinicalNotes.mentalHealthScreening}
                onChange={(e) => updateClinicalNotes("mentalHealthScreening", e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {clinicalNotes.mentalHealthScreening.length}/20 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                Counseling Notes <RequiredAsterisk />
                <span className="text-xs text-muted-foreground ml-2">(or mental health screening)</span>
              </Label>
              <Textarea
                placeholder="Document counseling session, interventions, and recommendations... (minimum 30 characters required)"
                value={clinicalNotes.counselingNotes}
                onChange={(e) => updateClinicalNotes("counselingNotes", e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {clinicalNotes.counselingNotes.length}/30 characters
              </p>
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
                      : "None"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Pulse:</span>
                  <span className="ml-2">{vitalSigns.pulse || "None"} bpm</span>
                </div>
                <div>
                  <span className="font-medium">Temp:</span>
                  <span className="ml-2">{vitalSigns.temperature || "None"}°C</span>
                </div>
              </div>

              {/* Key clinical summary */}
              <div className="mt-4 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Nursing:</span> {clinicalNotes.nursingAssessment || "None"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Diagnosis:</span> {clinicalNotes.doctorDiagnosis || "None"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Medications:</span>{" "}
                  {medications.length > 0 ? medications.map((m) => m.name).join(", ") : "None"}
                </div>
                <div className="text-sm">
                  <span className="font-medium">Counseling:</span> {clinicalNotes.counselingNotes || "None"}
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
                        {r.appointment_date ? ` - ${r.appointment_date}` : ""}
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
                    <ul className="space-y-2">
                      {items.map((it, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2"
                        >
                          {it.ok ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-600" aria-hidden="true" />
                          )}
                          <span className="flex-1 text-sm font-medium text-foreground">{it.label}</span>
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                              it.ok
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                          >
                            {it.ok ? "Complete" : "Pending"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Final Notes <RequiredAsterisk />
              </Label>
              <Textarea
                placeholder="Provide a comprehensive summary and follow-up instructions... (minimum 30 characters required)"
                rows={3}
                value={clinicalNotes.finalNotes || ""}
                onChange={(e) => updateClinicalNotes("finalNotes" as any, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {(clinicalNotes.finalNotes || "").length}/30 characters
              </p>
            </div>
          </div>
        )

      case "registration":
        return (
          <div className="space-y-6">
            {/* Patient Information Card */}
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-primary" />
                  Patient Information
                </CardTitle>
                <CardDescription>
                  Review patient details before check-in
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patientDetails ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Full Name</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.first_name} {patientDetails.last_name}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">ID Number</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.id_number || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Date of Birth</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.date_of_birth
                          ? new Date(patientDetails.date_of_birth).toLocaleDateString("en-ZA")
                          : "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Gender</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.gender || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Contact Number</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.phone_number || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.email || "Not provided"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Medical Aid</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.is_palmed_member ? "POLMED Member" : patientDetails.member_type || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Address</Label>
                      <p className="text-sm font-medium">
                        {patientDetails.physical_address || "Not provided"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-muted-foreground">Loading patient information...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Check-in Action */}
            {step.status !== "completed" && (
              <Card className="border-dashed border-primary/40 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="rounded-full bg-primary/10 p-4">
                      <UserCheck className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">Ready to Check In</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Click the button below to check in this patient and create a visit record. 
                        This will begin the clinical workflow.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      disabled={completingStep || !patientDetails}
                      onClick={async () => {
                        if (!patientDetails) {
                          toast({
                            title: "Error",
                            description: "Patient details not loaded",
                            variant: "destructive",
                          })
                          return
                        }

                        setCompletingStep(true)
                        try {
                          const response = await apiService.createPatientVisit(Number(patientId), {
                            location: "Mobile Clinic",
                          })

                          if (response.success && response.data) {
                            setVisitId(response.data.visit_id)
                            
                            // Mark registration as completed
                            setWorkflowSteps((prev) =>
                              prev.map((s) =>
                                s.id === "registration"
                                  ? {
                                      ...s,
                                      status: "completed",
                                      completedBy: username,
                                      completedAt: new Date().toISOString(),
                                    }
                                  : s
                              )
                            )

                            toast({
                              title: "Check-in Successful",
                              description: `Patient checked in. Visit ID: ${response.data.visit_id}`,
                            })

                            // Move to next step
                            const nursingIndex = workflowSteps.findIndex((s) => s.id === "nursing")
                            if (nursingIndex >= 0) {
                              setCurrentStep(nursingIndex)
                            }
                          } else {
                            toast({
                              title: "Check-in Failed",
                              description: response.error || "Failed to check in patient",
                              variant: "destructive",
                            })
                          }
                        } catch (error: any) {
                          console.error("Check-in error:", error)
                          toast({
                            title: "Check-in Error",
                            description: error.message || "An unexpected error occurred",
                            variant: "destructive",
                          })
                        } finally {
                          setCompletingStep(false)
                        }
                      }}
                    >
                      {completingStep ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Checking In...
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Check In Patient
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Already Checked In */}
            {step.status === "completed" && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <AlertTitle className="text-green-800">Patient Checked In</AlertTitle>
                <AlertDescription className="text-green-700">
                  This patient was successfully checked in on{" "}
                  {step.completedAt
                    ? new Date(step.completedAt).toLocaleString("en-ZA")
                    : "Unknown time"}
                  {step.completedBy && ` by ${step.completedBy}`}.
                  {visitId && ` Visit ID: ${visitId}`}
                </AlertDescription>
              </Alert>
            )}
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
        {specialistCatalog.length > 0 && !isSpecialistRole && (
          <div className="mb-6 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Specialist Workflow Stages</h3>
                <p className="text-xs text-muted-foreground">
                  Select additional specialists required for this visit. Each selection inserts a workflow stage
                  after the doctor consultation.
                </p>
              </div>
              <Badge variant="secondary">
                {selectedSpecialistCount} {selectedSpecialistCount === 1 ? "stage" : "stages"} selected
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {specialistCatalog.map((entry) => {
                const specialistType = entry.specialist_type
                const checked = selectedSpecialists.includes(specialistType)
                const Icon = SPECIALIST_ICON_MAP[specialistType] ?? Clipboard
                const disabled = !canEditSpecialistSelection && !checked
                return (
                  <Button
                    key={specialistType}
                    type="button"
                    size="sm"
                    variant={checked ? "default" : "outline"}
                    className="flex items-center gap-2"
                    disabled={disabled}
                    onClick={() => toggleSpecialistSelection(specialistType)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{entry.label}</span>
                  </Button>
                )
              })}
            </div>

            {!canEditSpecialistSelection && (
              <p className="mt-2 text-xs text-muted-foreground">
                Specialist assignments are read-only for your role.
              </p>
            )}
          </div>
        )}

        {/* Workflow Progress */}
        {(!isSpecialistRole || hasVisibleSteps) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              {displayWorkflowSteps.map((step, index) => {
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
                    {index < displayWorkflowSteps.length - 1 && (
                      <ArrowRight className="w-4 h-4 mx-2 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {displayWorkflowSteps.map((step) => (
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
        )}

        <Separator className="my-6" />

        {/* Current Step Content */}
        {isSpecialistRole && !hasVisibleSteps ? (
          <Alert variant="default" className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <AlertDescription className="text-sm">
              No specialist workflow stage has been assigned to your role for this visit yet. Please contact the care
              coordinator to add your stage when required.
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs value={activeStepId} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              {displayWorkflowSteps.map((step) => (
                <TabsTrigger
                  key={step.id}
                  value={step.id}
                  disabled={!rolesAlign(step.role, userRole)}
                  onClick={() => selectWorkflowStep(step.id)}
                >
                  {step.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {displayWorkflowSteps.map((step) => (
              <TabsContent key={step.id} value={step.id} className="mt-6">
              {(() => {
                const roleAligned = rolesAlign(step.role, userRole)
                // Allow viewing completed steps regardless of role (read-only access)
                const isCompletedStep = step.status === "completed"
                
                if (!roleAligned && !isCompletedStep) {
                  const normalizedStepRole = normalizeRoleValue(step.role)
                  const roleLabel = ROLE_LABELS[normalizedStepRole] || step.title
                  return (
                    <Alert variant="destructive" className="flex items-start gap-3">
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                      <AlertDescription className="text-sm">
                        {roleLabel} access required for {step.title}.
                      </AlertDescription>
                    </Alert>
                  )
                }

                const pendingDependencies = listIncompleteDependencies(step.id, workflowSteps)
                const blockingTitles = pendingDependencies
                  .map((dependency) => workflowSteps.find((s) => s.id === dependency)?.title)
                  .filter(Boolean) as string[]
                const accessGranted = canAccessStep(step)

                if (!accessGranted) {
                  return (
                    <Alert variant="default" className="flex items-start gap-3">
                      <Clock className="h-4 w-4 mt-0.5" />
                      <AlertDescription className="text-sm">
                        {blockingTitles.length > 0
                          ? `Waiting for ${blockingTitles.join(", ")} to finish before ${step.title} can begin.`
                          : `${step.title} is not yet available.`}
                      </AlertDescription>
                    </Alert>
                  )
                }

                const nursingDone = workflowSteps.find((s) => s.id === "nursing")?.status === "completed"
                const doctorDone = workflowSteps.find((s) => s.id === "doctor")?.status === "completed"
                const counselingDone = workflowSteps.find((s) => s.id === "counseling")?.status === "completed"
                const closureReady = step.id !== "closure" || (nursingDone && doctorDone && counselingDone)

                return (
                  <>
                    {getStepContent(step)}

                    {step.status !== "completed" && step.id !== "nursing" && (
                      <div className="mt-6 flex flex-col items-end gap-2">
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
                      </div>
                    )}
                  </>
                )
              })()}

              {rolesAlign(step.role, userRole) && step.status === "completed" && (
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
        )}

        {showReferral && (
          <ReferralModal
            patientId={Number(patientId)}
            currentStage={workflowSteps[currentStep]?.title as any}
            specialistContext={currentReferralContext}
            isPolmedMember={patientPolmedStatus}
            onClose={() => setShowReferral(false)}
            onCreated={() => setShowReferral(false)}
          />
        )}
      </CardContent>
    </Card>
  )
}
