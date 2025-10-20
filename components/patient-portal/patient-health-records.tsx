"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  FileText,
  Activity,
  Calendar,
  Download,
  Eye,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { patientPortalService } from "@/lib/patient-portal-service"

interface PatientHealthRecordsProps {
  patientId: number
}

interface VisitRecord {
  visit_id?: number
  id?: number
  visit_date: string
  location_name: string
  chief_complaint?: string
  is_completed: boolean
  completed_stages?: number
  total_stages?: number
}

interface HealthDocument {
  id: number
  document_name: string
  document_type: string
  upload_date?: string
  created_at?: string
  file_size?: string | number
  download_url?: string
}

export function PatientHealthRecords({ patientId }: PatientHealthRecordsProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([])
  const [documents, setDocuments] = useState<HealthDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("visits")
  const { toast } = useToast()

  useEffect(() => {
    fetchHealthRecords()
  }, [patientId])

  const fetchHealthRecords = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch visits from service (with dashboard fallback)
      const visitsResponse = await patientPortalService.getPatientVisitHistory(patientId)
      
      // Fetch documents
      const documentsResponse = await patientPortalService.getPatientDocuments(patientId)

      if (visitsResponse.success && visitsResponse.data) {
        // Transform visit data to match VisitRecord interface
        const transformedVisits = (visitsResponse.data || []).map((visit: any) => ({
          id: visit.id || visit.visit_id,
          visit_id: visit.visit_id || visit.id,
          visit_date: visit.visit_date || visit.appointment_date,
          location_name: visit.location_name || "Mobile Clinic",
          chief_complaint: visit.chief_complaint || visit.reason_for_visit,
          is_completed: visit.is_completed || visit.status === "completed",
          completed_stages: visit.completed_stages,
          total_stages: visit.total_stages,
        }))
        setVisits(transformedVisits)
      }

      if (documentsResponse.success && documentsResponse.data) {
        const transformedDocs = (documentsResponse.data || []).map((doc: any) => ({
          id: doc.id,
          document_name: doc.document_name || doc.file_name,
          document_type: doc.document_type,
          upload_date: doc.upload_date || doc.created_at,
          created_at: doc.created_at,
          file_size: doc.file_size || doc.size,
          download_url: doc.download_url,
        }))
        setDocuments(transformedDocs)
      }

      if (!visitsResponse.success && !documentsResponse.success) {
        setError("Failed to load health records. Please try again later.")
        toast({
          title: "Error",
          description: "Failed to load health records",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load health records"
      setError(errorMsg)
      console.error("Error fetching health records:", err)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const handleDownloadDocument = (document: HealthDocument) => {
    toast({
      title: "Download Started",
      description: `Downloading ${document.document_name}`,
    })
    // In a real app, this would trigger an actual download
    if (document.download_url) {
      window.open(document.download_url, "_blank")
    }
  }

  const handleViewDocument = (document: HealthDocument) => {
    toast({
      title: "Opening Document",
      description: `Opening ${document.document_name}`,
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Loader2 className="w-6 h-6 mx-auto animate-spin text-gray-400 mb-2" />
          <p className="text-gray-500">Loading health records...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Health Records</h2>
        <p className="text-gray-600">View your visit history and medical documents</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visits">Visit History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-4">
          {visits.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No visit records available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {visits.map((visit) => (
                <Card key={visit.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <h3 className="text-lg font-semibold">{formatDate(visit.visit_date)}</h3>
                          <Badge variant={visit.is_completed ? "default" : "outline"}>
                            {visit.is_completed ? "Completed" : "In Progress"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">{visit.location_name}</p>
                        {visit.chief_complaint && (
                          <p className="text-sm text-gray-600 mt-1">Chief Complaint: {visit.chief_complaint}</p>
                        )}
                      </div>
                    </div>

                    {visit.completed_stages !== undefined && visit.total_stages !== undefined && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Progress: {visit.completed_stages} of {visit.total_stages} stages completed
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(visit.completed_stages / Math.max(visit.total_stages, 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {documents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No documents available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {documents.map((document) => (
                <Card key={document.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold">{document.document_name}</h3>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant="outline">{document.document_type}</Badge>
                          <span className="text-sm text-gray-600">{document.file_size}</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-2">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {document.upload_date ? formatDate(document.upload_date) : document.created_at ? formatDate(document.created_at) : "Unknown date"}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocument(document)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadDocument(document)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
