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
  Heart,
  Thermometer,
  Weight,
  Ruler,
  Calendar,
  Download,
  Eye,
  AlertCircle,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PatientHealthRecordsProps {
  patientId: number
}

interface VisitRecord {
  visit_id: number
  visit_date: string
  location_name: string
  chief_complaint: string
  diagnosis: string
  treatment_notes: string
  vital_signs: {
    temperature?: number
    blood_pressure?: string
    heart_rate?: number
    weight?: number
    height?: number
  }
  medications_prescribed: string[]
  follow_up_required: boolean
  is_completed: boolean
}

interface HealthDocument {
  id: number
  document_name: string
  document_type: string
  upload_date: string
  file_size: string
  download_url: string
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
      // Mock data for now - replace with actual API calls
      const mockVisits: VisitRecord[] = [
        {
          visit_id: 1,
          visit_date: "2024-01-15",
          location_name: "Johannesburg Mobile Clinic",
          chief_complaint: "Routine checkup",
          diagnosis: "Hypertension - well controlled",
          treatment_notes: "Continue current medication. Monitor blood pressure daily.",
          vital_signs: {
            temperature: 36.5,
            blood_pressure: "130/85",
            heart_rate: 72,
            weight: 75.5,
            height: 170,
          },
          medications_prescribed: ["Amlodipine 5mg", "Hydrochlorothiazide 25mg"],
          follow_up_required: true,
          is_completed: true,
        },
        {
          visit_id: 2,
          visit_date: "2024-02-20",
          location_name: "Cape Town Mobile Clinic",
          chief_complaint: "Headache and fatigue",
          diagnosis: "Tension headache",
          treatment_notes: "Prescribed pain relief. Advised rest and hydration.",
          vital_signs: {
            temperature: 37.1,
            blood_pressure: "125/80",
            heart_rate: 78,
            weight: 74.8,
          },
          medications_prescribed: ["Paracetamol 500mg"],
          follow_up_required: false,
          is_completed: true,
        },
      ]

      const mockDocuments: HealthDocument[] = [
        {
          id: 1,
          document_name: "Blood Test Results - January 2024",
          document_type: "Lab Results",
          upload_date: "2024-01-16",
          file_size: "245 KB",
          download_url: "#",
        },
        {
          id: 2,
          document_name: "Prescription - February 2024",
          document_type: "Prescription",
          upload_date: "2024-02-20",
          file_size: "128 KB",
          download_url: "#",
        },
      ]

      setVisits(mockVisits)
      setDocuments(mockDocuments)
    } catch (err) {
      setError("Failed to load health records")
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
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading health records...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Health Records</h2>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          Export All
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="visits">Visit History</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="space-y-4">
          {visits.length > 0 ? (
            visits.map((visit) => (
              <Card key={visit.visit_id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      {formatDate(visit.visit_date)}
                    </CardTitle>
                    <Badge variant={visit.is_completed ? "default" : "secondary"}>
                      {visit.is_completed ? "Completed" : "In Progress"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{visit.location_name}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Chief Complaint</h4>
                      <p className="text-sm">{visit.chief_complaint}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Diagnosis</h4>
                      <p className="text-sm">{visit.diagnosis}</p>
                    </div>
                  </div>

                  {visit.vital_signs && Object.keys(visit.vital_signs).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Vital Signs
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {visit.vital_signs.temperature && (
                          <div className="flex items-center gap-2">
                            <Thermometer className="w-4 h-4 text-red-500" />
                            <div>
                              <p className="text-sm font-medium">{visit.vital_signs.temperature}°C</p>
                              <p className="text-xs text-muted-foreground">Temperature</p>
                            </div>
                          </div>
                        )}
                        {visit.vital_signs.blood_pressure && (
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4 text-red-500" />
                            <div>
                              <p className="text-sm font-medium">{visit.vital_signs.blood_pressure}</p>
                              <p className="text-xs text-muted-foreground">Blood Pressure</p>
                            </div>
                          </div>
                        )}
                        {visit.vital_signs.heart_rate && (
                          <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-500" />
                            <div>
                              <p className="text-sm font-medium">{visit.vital_signs.heart_rate} bpm</p>
                              <p className="text-xs text-muted-foreground">Heart Rate</p>
                            </div>
                          </div>
                        )}
                        {visit.vital_signs.weight && (
                          <div className="flex items-center gap-2">
                            <Weight className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="text-sm font-medium">{visit.vital_signs.weight} kg</p>
                              <p className="text-xs text-muted-foreground">Weight</p>
                            </div>
                          </div>
                        )}
                        {visit.vital_signs.height && (
                          <div className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-purple-500" />
                            <div>
                              <p className="text-sm font-medium">{visit.vital_signs.height} cm</p>
                              <p className="text-xs text-muted-foreground">Height</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium mb-2">Treatment Notes</h4>
                    <p className="text-sm">{visit.treatment_notes}</p>
                  </div>

                  {visit.medications_prescribed.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Medications Prescribed</h4>
                      <div className="flex flex-wrap gap-2">
                        {visit.medications_prescribed.map((medication, index) => (
                          <Badge key={index} variant="outline">
                            {medication}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {visit.follow_up_required && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Follow-up appointment recommended</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No visit records found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          {documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((document) => (
                <Card key={document.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <FileText className="w-8 h-8 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{document.document_name}</h4>
                        <p className="text-sm text-muted-foreground">{document.document_type}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(document.upload_date)} • {document.file_size}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" onClick={() => handleDownloadDocument(document)}>
                            <Download className="w-3 h-3 mr-1" />
                            Download
                          </Button>
                          <Button size="sm" variant="ghost">
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No documents available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
