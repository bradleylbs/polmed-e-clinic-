"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetManagement } from "./asset-management"
import { ConsumablesManagement } from "./consumables-management"
import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wrench,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"
import { apiService } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

interface InventoryDashboardProps {
  userRole: string
}

interface InventorySummary {
  totalAssets: number
  operationalAssets: number
  assetsUnderMaintenance: number
  brokenAssets: number
  retiredAssets: number
  totalConsumables: number
  lowStockItems: number
  expiringItems: number
  totalInventoryValue: number
  maintenanceAlerts: number
}

interface InventoryAlert {
  id: string
  type: "expiry" | "stock" | "maintenance"
  title: string
  description: string
  severity: "high" | "medium" | "low"
  date: string
}

export function InventoryDashboard({ userRole }: InventoryDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview")
  const [summaryData, setSummaryData] = useState<InventorySummary | null>(null)
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchInventoryData()
  }, [])

  const fetchInventoryData = async () => {
    try {
      setLoading(true)

      // Fetch assets and consumables to calculate summary
      const [assetsResponse, consumablesResponse] = await Promise.all([
        apiService.getAssets(),
        apiService.getConsumables(),
      ])

      if (assetsResponse.success && consumablesResponse.success) {
        const assets = assetsResponse.data || []
        const consumables = consumablesResponse.data || []

        // Calculate summary data from API responses
        const summary: InventorySummary = {
          totalAssets: assets.length,
          operationalAssets: assets.filter((a: any) => a.status === "Operational").length,
          assetsUnderMaintenance: assets.filter((a: any) => a.status === "Maintenance Required").length,
          brokenAssets: assets.filter((a: any) => a.status === "Out of Service").length,
          retiredAssets: assets.filter((a: any) => a.status === "Retired").length,
          totalConsumables: consumables.length,
          // Use backend-computed stock_status to avoid UI misreads
          lowStockItems: consumables.filter(
            (c: any) => c.stock_status === "low_stock" || c.stock_status === "out_of_stock",
          ).length,
          expiringItems: consumables.filter((c: any) => {
            if (!c.expiry_date) return false
            const expiryDate = new Date(c.expiry_date)
            const threeMonthsFromNow = new Date()
            threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3)
            return expiryDate <= threeMonthsFromNow
          }).length,
          totalInventoryValue:
            assets.reduce((total: number, asset: any) => total + (asset.current_value || 0), 0) +
            consumables.reduce((total: number, c: any) => {
              const qty = c.total_quantity ?? c.quantity_current ?? 0
              const unitCost = c.avg_unit_cost ?? c.unit_cost ?? 0
              return total + qty * unitCost
            }, 0),
          maintenanceAlerts: assets.filter((a: any) => {
            if (a.status === "Maintenance Required") return true
            if (a.next_maintenance_date) {
              const nextMaintenance = new Date(a.next_maintenance_date)
              const today = new Date()
              const daysUntilMaintenance = Math.ceil(
                (nextMaintenance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              )
              return daysUntilMaintenance <= 30
            }
            return false
          }).length,
        }

        setSummaryData(summary)

        // Generate alerts based on data
        const generatedAlerts: InventoryAlert[] = []

        // Add expiry alerts
        consumables.forEach((consumable: any) => {
          if (!consumable.expiry_date) return
          const expiryDate = new Date(consumable.expiry_date)
          const today = new Date()
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
            generatedAlerts.push({
              id: `expiry-${consumable.id}`,
              type: "expiry",
              title: `${consumable.item_name || consumable.name} Expiring Soon`,
              description: `${consumable.batch_number ? `Batch ${consumable.batch_number}` : "Item"} expires in ${daysUntilExpiry} days`,
              severity: daysUntilExpiry <= 7 ? "high" : "medium",
              date: new Date().toISOString().split("T")[0],
            })
          } else if (daysUntilExpiry <= 0) {
            generatedAlerts.push({
              id: `expired-${consumable.id}`,
              type: "expiry",
              title: `${consumable.item_name || consumable.name} Expired`,
              description: `${consumable.batch_number ? `Batch ${consumable.batch_number}` : "Item"} expired ${Math.abs(daysUntilExpiry)} days ago`,
              severity: "high",
              date: new Date().toISOString().split("T")[0],
            })
          }
        })

        // Add low stock alerts (use backend stock_status and totals)
        consumables.forEach((consumable: any) => {
          const status = consumable.stock_status
          if (status === "low_stock" || status === "out_of_stock") {
            const currentQuantity = (consumable.total_quantity ?? consumable.quantity_current ?? 0) as number
            generatedAlerts.push({
              id: `stock-${consumable.id}`,
              type: "stock",
              title: "Low Stock Alert",
              description: `${consumable.item_name || consumable.name} below reorder level (${currentQuantity} remaining)`,
              severity: status === "out_of_stock" || currentQuantity === 0 ? "high" : "medium",
              date: new Date().toISOString().split("T")[0],
            })
          }
        })

        // Add maintenance alerts
        assets.forEach((asset: any) => {
          if (asset.status === "Maintenance Required") {
            generatedAlerts.push({
              id: `maintenance-${asset.id}`,
              type: "maintenance",
              title: "Equipment Maintenance Required",
              description: `${asset.asset_name || asset.name} requires maintenance`,
              severity: "medium",
              date: new Date().toISOString().split("T")[0],
            })
          } else if (asset.next_maintenance_date) {
            const nextMaintenance = new Date(asset.next_maintenance_date)
            const today = new Date()
            const daysUntilMaintenance = Math.ceil(
              (nextMaintenance.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
            )

            if (daysUntilMaintenance <= 7 && daysUntilMaintenance >= 0) {
              generatedAlerts.push({
                id: `maintenance-due-${asset.id}`,
                type: "maintenance",
                title: "Scheduled Maintenance Due Soon",
                description: `${asset.asset_name || asset.name} maintenance due in ${daysUntilMaintenance} days`,
                severity: daysUntilMaintenance <= 3 ? "high" : "medium",
                date: new Date().toISOString().split("T")[0],
              })
            } else if (daysUntilMaintenance < 0) {
              generatedAlerts.push({
                id: `maintenance-overdue-${asset.id}`,
                type: "maintenance",
                title: "Maintenance Overdue",
                description: `${asset.asset_name || asset.name} maintenance is ${Math.abs(daysUntilMaintenance)} days overdue`,
                severity: "high",
                date: new Date().toISOString().split("T")[0],
              })
            }
          }
        })

        // Sort alerts by severity and take top 10
        const sortedAlerts = generatedAlerts.sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 }
          return severityOrder[a.severity] - severityOrder[b.severity]
        })

        setAlerts(sortedAlerts.slice(0, 10))
      } else {
        toast({
          title: "Error",
          description: assetsResponse.error || consumablesResponse.error || "Failed to fetch inventory data",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "low":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "expiry":
        return <Clock className="w-4 h-4" />
      case "stock":
        return <Package className="w-4 h-4" />
      case "maintenance":
        return <Wrench className="w-4 h-4" />
      default:
        return <AlertTriangle className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading inventory data...</span>
      </div>
    )
  }

  if (!summaryData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load inventory data</p>
        <Button onClick={fetchInventoryData} className="mt-4">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Inventory Management</h2>
        <p className="text-muted-foreground">Manage medical assets, consumables, and supplies</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="consumables">Consumables</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryData.totalAssets}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  {summaryData.operationalAssets} operational
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Consumables</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summaryData.totalConsumables}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3 text-orange-600" />
                  {summaryData.lowStockItems} low stock
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R{Math.round(summaryData.totalInventoryValue).toLocaleString()}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3 text-green-600" />
                  Total portfolio value
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{alerts.length}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Require attention
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Asset Status Overview</CardTitle>
                <CardDescription>Current status of medical equipment and assets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Operational</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">{summaryData.operationalAssets}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm">Maintenance Required</span>
                  </div>
                  <Badge className="bg-yellow-100 text-yellow-800">{summaryData.assetsUnderMaintenance}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-sm">Out of Service</span>
                  </div>
                  <Badge className="bg-red-100 text-red-800">{summaryData.brokenAssets}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-gray-600" />
                    <span className="text-sm">Retired</span>
                  </div>
                  <Badge className="bg-gray-100 text-gray-800">{summaryData.retiredAssets}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Consumables Status</CardTitle>
                <CardDescription>Stock levels and expiry alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-sm">Total Items</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">{summaryData.totalConsumables}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Low Stock Items</span>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800">{summaryData.lowStockItems}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-red-600" />
                    <span className="text-sm">Expiring Soon</span>
                  </div>
                  <Badge className="bg-red-100 text-red-800">{summaryData.expiringItems}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">Maintenance Alerts</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">{summaryData.maintenanceAlerts}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>Important notifications requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No alerts at this time - all systems normal</p>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className={`p-2 rounded-full ${getSeverityColor(alert.severity)}`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{alert.title}</h4>
                          <Badge className={getSeverityColor(alert.severity)}>{alert.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{alert.date}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Action
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <AssetManagement userRole={userRole} />
        </TabsContent>

        <TabsContent value="consumables">
          <ConsumablesManagement userRole={userRole} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
