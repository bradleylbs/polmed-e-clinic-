"use client"

import { useState, useEffect } from "react"
import { Pill, AlertTriangle, CheckCircle, Plus, Calendar, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface Medication {
  id: number
  name: string
  dosage: string
  frequency: string
  prescribed_by: string
  start_date: string
  end_date?: string
  instructions: string
  side_effects?: string[]
  is_active: boolean
  adherence_rate?: number
}

interface MedicationTrackerProps {
  patientId: number
}

export function MedicationTracker({ patientId }: MedicationTrackerProps) {
  const { toast } = useToast()
  const [medications, setMedications] = useState<Medication[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMedications()
  }, [patientId])

  const loadMedications = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await patientPortalService.getPrescriptions(patientId)
      if (response.success && response.data) {
        setMedications(response.data)
      } else {
        setError(response.error || "Failed to load medications")
        toast({
          title: "Error",
          description: response.error || "Failed to load medications",
          variant: "destructive",
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load medications"
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

  const getFrequencyBadgeColor = (frequency: string) => {
    const lower = frequency.toLowerCase()
    if (lower.includes("daily")) return "bg-blue-100 text-blue-800"
    if (lower.includes("twice")) return "bg-purple-100 text-purple-800"
    if (lower.includes("three")) return "bg-orange-100 text-orange-800"
    return "bg-gray-100 text-gray-800"
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="text-gray-500">Loading medications...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Medications</h2>
          <p className="text-gray-600">Track your current prescriptions and medications</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {medications.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Pill className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No medications found</p>
            <p className="text-sm text-gray-400 mt-2">
              Your medications will appear here once added by your healthcare provider
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {medications.map((medication) => (
            <Card key={medication.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="bg-blue-100 p-3 rounded-lg mt-1">
                      <Pill className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{medication.name}</h3>
                      <p className="text-sm text-gray-600">
                        {medication.dosage} • {medication.frequency}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline" className={getStatusColor(medication.is_active)}>
                          {medication.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className={getFrequencyBadgeColor(medication.frequency)}>
                          {medication.frequency}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Instructions</p>
                    <p className="text-sm text-gray-600 mt-1">{medication.instructions}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700">Prescribed by</p>
                    <p className="text-sm text-gray-600 mt-1">{medication.prescribed_by}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Start Date</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(medication.start_date).toLocaleDateString()}
                    </p>
                  </div>

                  {medication.end_date && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">End Date</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(medication.end_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>

                {medication.side_effects && medication.side_effects.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Possible Side Effects</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {medication.side_effects.map((effect, idx) => (
                            <Badge key={idx} variant="outline" className="bg-yellow-100 text-yellow-800">
                              {effect}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {medication.adherence_rate !== undefined && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-sm font-medium text-gray-700">Adherence Rate</p>
                      <span className="text-sm font-semibold text-gray-900">{medication.adherence_rate}%</span>
                    </div>
                    <Progress value={medication.adherence_rate} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
