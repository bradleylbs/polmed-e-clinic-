"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  FileText,
  Download,
  Eye,
  Printer,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  User,
  CheckCircle,
  Clock,
  Heart,
  Pill,
  Activity,
  Microscope,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { patientPortalService } from "@/lib/patient-portal-service"
import { handleUpdateWithFeedback } from "@/lib/feedback-utils"

interface PatientMedicalReportsProps {
  patientId: number
  patientName: string
}

interface MedicalReport {
  visit_id: number
  patient_id: number
  visit_date: string
  location_name: string
  chief_complaint?: string
  status: "completed" | "pending"
  generated_at?: string
  generated_by?: string
  vital_signs?: any
  clinical_notes?: any[]
  diagnoses?: any[]
  medications?: any[]
}

interface DetailedReport {
  visit_id: number
  patient_id: number
  visit_date: string
  location_name: string
  chief_complaint: string
  vital_signs: Record<string, any>
  clinical_notes: Array<{
    id: number
    note_type: string
    content: string
    created_by: string
    created_at: string
  }>
  diagnoses: Array<{
    icd10_code: string
    description: string
    status: string
  }>
  medications: Array<{
    medication_name: string
    dosage: string
    frequency: string
    duration: string
  }>
  investigations: Array<{
    test_name: string
    result: string
    normal_range: string
    status: string
  }>
  referrals: Array<{
    specialty: string
    reason: string
    urgency: string
    referred_to: string
  }>
  report_generated_at: string
  generated_by: string
}

