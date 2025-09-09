"use client"

import { useState } from "react"
import { offlineManager } from "@/lib/offline-manager"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  Plus,
  Edit,
  Wrench,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  Stethoscope,
  Activity,
  Heart,
} from "lucide-react"
import { format } from "date-fns"

interface MedicalAsset {
  id: string
  name: string
  category: "diagnostic" | "monitoring" | "treatment" | "mobility" | "other"
  serialNumber: string
  manufacturer: string
  model: string
  purchaseDate: Date
  warrantyExpiry?: Date
  status: "operational" | "maintenance" | "broken" | "decommissioned"
  location: string
  lastMaintenance?: Date
  nextMaintenance?: Date
  maintenanceNotes: string
  assignedTo?: string
  value: number
  condition: "excellent" | "good" | "fair" | "poor"
}

interface AssetManagementProps {
  userRole: string
}

const assetCategories = [
  { value: "diagnostic", label: "Diagnostic Equipment", icon: Stethoscope, color: "bg-blue-100 text-blue-800" },
  { value: "monitoring", label: "Monitoring Devices", icon: Activity, color: "bg-green-100 text-green-800" },
  { value: "treatment", label: "Treatment Equipment", icon: Heart, color: "bg-red-100 text-red-800" },
  { value: "mobility", label: "Mobility Aids", icon: Package, color: "bg-purple-100 text-purple-800" },
  { value: "other", label: "Other Equipment", icon: Wrench, color: "bg-gray-100 text-gray-800" },
]

