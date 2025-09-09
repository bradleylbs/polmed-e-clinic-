"use client"

import { useState } from "react"
import { offlineManager } from "@/lib/offline-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import {
  Search,
  Plus,
  Package,
  Pill,
  Syringe,
  Badge as Bandage,
  CalendarIcon,
  TrendingDown,
  Clock,
  MapPin,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"

interface Consumable {
  id: string
  name: string
  category: "pharmaceutical" | "medical_supply" | "disposable" | "other"
  batchNumber: string
  supplier: string
  expiryDate: Date
  loadingDate: Date
  initialQuantity: number
  currentQuantity: number
  unit: string
  location: string
  usageHistory: UsageRecord[]
  alertThreshold: number
  cost: number
}

interface UsageRecord {
  id: string
  date: Date
  quantity: number
  location: string
  usedBy: string
  patientId?: string
  notes?: string
}

interface ConsumablesManagementProps {
  userRole: string
}

const consumableCategories = [
  { value: "pharmaceutical", label: "Pharmaceuticals", icon: Pill, color: "bg-blue-100 text-blue-800" },
  { value: "medical_supply", label: "Medical Supplies", icon: Syringe, color: "bg-green-100 text-green-800" },
  { value: "disposable", label: "Disposables", icon: Bandage, color: "bg-purple-100 text-purple-800" },
  { value: "other", label: "Other Supplies", icon: Package, color: "bg-gray-100 text-gray-800" },
]

// Mock consumables data
const mockConsumables: Consumable[] = [
  {
    id: "CON-001",
    name: "Paracetamol 500mg Tablets",
    category: "pharmaceutical",
    batchNumber: "PAR2024001",
    supplier: "Pharma Solutions SA",
    expiryDate: new Date("2025-08-15"),
    loadingDate: new Date("2024-01-15"),
    initialQuantity: 1000,
    currentQuantity: 750,
    unit: "tablets",
    location: "Mobile Clinic Unit 1",
    alertThreshold: 100,
    cost: 0.5,
    usageHistory: [
      {
        id: "usage-001",
        date: new Date("2024-01-20"),
        quantity: 50,
        location: "Durban Central Police Station",
        usedBy: "Dr. Smith",
        patientId: "PAT-001",
        notes: "Headache treatment",
      },
    ],
  },
  {
    id: "CON-002",
    name: "Disposable Syringes 5ml",
    category: "disposable",
    batchNumber: "SYR2024002",
    supplier: "MedSupply Co",
    expiryDate: new Date("2024-06-30"),
    loadingDate: new Date("2024-01-10"),
    initialQuantity: 500,
    currentQuantity: 45,
    unit: "pieces",
    location: "Mobile Clinic Unit 2",
    alertThreshold: 50,
    cost: 2.5,
    usageHistory: [
      {
        id: "usage-002",
        date: new Date("2024-01-25"),
        quantity: 25,
        location: "Cape Town Community Center",
        usedBy: "Nurse Johnson",
        notes: "Vaccination program",
      },
    ],
  },
  {
    id: "CON-003",
    name: "Blood Pressure Cuffs",
    category: "medical_supply",
    batchNumber: "BPC2024003",
    supplier: "Healthcare Equipment Ltd",
    expiryDate: new Date("2027-12-31"),
    loadingDate: new Date("2024-01-05"),
    initialQuantity: 20,
    currentQuantity: 18,
    unit: "pieces",
    location: "Mobile Clinic Unit 1",
    alertThreshold: 5,
    cost: 45.0,
    usageHistory: [],
  },
]