export function PatientMedicalReports({
  patientId,
  patientName,
}: PatientMedicalReportsProps) {
  const [reports, setReports] = useState<MedicalReport[]>([])
  const [selectedReport, setSelectedReport] = useState<DetailedReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("reports")
  const [showReportDialog, setShowReportDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchMedicalReports()
  }, [patientId])

  const fetchMedicalReports = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await patientPortalService.getPatientMedicalReports(patientId, {
        status: "completed",
      })

      if (response.success && response.data) {
        setReports(response.data)
      } else {
        setError(response.error || "Failed to load medical reports")
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewReport = async (report: MedicalReport) => {
    await handleUpdateWithFeedback(
      async () => {
        const response = await patientPortalService.getVisitReport(report.visit_id)
        if (!response.success) {
          throw new Error(response.error || "Failed to fetch report details")
        }
        setSelectedReport(response.data as DetailedReport)
        setShowReportDialog(true)
        return response
      },
      toast,
      {
        loadingMessage: "Loading medical report...",
        successMessage: "✅ Report loaded",
        errorMessage: "❌ Failed to load report",
      }
    )
  }

  const handleDownloadReport = async (visitId: number) => {
    await handleUpdateWithFeedback(
      async () => {
        setDownloading(visitId)
        const response = await patientPortalService.downloadVisitReport(visitId, "pdf")
        if (!response.success) {
          throw new Error(response.error || "Failed to download report")
        }

        // Trigger download
        if (response.data?.download_url) {
          const link = document.createElement("a")
          link.href = response.data.download_url
          link.download = `medical-report-${visitId}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        }

        return response
      },
      toast,
      {
        loadingMessage: "Generating PDF...",
        successMessage: "✅ Report downloaded successfully!",
        errorMessage: "❌ Failed to download report",
        onSuccess: () => {
          setDownloading(null)
        },
      }
    )
  }

  const handlePrintReport = async (visitId: number) => {
    await handleUpdateWithFeedback(
      async () => {
        const response = await patientPortalService.printVisitReport(visitId)
        if (!response.success) {
          throw new Error(response.error || "Failed to prepare print")
        }

        // Open print dialog
        if (response.data?.content) {
          const printWindow = window.open("", "_blank")
          if (printWindow) {
            printWindow.document.write(response.data.content)
            printWindow.document.close()
            printWindow.print()
          }
        }

        return response
      },
      toast,
      {
        loadingMessage: "Preparing for print...",
        successMessage: "✅ Print dialog opened",
        errorMessage: "❌ Failed to prepare for printing",
      }
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Medical Reports</h2>
        <Button
          onClick={fetchMedicalReports}
          variant="outline"
          disabled={loading}
        >
          <Loader2 className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reports">All Reports</TabsTrigger>
          <TabsTrigger value="info">About Medical Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No medical reports available yet</p>
                <p className="text-sm text-gray-400">
                  Medical reports will be available after your visits are completed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.visit_id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-lg">
                              Visit Report #{report.visit_id}
                            </h3>
                            <Badge
                              variant={
                                report.status === "completed" ? "default" : "secondary"
                              }
                            >
                              {report.status === "completed" ? (
                                <>
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Completed
                                </>
                              ) : (
                                <>
                                  <Clock className="w-3 h-3 mr-1" />
                                  Pending
                                </>
                              )}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" />
                              <span>
                                {new Date(report.visit_date).toLocaleDateString("en-ZA", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-gray-600">
                              <MapPin className="w-4 h-4" />
                              <span>{report.location_name}</span>
                            </div>

                            {report.chief_complaint && (
                              <div className="flex items-start gap-2 text-gray-600 md:col-span-2">
                                <Activity className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>{report.chief_complaint}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap pt-4 border-t">
                        <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewReport(report)}
                              className="gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              View Report
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                            {selectedReport && (
                              <DetailedReportView report={selectedReport} />
                            )}
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadReport(report.visit_id)}
                          disabled={downloading === report.visit_id}
                          className="gap-2"
                        >
                          {downloading === report.visit_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Download PDF
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintReport(report.visit_id)}
                          className="gap-2"
                        >
                          <Printer className="w-4 h-4" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About Your Medical Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    What's Included
                  </h4>
                  <p className="text-sm text-gray-600 ml-6">
                    Each medical report includes vital signs, clinical notes, diagnoses,
                    medications, investigations, and referrals from your visit.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    When Available
                  </h4>
                  <p className="text-sm text-gray-600 ml-6">
                    Reports are automatically generated when your visit is completed and
                    closed by clinic staff. This typically happens within 24 hours of your
                    visit.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <Download className="w-4 h-4 text-purple-600" />
                    Download & Share
                  </h4>
                  <p className="text-sm text-gray-600 ml-6">
                    You can download reports as PDF files to save, email, or share with
                    other healthcare providers. Print-friendly formatting is also available.
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-600" />
                    Privacy & Security
                  </h4>
                  <p className="text-sm text-gray-600 ml-6">
                    Your medical reports are encrypted and only accessible to you. We comply
                    with all healthcare privacy regulations including POPI Act.
                  </p>
                </div>
              </div>

              <Alert className="mt-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  If you don't see a report you expected, please contact clinic support.
                  There may be a delay in report generation for complex cases.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DetailedReportView({ report }: { report: DetailedReport }) {
  return (
    <div className="space-y-6">
      <DialogHeader>
        <DialogTitle>Medical Report - Visit #{report.visit_id}</DialogTitle>
        <DialogDescription>
          {new Date(report.visit_date).toLocaleDateString("en-ZA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}{" "}
          at {report.location_name}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6">
        {/* Patient & Visit Info */}
        <section>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Visit Information
          </h3>
          <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Visit Date</p>
                <p className="font-medium">
                  {new Date(report.visit_date).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Location</p>
                <p className="font-medium">{report.location_name}</p>
              </div>
            </div>
            {report.chief_complaint && (
              <div>
                <p className="text-gray-600">Chief Complaint</p>
                <p className="font-medium">{report.chief_complaint}</p>
              </div>
            )}
          </div>
        </section>

        {/* Vital Signs */}
        {report.vital_signs && Object.keys(report.vital_signs).length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Heart className="w-4 h-4" />
              Vital Signs
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-2 gap-4 text-sm">
              {Object.entries(report.vital_signs).map(([key, value]) => (
                <div key={key}>
                  <p className="text-gray-600 capitalize">{key.replace(/_/g, " ")}</p>
                  <p className="font-medium">{String(value)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Clinical Notes */}
        {report.clinical_notes && report.clinical_notes.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Clinical Notes ({report.clinical_notes.length})
            </h3>
            <div className="space-y-3">
              {report.clinical_notes.map((note, idx) => (
                <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm">{note.note_type}</p>
                    <p className="text-xs text-gray-500">
                      {note.created_by} -{" "}
                      {new Date(note.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-700">{note.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Diagnoses */}
        {report.diagnoses && report.diagnoses.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Diagnoses ({report.diagnoses.length})
            </h3>
            <div className="space-y-2">
              {report.diagnoses.map((diag, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{diag.description}</p>
                      <p className="text-xs text-gray-500">Code: {diag.icd10_code}</p>
                    </div>
                    <Badge variant="outline">{diag.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Medications */}
        {report.medications && report.medications.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Pill className="w-4 h-4" />
              Medications ({report.medications.length})
            </h3>
            <div className="space-y-2">
              {report.medications.map((med, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <p className="font-medium">{med.medication_name}</p>
                  <p className="text-xs text-gray-600">
                    {med.dosage} • {med.frequency} • {med.duration}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Investigations */}
        {report.investigations && report.investigations.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Microscope className="w-4 h-4" />
              Investigations ({report.investigations.length})
            </h3>
            <div className="space-y-2">
              {report.investigations.map((inv, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{inv.test_name}</p>
                    <Badge variant="outline">{inv.status}</Badge>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Result: {inv.result} (Normal: {inv.normal_range})
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Referrals */}
        {report.referrals && report.referrals.length > 0 && (
          <section>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Referrals ({report.referrals.length})
            </h3>
            <div className="space-y-2">
              {report.referrals.map((ref, idx) => (
                <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm">
                  <p className="font-medium">
                    {ref.specialty} - {ref.referred_to}
                  </p>
                  <p className="text-xs text-gray-600">
                    Reason: {ref.reason} • Urgency: {ref.urgency}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Report Footer */}
        <div className="border-t pt-4 text-xs text-gray-500">
          <p>Report generated: {new Date(report.report_generated_at).toLocaleString()}</p>
          <p>Generated by: {report.generated_by}</p>
        </div>
      </div>
    </div>
  )
}
