"use client"

import { useState, useEffect } from "react"
import { FileText, Download, Eye, Calendar, Activity, Heart, Thermometer, Weight, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface LabResult {
  id: number
  date: string
  testName: string
  value: string
  normalRange?: string
  status: "normal" | "high" | "low" | "critical"
  orderedBy: string
  notes?: string
}

interface MedicalRecord {
  id: number
  date: string
  type: string
  title: string
  description?: string
  provider: string
}

interface EnhancedHealthRecordsProps {
  patientId: number
}

export function EnhancedHealthRecords({ patientId }: EnhancedHealthRecordsProps) {
  const { toast } = useToast()
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("lab-results")

  useEffect(() => {
    loadHealthData()
  }, [patientId])

  const loadHealthData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [labsResponse, recordsResponse] = await Promise.all([
        patientPortalService.getTestResults(patientId),
        patientPortalService.getMedicalRecords(patientId),
      ])

      if (labsResponse.success && labsResponse.data) {
        setLabResults(labsResponse.data)
      }

      if (recordsResponse.success && recordsResponse.data) {
        setMedicalRecords(recordsResponse.data)
      }

      if (!labsResponse.success && !recordsResponse.success) {
        setError("Failed to load health records")
        toast({
          title: "Error",
          description: "Failed to load health records",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load health records"
      setError(errorMsg)
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-green-100 text-green-800"
      case "high":
        return "bg-orange-100 text-orange-800"
      case "low":
        return "bg-blue-100 text-blue-800"
      case "critical":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "normal":
        return "✓"
      case "high":
        return "↑"
      case "low":
        return "↓"
      case "critical":
        return "!"
      default:
        return "○"
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-gray-500">Loading health records...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Health Records</h2>
        <p className="text-gray-600">View your medical records, lab results, and test reports</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lab-results">Lab Results</TabsTrigger>
          <TabsTrigger value="medical-records">Medical Records</TabsTrigger>
        </TabsList>

        <TabsContent value="lab-results" className="space-y-4">
          {labResults.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No lab results available</p>
                <p className="text-sm text-gray-400 mt-2">Your lab results will appear here once completed</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {labResults.map((result) => (
                <Card key={result.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold">{result.testName}</h3>
                          <Badge className={getStatusColor(result.status)}>
                            {getStatusIcon(result.status)} {result.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {new Date(result.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Result</p>
                        <p className="text-lg font-semibold text-gray-900 mt-1">{result.value}</p>
                      </div>

                      {result.normalRange && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Normal Range</p>
                          <p className="text-sm text-gray-600 mt-1">{result.normalRange}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium text-gray-700">Ordered By</p>
                        <p className="text-sm text-gray-600 mt-1">{result.orderedBy}</p>
                      </div>
                    </div>

                    {result.notes && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-medium text-blue-900">Notes</p>
                        <p className="text-sm text-blue-800 mt-1">{result.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="medical-records" className="space-y-4">
          {medicalRecords.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No medical records available</p>
                <p className="text-sm text-gray-400 mt-2">Your medical records will appear here as they are added</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {medicalRecords.map((record) => (
                <Card key={record.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{record.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          <Calendar className="w-4 h-4 inline mr-1" />
                          {new Date(record.date).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Type: {record.type}</p>
                        <p className="text-sm text-gray-600">Provider: {record.provider}</p>

                        {record.description && (
                          <p className="text-sm text-gray-700 mt-3">{record.description}</p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">
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