const assetStatuses = [
  { value: "operational", label: "Operational", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  { value: "maintenance", label: "Under Maintenance", icon: Wrench, color: "bg-yellow-100 text-yellow-800" },
  { value: "broken", label: "Broken", icon: XCircle, color: "bg-red-100 text-red-800" },
  { value: "decommissioned", label: "Decommissioned", icon: AlertTriangle, color: "bg-gray-100 text-gray-800" },
]

// Mock asset data
const mockAssets: MedicalAsset[] = [
  {
    id: "AST-001",
    name: "Digital Blood Pressure Monitor",
    category: "monitoring",
    serialNumber: "BP2024001",
    manufacturer: "Omron Healthcare",
    model: "HEM-7156T",
    purchaseDate: new Date("2023-06-15"),
    warrantyExpiry: new Date("2025-06-15"),
    status: "operational",
    location: "Mobile Clinic Unit 1",
    lastMaintenance: new Date("2024-01-15"),
    nextMaintenance: new Date("2024-07-15"),
    maintenanceNotes: "Regular calibration completed",
    assignedTo: "Nurse Johnson",
    value: 2500,
    condition: "excellent",
  },
  {
    id: "AST-002",
    name: "Digital Thermometer",
    category: "diagnostic",
    serialNumber: "TH2024002",
    manufacturer: "Braun",
    model: "ThermoScan 7",
    purchaseDate: new Date("2023-08-20"),
    warrantyExpiry: new Date("2025-08-20"),
    status: "maintenance",
    location: "Mobile Clinic Unit 2",
    lastMaintenance: new Date("2024-01-20"),
    nextMaintenance: new Date("2024-02-20"),
    maintenanceNotes: "Battery replacement needed",
    assignedTo: "Dr. Smith",
    value: 800,
    condition: "good",
  },
  {
    id: "AST-003",
    name: "Portable ECG Machine",
    category: "diagnostic",
    serialNumber: "ECG2024003",
    manufacturer: "Philips",
    model: "PageWriter TC20",
    purchaseDate: new Date("2023-03-10"),
    warrantyExpiry: new Date("2026-03-10"),
    status: "broken",
    location: "Repair Center",
    lastMaintenance: new Date("2023-12-10"),
    nextMaintenance: new Date("2024-06-10"),
    maintenanceNotes: "Display screen malfunction - awaiting parts",
    value: 15000,
    condition: "poor",
  },
]

export function AssetManagement({ userRole }: AssetManagementProps) {
  const [assets, setAssets] = useState<MedicalAsset[]>(mockAssets)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<MedicalAsset | null>(null)
  const [newAsset, setNewAsset] = useState<Partial<MedicalAsset>>({
    name: "",
    category: "diagnostic",
    serialNumber: "",
    manufacturer: "",
    model: "",
    purchaseDate: new Date(),
    status: "operational",
    location: "",
    maintenanceNotes: "",
    value: 0,
    condition: "excellent",
  })

  const filteredAssets = assets.filter((asset) => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.model.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || asset.status === statusFilter
    const matchesCategory = categoryFilter === "all" || asset.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  const getStatusConfig = (status: MedicalAsset["status"]) => {
    return assetStatuses.find((s) => s.value === status) || assetStatuses[0]
  }

  const getCategoryConfig = (category: MedicalAsset["category"]) => {
    return assetCategories.find((c) => c.value === category) || assetCategories[0]
  }

  const getMaintenanceAlert = (asset: MedicalAsset) => {
    if (!asset.nextMaintenance) return null

    const today = new Date()
    const daysUntilMaintenance = Math.ceil((asset.nextMaintenance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilMaintenance <= 7) {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Maintenance Due
        </Badge>
      )
    } else if (daysUntilMaintenance <= 30) {
      return (
        <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
          <Wrench className="w-3 h-3 mr-1" />
          Maintenance Soon
        </Badge>
      )
    }

    return null
  }

  const addAsset = async () => {
    if (newAsset.name && newAsset.serialNumber && newAsset.manufacturer) {
      const asset: MedicalAsset = {
        id: `AST-${String(assets.length + 1).padStart(3, "0")}`,
        name: newAsset.name,
        category: newAsset.category as MedicalAsset["category"],
        serialNumber: newAsset.serialNumber,
        manufacturer: newAsset.manufacturer,
        model: newAsset.model || "",
        purchaseDate: newAsset.purchaseDate || new Date(),
        status: newAsset.status as MedicalAsset["status"],
        location: newAsset.location || "",
        maintenanceNotes: newAsset.maintenanceNotes || "",
        value: newAsset.value || 0,
        condition: newAsset.condition as MedicalAsset["condition"],
      }

      // If offline, save to IndexedDB and queue for sync
      if (!offlineManager.getConnectionStatus()) {
        await offlineManager.saveData("assets", { ...asset, timestamp: Date.now() })
      }

      setAssets([...assets, asset])
      setNewAsset({
        name: "",
        category: "diagnostic",
        serialNumber: "",
        manufacturer: "",
        model: "",
        purchaseDate: new Date(),
        status: "operational",
        location: "",
        maintenanceNotes: "",
        value: 0,
        condition: "excellent",
      })
      setShowAddForm(false)
    }
  }

  const updateAssetStatus = (assetId: string, newStatus: MedicalAsset["status"]) => {
    setAssets(
      assets.map((asset) =>
        asset.id === assetId
          ? {
              ...asset,
              status: newStatus,
              lastMaintenance: newStatus === "operational" ? new Date() : asset.lastMaintenance,
            }
          : asset,
      ),
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Asset Management</h2>
          <p className="text-muted-foreground">Track and manage medical equipment and assets</p>
        </div>
        {(userRole === "administrator" || userRole === "doctor" || userRole === "nurse") && (
          <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Asset
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
                  placeholder="Search by name, serial number, manufacturer, or model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {assetStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {assetCategories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Add Asset Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Asset</CardTitle>
            <CardDescription>Register a new medical asset or equipment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Name</Label>
                <Input
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  placeholder="Enter asset name"
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={newAsset.category}
                  onValueChange={(value) => setNewAsset({ ...newAsset, category: value as MedicalAsset["category"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input
                  value={newAsset.serialNumber}
                  onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
                  placeholder="Enter serial number"
                />
              </div>

              <div className="space-y-2">
                <Label>Manufacturer</Label>
                <Input
                  value={newAsset.manufacturer}
                  onChange={(e) => setNewAsset({ ...newAsset, manufacturer: e.target.value })}
                  placeholder="Enter manufacturer"
                />
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  value={newAsset.model}
                  onChange={(e) => setNewAsset({ ...newAsset, model: e.target.value })}
                  placeholder="Enter model"
                />
              </div>

              <div className="space-y-2">
                <Label>Value (ZAR)</Label>
                <Input
                  type="number"
                  value={newAsset.value}
                  onChange={(e) => setNewAsset({ ...newAsset, value: Number.parseFloat(e.target.value) })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                  placeholder="Enter current location"
                />
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={newAsset.condition}
                  onValueChange={(value) => setNewAsset({ ...newAsset, condition: value as MedicalAsset["condition"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={addAsset}>Add Asset</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset List */}
      <div className="grid gap-4">
        {filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No assets found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((asset) => {
            const statusConfig = getStatusConfig(asset.status)
            const categoryConfig = getCategoryConfig(asset.category)
            const StatusIcon = statusConfig.icon
            const CategoryIcon = categoryConfig.icon
            const maintenanceAlert = getMaintenanceAlert(asset)

            return (
              <Card key={asset.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <CategoryIcon className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-foreground">{asset.name}</h3>
                          <Badge className={statusConfig.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          {maintenanceAlert}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className={categoryConfig.color}>
                            {categoryConfig.label}
                          </Badge>
                          <Badge variant="outline">ID: {asset.id}</Badge>
                          <Badge variant="outline">SN: {asset.serialNumber}</Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div>
                            <strong>Manufacturer:</strong> {asset.manufacturer}
                          </div>
                          <div>
                            <strong>Model:</strong> {asset.model}
                          </div>
                          <div>
                            <strong>Location:</strong> {asset.location}
                          </div>
                          <div>
                            <strong>Value:</strong> R{asset.value.toLocaleString()}
                          </div>
                          <div>
                            <strong>Condition:</strong> <span className="capitalize">{asset.condition}</span>
                          </div>
                          {asset.assignedTo && (
                            <div>
                              <strong>Assigned to:</strong> {asset.assignedTo}
                            </div>
                          )}
                          {asset.nextMaintenance && (
                            <div className="sm:col-span-2 lg:col-span-3">
                              <strong>Next Maintenance:</strong> {format(asset.nextMaintenance, "PPP")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" onClick={() => setSelectedAsset(asset)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      {asset.status === "maintenance" && (
                        <Button variant="outline" size="sm" onClick={() => updateAssetStatus(asset.id, "operational")}>
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {asset.status === "operational" && (
                        <Button variant="outline" size="sm" onClick={() => updateAssetStatus(asset.id, "maintenance")}>
                          <Wrench className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {asset.maintenanceNotes && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-muted-foreground">
                        <strong>Maintenance Notes:</strong> {asset.maintenanceNotes}
                      </p>
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