export function ConsumablesManagement({ userRole }: ConsumablesManagementProps) {
  const [consumables, setConsumables] = useState<Consumable[]>(mockConsumables)
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [alertFilter, setAlertFilter] = useState<string>("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null)
  const [showUsageForm, setShowUsageForm] = useState(false)
  const [newConsumable, setNewConsumable] = useState<Partial<Consumable>>({
    name: "",
    category: "pharmaceutical",
    batchNumber: "",
    supplier: "",
    expiryDate: new Date(),
    loadingDate: new Date(),
    initialQuantity: 0,
    currentQuantity: 0,
    unit: "",
    location: "",
    alertThreshold: 0,
    cost: 0,
  })
  const [newUsage, setNewUsage] = useState({
    quantity: 0,
    location: "",
    usedBy: "",
    patientId: "",
    notes: "",
  })

  const getExpiryStatus = (expiryDate: Date) => {
    const today = new Date()
    const daysUntilExpiry = differenceInDays(expiryDate, today)

    if (daysUntilExpiry < 0) {
      return { status: "expired", color: "bg-red-100 text-red-800", label: "Expired" }
    } else if (daysUntilExpiry <= 30) {
      return { status: "expiring", color: "bg-orange-100 text-orange-800", label: "Expiring Soon" }
    } else if (daysUntilExpiry <= 90) {
      return { status: "warning", color: "bg-yellow-100 text-yellow-800", label: "Expires in 3 months" }
    }
    return { status: "good", color: "bg-green-100 text-green-800", label: "Good" }
  }

  const getStockStatus = (consumable: Consumable) => {
    const percentage = (consumable.currentQuantity / consumable.initialQuantity) * 100
    const isLowStock = consumable.currentQuantity <= consumable.alertThreshold

    if (consumable.currentQuantity === 0) {
      return { status: "out", color: "bg-red-100 text-red-800", label: "Out of Stock", percentage: 0 }
    } else if (isLowStock) {
      return { status: "low", color: "bg-orange-100 text-orange-800", label: "Low Stock", percentage }
    } else if (percentage <= 50) {
      return { status: "medium", color: "bg-yellow-100 text-yellow-800", label: "Medium Stock", percentage }
    }
    return { status: "good", color: "bg-green-100 text-green-800", label: "Good Stock", percentage }
  }

  const filteredConsumables = consumables.filter((consumable) => {
    const matchesSearch =
      consumable.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consumable.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consumable.supplier.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === "all" || consumable.category === categoryFilter

    let matchesAlert = true
    if (alertFilter === "expiring") {
      const expiryStatus = getExpiryStatus(consumable.expiryDate)
      matchesAlert = expiryStatus.status === "expiring" || expiryStatus.status === "expired"
    } else if (alertFilter === "low_stock") {
      const stockStatus = getStockStatus(consumable)
      matchesAlert = stockStatus.status === "low" || stockStatus.status === "out"
    }

    return matchesSearch && matchesCategory && matchesAlert
  })

  const getCategoryConfig = (category: Consumable["category"]) => {
    return consumableCategories.find((c) => c.value === category) || consumableCategories[0]
  }

  const addConsumable = async () => {
    if (newConsumable.name && newConsumable.batchNumber && newConsumable.supplier) {
      const consumable: Consumable = {
        id: `CON-${String(consumables.length + 1).padStart(3, "0")}`,
        name: newConsumable.name,
        category: newConsumable.category as Consumable["category"],
        batchNumber: newConsumable.batchNumber,
        supplier: newConsumable.supplier,
        expiryDate: newConsumable.expiryDate || new Date(),
        loadingDate: newConsumable.loadingDate || new Date(),
        initialQuantity: newConsumable.initialQuantity || 0,
        currentQuantity: newConsumable.currentQuantity || newConsumable.initialQuantity || 0,
        unit: newConsumable.unit || "",
        location: newConsumable.location || "",
        alertThreshold: newConsumable.alertThreshold || 0,
        cost: newConsumable.cost || 0,
        usageHistory: [],
      }

      // If offline, save to IndexedDB and queue for sync
      if (!offlineManager.getConnectionStatus()) {
        await offlineManager.saveData("consumables", { ...consumable, timestamp: Date.now() })
      }

      setConsumables([...consumables, consumable])
      setNewConsumable({
        name: "",
        category: "pharmaceutical",
        batchNumber: "",
        supplier: "",
        expiryDate: new Date(),
        loadingDate: new Date(),
        initialQuantity: 0,
        currentQuantity: 0,
        unit: "",
        location: "",
        alertThreshold: 0,
        cost: 0,
      })
      setShowAddForm(false)
    }
  }

  const recordUsage = () => {
    if (selectedConsumable && newUsage.quantity > 0 && newUsage.location && newUsage.usedBy) {
      const usage: UsageRecord = {
        id: `usage-${Date.now()}`,
        date: new Date(),
        quantity: newUsage.quantity,
        location: newUsage.location,
        usedBy: newUsage.usedBy,
        patientId: newUsage.patientId || undefined,
        notes: newUsage.notes || undefined,
      }

      setConsumables(
        consumables.map((consumable) =>
          consumable.id === selectedConsumable.id
            ? {
                ...consumable,
                currentQuantity: Math.max(0, consumable.currentQuantity - newUsage.quantity),
                usageHistory: [...consumable.usageHistory, usage],
              }
            : consumable,
        ),
      )

      setNewUsage({
        quantity: 0,
        location: "",
        usedBy: "",
        patientId: "",
        notes: "",
      })
      setShowUsageForm(false)
      setSelectedConsumable(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Consumables Management</h2>
          <p className="text-muted-foreground">Track pharmaceuticals, medical supplies, and consumables</p>
        </div>
        {(userRole === "administrator" || userRole === "doctor" || userRole === "nurse") && (
          <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Consumable
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name, batch number, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {consumableCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by alerts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Add Consumable Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Consumable</CardTitle>
            <CardDescription>Register a new pharmaceutical or medical supply</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input
                  value={newConsumable.name}
                  onChange={(e) => setNewConsumable({ ...newConsumable, name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newConsumable.category}
                  onValueChange={(value) =>
                    setNewConsumable({ ...newConsumable, category: value as Consumable["category"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {consumableCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Batch Number</Label>
                <Input
                  value={newConsumable.batchNumber}
                  onChange={(e) => setNewConsumable({ ...newConsumable, batchNumber: e.target.value })}
                  placeholder="Enter batch number"
                />
              </div>

              <div className="space-y-2">
                <Label>Supplier</Label>
                <Input
                  value={newConsumable.supplier}
                  onChange={(e) => setNewConsumable({ ...newConsumable, supplier: e.target.value })}
                  placeholder="Enter supplier name"
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal bg-transparent">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newConsumable.expiryDate ? format(newConsumable.expiryDate, "PPP") : "Select expiry date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newConsumable.expiryDate}
                      onSelect={(date) => setNewConsumable({ ...newConsumable, expiryDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Initial Quantity</Label>
                <Input
                  type="number"
                  value={newConsumable.initialQuantity}
                  onChange={(e) =>
                    setNewConsumable({
                      ...newConsumable,
                      initialQuantity: Number.parseInt(e.target.value),
                      currentQuantity: Number.parseInt(e.target.value),
                    })
                  }
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={newConsumable.unit}
                  onChange={(e) => setNewConsumable({ ...newConsumable, unit: e.target.value })}
                  placeholder="e.g., tablets, pieces, ml"
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={newConsumable.location}
                  onChange={(e) => setNewConsumable({ ...newConsumable, location: e.target.value })}
                  placeholder="Enter storage location"
                />
              </div>

              <div className="space-y-2">
                <Label>Alert Threshold</Label>
                <Input
                  type="number"
                  value={newConsumable.alertThreshold}
                  onChange={(e) =>
                    setNewConsumable({ ...newConsumable, alertThreshold: Number.parseInt(e.target.value) })
                  }
                  placeholder="Minimum stock level"
                />
              </div>

              <div className="space-y-2">
                <Label>Cost per Unit (ZAR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newConsumable.cost}
                  onChange={(e) => setNewConsumable({ ...newConsumable, cost: Number.parseFloat(e.target.value) })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={addConsumable}>Add Consumable</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Recording Form */}
      {showUsageForm && selectedConsumable && (
        <Card>
          <CardHeader>
            <CardTitle>Record Usage - {selectedConsumable.name}</CardTitle>
            <CardDescription>Track consumption and usage details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity Used</Label>
                <Input
                  type="number"
                  value={newUsage.quantity}
                  onChange={(e) => setNewUsage({ ...newUsage, quantity: Number.parseInt(e.target.value) })}
                  placeholder="0"
                  max={selectedConsumable.currentQuantity}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {selectedConsumable.currentQuantity} {selectedConsumable.unit}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Location Used</Label>
                <Input
                  value={newUsage.location}
                  onChange={(e) => setNewUsage({ ...newUsage, location: e.target.value })}
                  placeholder="Enter location where used"
                />
              </div>

              <div className="space-y-2">
                <Label>Used By</Label>
                <Input
                  value={newUsage.usedBy}
                  onChange={(e) => setNewUsage({ ...newUsage, usedBy: e.target.value })}
                  placeholder="Staff member name"
                />
              </div>

              <div className="space-y-2">
                <Label>Patient ID (Optional)</Label>
                <Input
                  value={newUsage.patientId}
                  onChange={(e) => setNewUsage({ ...newUsage, patientId: e.target.value })}
                  placeholder="Patient ID if applicable"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Notes (Optional)</Label>
                <Input
                  value={newUsage.notes}
                  onChange={(e) => setNewUsage({ ...newUsage, notes: e.target.value })}
                  placeholder="Additional notes about usage"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={recordUsage}>Record Usage</Button>
              <Button variant="outline" onClick={() => setShowUsageForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consumables List */}
      <div className="grid gap-4">
        {filteredConsumables.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No consumables found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          filteredConsumables.map((consumable) => {
            const categoryConfig = getCategoryConfig(consumable.category)
            const expiryStatus = getExpiryStatus(consumable.expiryDate)
            const stockStatus = getStockStatus(consumable)
            const CategoryIcon = categoryConfig.icon

            return (
              <Card key={consumable.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CategoryIcon className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{consumable.name}</h3>
                          <Badge className={expiryStatus.color}>
                            <Clock className="w-3 h-3 mr-1" />
                            {expiryStatus.label}
                          </Badge>
                          <Badge className={stockStatus.color}>
                            <Package className="w-3 h-3 mr-1" />
                            {stockStatus.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className={categoryConfig.color}>
                            {categoryConfig.label}
                          </Badge>
                          <Badge variant="outline">Batch: {consumable.batchNumber}</Badge>
                          <Badge variant="outline">ID: {consumable.id}</Badge>
                        </div>

                        <div className="space-y-2 mb-3">
                          <div className="flex items-center justify-between text-sm">
                            <span>Stock Level</span>
                            <span>
                              {consumable.currentQuantity} / {consumable.initialQuantity} {consumable.unit}
                            </span>
                          </div>
                          <Progress value={stockStatus.percentage} className="h-2" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div>
                            <strong>Supplier:</strong> {consumable.supplier}
                          </div>
                          <div>
                            <strong>Expires:</strong> {format(consumable.expiryDate, "PPP")}
                          </div>
                          <div>
                            <strong>Location:</strong> {consumable.location}
                          </div>
                          <div>
                            <strong>Cost/Unit:</strong> R{consumable.cost.toFixed(2)}
                          </div>
                          <div>
                            <strong>Total Value:</strong> R{(consumable.currentQuantity * consumable.cost).toFixed(2)}
                          </div>
                          <div>
                            <strong>Alert Level:</strong> {consumable.alertThreshold} {consumable.unit}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedConsumable(consumable)
                          setShowUsageForm(true)
                        }}
                        disabled={consumable.currentQuantity === 0}
                      >
                        <TrendingDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {consumable.usageHistory.length > 0 && (
                    <div className="border-t pt-3">
                      <h4 className="text-sm font-medium mb-2">Recent Usage</h4>
                      <div className="space-y-1">
                        {consumable.usageHistory.slice(-3).map((usage) => (
                          <div key={usage.id} className="text-xs text-muted-foreground flex items-center gap-2">
                            <MapPin className="w-3 h-3" />
                            <span>
                              {format(usage.date, "MMM dd")} - {usage.quantity} {consumable.unit} used at{" "}
                              {usage.location} by {usage.usedBy}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
