"use client"

import { useState, useEffect } from "react"
import { FileText, Download, Eye, Calendar, Activity, Heart, Thermometer, Weight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface VitalSigns {
  id: string
  date: string
  bloodPressure: { systolic: number; diastolic: number }
  heartRate: number
  temperature: number
  weight: number
  height: number
  bmi: number
  recordedBy: string
}

interface LabResult {
  id: string
  date: string
  testName: string
  value: string
  normalRange: string
  status: "normal" | "high" | "low" | "critical"
  orderedBy: string
  notes?: string
}

interface MedicalDocument {
  id: string
  name: string
  type: "lab_result" | "prescription" | "imaging" | "discharge_summary" | "referral"
  date: string
  provider: string
  size: string
  url: string
}

export function EnhancedHealthRecords() {
  const [vitalSigns, setVitalSigns] = useState<VitalSigns[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [documents, setDocuments] = useState<MedicalDocument[]>([])
  const [selectedTimeRange, setSelectedTimeRange] = useState("6months")

  useEffect(() => {
    // Load vital signs data
    const mockVitals: VitalSigns[] = [
      {
        id: "1",
        date: "2024-01-15",
        bloodPressure: { systolic: 120, diastolic: 80 },
        heartRate: 72,
        temperature: 98.6,
        weight: 165,
        height: 68,
        bmi: 25.1,
        recordedBy: "Nurse Johnson",
      },
      {
        id: "2",
        date: "2024-01-01",
        bloodPressure: { systolic: 118, diastolic: 78 },
        heartRate: 68,
        temperature: 98.4,
        weight: 167,
        height: 68,
        bmi: 25.4,
        recordedBy: "Dr. Sarah Johnson",
      },
      {
        id: "3",
        date: "2023-12-15",
        bloodPressure: { systolic: 122, diastolic: 82 },
        heartRate: 75,
        temperature: 98.8,
        weight: 169,
        height: 68,
        bmi: 25.7,
        recordedBy: "Nurse Smith",
      },
    ]
    setVitalSigns(mockVitals)

    // Load lab results
    const mockLabs: LabResult[] = [
      {
        id: "1",
        date: "2024-01-10",
        testName: "Hemoglobin A1C",
        value: "6.2%",
        normalRange: "<7.0%",
        status: "normal",
        orderedBy: "Dr. Michael Chen",
        notes: "Good diabetes control",
      },
      {
        id: "2",
        date: "2024-01-10",
        testName: "Total Cholesterol",
        value: "195 mg/dL",
        normalRange: "<200 mg/dL",
        status: "normal",
        orderedBy: "Dr. Michael Chen",
      },
      {
        id: "3",
        date: "2024-01-10",
        testName: "LDL Cholesterol",
        value: "125 mg/dL",
        normalRange: "<100 mg/dL",
        status: "high",
        orderedBy: "Dr. Michael Chen",
        notes: "Consider dietary modifications",
      },
    ]
    setLabResults(mockLabs)

    // Load documents
    const mockDocuments: MedicalDocument[] = [
      {
        id: "1",
        name: "Lab Results - Comprehensive Metabolic Panel",
        type: "lab_result",
        date: "2024-01-10",
        provider: "PALMED Lab Services",
        size: "245 KB",
        url: "/documents/lab-results-2024-01-10.pdf",
      },
      {
        id: "2",
        name: "Prescription - Lisinopril",
        type: "prescription",
        date: "2024-01-05",
        provider: "Dr. Sarah Johnson",
        size: "128 KB",
        url: "/documents/prescription-lisinopril.pdf",
      },
      {
        id: "3",
        name: "Chest X-Ray Report",
        type: "imaging",
        date: "2023-12-20",
        provider: "PALMED Imaging",
        size: "1.2 MB",
        url: "/documents/chest-xray-2023-12-20.pdf",
      },
    ]
    setDocuments(mockDocuments)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-green-100 text-green-800"
      case "high":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-blue-100 text-blue-800"
      case "critical":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "lab_result":
        return <Activity className="w-4 h-4" />
      case "prescription":
        return <FileText className="w-4 h-4" />
      case "imaging":
        return <Eye className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  // Prepare chart data
  const chartData = vitalSigns
    .map((vital) => ({
      date: new Date(vital.date).toLocaleDateString(),
      systolic: vital.bloodPressure.systolic,
      diastolic: vital.bloodPressure.diastolic,
      heartRate: vital.heartRate,
      weight: vital.weight,
      bmi: vital.bmi,
    }))
    .reverse()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Health Records</h2>
        <p className="text-gray-600">View your complete medical history and vital signs</p>
      </div>

      <Tabs defaultValue="vitals" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="vitals">Vital Signs</TabsTrigger>
          <TabsTrigger value="labs">Lab Results</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="trends">Health Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="vitals" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {vitalSigns[0] && (
              <>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      <div>
                        <p className="text-sm text-gray-600">Blood Pressure</p>
                        <p className="text-lg font-semibold">
                          {vitalSigns[0].bloodPressure.systolic}/{vitalSigns[0].bloodPressure.diastolic}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-600">Heart Rate</p>
                        <p className="text-lg font-semibold">{vitalSigns[0].heartRate} bpm</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Weight className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-gray-600">Weight</p>
                        <p className="text-lg font-semibold">{vitalSigns[0].weight} lbs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Thermometer className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="text-sm text-gray-600">Temperature</p>
                        <p className="text-lg font-semibold">{vitalSigns[0].temperature}°F</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vital Signs History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {vitalSigns.map((vital) => (
                  <div key={vital.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{new Date(vital.date).toLocaleDateString()}</span>
                      </div>
                      <span className="text-sm text-gray-500">Recorded by {vital.recordedBy}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">BP</p>
                        <p className="font-medium">
                          {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">HR</p>
                        <p className="font-medium">{vital.heartRate} bpm</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Temp</p>
                        <p className="font-medium">{vital.temperature}°F</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Weight</p>
                        <p className="font-medium">{vital.weight} lbs</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Height</p>
                        <p className="font-medium">{vital.height}"</p>
                      </div>
                      <div>
                        <p className="text-gray-500">BMI</p>
                        <p className="font-medium">{vital.bmi}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="labs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Lab Results</CardTitle>
              <CardDescription>Latest laboratory test results and values</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {labResults.map((lab) => (
                  <div key={lab.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{lab.testName}</h4>
                          <Badge className={getStatusColor(lab.status)}>
                            {lab.status.charAt(0).toUpperCase() + lab.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Result</p>
                            <p className="font-medium">{lab.value}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Normal Range</p>
                            <p className="font-medium">{lab.normalRange}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Ordered by</p>
                            <p className="font-medium">{lab.orderedBy}</p>
                          </div>
                        </div>
                        {lab.notes && <p className="text-sm text-gray-600 italic">{lab.notes}</p>}
                      </div>
                      <div className="text-sm text-gray-500">{new Date(lab.date).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Medical Documents</CardTitle>
              <CardDescription>Download and view your medical documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getDocumentIcon(doc.type)}
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-gray-600">
                          {doc.provider} • {new Date(doc.date).toLocaleDateString()} • {doc.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
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
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Blood Pressure Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" name="Diastolic" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Weight & BMI Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" stroke="#10b981" name="Weight (lbs)" />
                    <Line type="monotone" dataKey="bmi" stroke="#f59e0b" name="BMI" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
