"use client"

import { useState, useEffect } from "react"
import { Pill, AlertTriangle, CheckCircle, Plus, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"

interface Medication {
  id: string
  name: string
  dosage: string
  frequency: string
  prescribedBy: string
  startDate: string
  endDate?: string
  instructions: string
  sideEffects?: string[]
  isActive: boolean
  adherenceRate: number
}

interface MedicationLog {
  id: string
  medicationId: string
  takenAt: Date
  dosage: string
  notes?: string
  skipped: boolean
}

export function MedicationTracker() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([])
  const [showAddMedication, setShowAddMedication] = useState(false)
  const [selectedMedication, setSelectedMedication] = useState<string>("")

  useEffect(() => {
    // Load medications
    const mockMedications: Medication[] = [
      {
        id: "1",
        name: "Lisinopril",
        dosage: "10mg",
        frequency: "Once daily",
        prescribedBy: "Dr. Sarah Johnson",
        startDate: "2024-01-01",
        instructions: "Take with food in the morning",
        sideEffects: ["Dizziness", "Dry cough"],
        isActive: true,
        adherenceRate: 85,
      },
      {
        id: "2",
        name: "Metformin",
        dosage: "500mg",
        frequency: "Twice daily",
        prescribedBy: "Dr. Michael Chen",
        startDate: "2023-12-15",
        instructions: "Take with meals",
        sideEffects: ["Nausea", "Stomach upset"],
        isActive: true,
        adherenceRate: 92,
      },
      {
        id: "3",
        name: "Vitamin D3",
        dosage: "1000 IU",
        frequency: "Once daily",
        prescribedBy: "Dr. Sarah Johnson",
        startDate: "2023-11-01",
        instructions: "Take with fat-containing meal",
        isActive: true,
        adherenceRate: 78,
      },
    ]
    setMedications(mockMedications)

    // Load medication logs
    const mockLogs: MedicationLog[] = [
      {
        id: "1",
        medicationId: "1",
        takenAt: new Date(),
        dosage: "10mg",
        skipped: false,
      },
      {
        id: "2",
        medicationId: "2",
        takenAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        dosage: "500mg",
        skipped: false,
      },
    ]
    setMedicationLogs(mockLogs)
  }, [])

  const getTodaysDoses = () => {
    const today = new Date().toDateString()
    return medications
      .filter((med) => med.isActive)
      .map((medication) => {
        const todaysLogs = medicationLogs.filter(
          (log) => log.medicationId === medication.id && log.takenAt.toDateString() === today,
        )

        const frequencyMap: { [key: string]: number } = {
          "Once daily": 1,
          "Twice daily": 2,
          "Three times daily": 3,
          "Four times daily": 4,
        }

        const expectedDoses = frequencyMap[medication.frequency] || 1
        const takenDoses = todaysLogs.filter((log) => !log.skipped).length

        return {
          ...medication,
          expectedDoses,
          takenDoses,
          isComplete: takenDoses >= expectedDoses,
          nextDue: getNextDueTime(medication, todaysLogs),
        }
      })
  }

  const getNextDueTime = (medication: Medication, todaysLogs: MedicationLog[]) => {
    // Simplified logic - in real app, this would be more sophisticated
    const now = new Date()
    const hour = now.getHours()

    if (medication.frequency === "Once daily") {
      return todaysLogs.length === 0 ? "9:00 AM" : "Completed"
    } else if (medication.frequency === "Twice daily") {
      if (todaysLogs.length === 0) return "9:00 AM"
      if (todaysLogs.length === 1) return "6:00 PM"
      return "Completed"
    }
    return "Check schedule"
  }

  const markAsTaken = (medicationId: string) => {
    const newLog: MedicationLog = {
      id: Date.now().toString(),
      medicationId,
      takenAt: new Date(),
      dosage: medications.find((m) => m.id === medicationId)?.dosage || "",
      skipped: false,
    }
    setMedicationLogs((prev) => [...prev, newLog])
  }

  const markAsSkipped = (medicationId: string) => {
    const newLog: MedicationLog = {
      id: Date.now().toString(),
      medicationId,
      takenAt: new Date(),
      dosage: medications.find((m) => m.id === medicationId)?.dosage || "",
      skipped: true,
    }
    setMedicationLogs((prev) => [...prev, newLog])
  }

  const getAdherenceColor = (rate: number) => {
    if (rate >= 90) return "text-green-600"
    if (rate >= 75) return "text-yellow-600"
    return "text-red-600"
  }

  const todaysDoses = getTodaysDoses()
  const completedToday = todaysDoses.filter((dose) => dose.isComplete).length
  const totalToday = todaysDoses.length

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Medication Tracker</h2>
          <p className="text-gray-600">Manage your medications and track adherence</p>
        </div>
        <Button onClick={() => setShowAddMedication(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {/* Today's Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Today's Medications
          </CardTitle>
          <CardDescription>
            {completedToday} of {totalToday} doses completed today
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={(completedToday / totalToday) * 100} className="w-full" />

            <div className="grid gap-3">
              {todaysDoses.map((dose) => (
                <div key={dose.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${dose.isComplete ? "bg-green-500" : "bg-yellow-500"}`} />
                    <div>
                      <p className="font-medium">{dose.name}</p>
                      <p className="text-sm text-gray-600">
                        {dose.dosage} - {dose.frequency}
                      </p>
                      <p className="text-xs text-gray-500">Next due: {dose.nextDue}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={dose.isComplete ? "default" : "secondary"}>
                      {dose.takenDoses}/{dose.expectedDoses}
                    </Badge>
                    {!dose.isComplete && (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          onClick={() => markAsTaken(dose.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => markAsSkipped(dose.id)}>
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Medications */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">All Medications</h3>
        <div className="grid gap-4">
          {medications.map((medication) => (
            <Card key={medication.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                      <Pill className="w-5 h-5 text-blue-600" />
                      <h4 className="font-semibold">{medication.name}</h4>
                      <Badge variant={medication.isActive ? "default" : "secondary"}>
                        {medication.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Dosage</p>
                        <p className="font-medium">{medication.dosage}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Frequency</p>
                        <p className="font-medium">{medication.frequency}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Prescribed by</p>
                        <p className="font-medium">{medication.prescribedBy}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Adherence Rate</p>
                        <p className={`font-medium ${getAdherenceColor(medication.adherenceRate)}`}>
                          {medication.adherenceRate}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">
                        <strong>Instructions:</strong> {medication.instructions}
                      </p>
                      {medication.sideEffects && medication.sideEffects.length > 0 && (
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />
                          <div>
                            <p className="text-sm text-gray-600">
                              <strong>Possible side effects:</strong>
                            </p>
                            <p className="text-sm text-gray-500">{medication.sideEffects.join(", ")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2 ml-4">
                    <Switch
                      checked={medication.isActive}
                      onCheckedChange={(checked) => {
                        setMedications((prev) =>
                          prev.map((med) => (med.id === medication.id ? { ...med, isActive: checked } : med)),
                        )
                      }}
                    />
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
