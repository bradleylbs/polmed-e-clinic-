"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Search, Plus, Package, Pill, Syringe, Badge as Bandage, TrendingDown, Clock, Loader2, Truck } from "lucide-react"
import { apiService, type Supplier, type StockReceiptRequest } from "@/lib/api-service"
import { useToast } from "@/hooks/use-toast"

// Updated interfaces to match database schema
interface Consumable {
  id: number
  item_code: string
  item_name: string
  category_id: number
  category_name?: string
  generic_name: string | null
  strength: string | null
  dosage_form: string | null
  unit_of_measure: string
  reorder_level: number
  max_stock_level: number
  storage_temperature_min: number | null
  storage_temperature_max: number | null
  is_controlled_substance: boolean
  created_at: string
  // From inventory_stock join - calculated by backend
  batch_number?: string
  supplier_name?: string
  expiry_date?: string
  quantity_current?: number
  unit_cost?: number
  received_date?: string
  status?: string
  // Calculated stock status fields from backend
  total_quantity?: number
  active_batches?: number
  earliest_expiry?: string
  avg_unit_cost?: number
  stock_status?: 'out_of_stock' | 'low_stock' | 'normal' | 'overstock'
  expiry_status?: 'expired' | 'expiring_soon' | 'warning' | 'good'
}

interface ConsumableCategory {
  id: number
  category_name: string
  description: string | null
  requires_prescription: boolean
  storage_requirements: string | null
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

export function ConsumablesManagement({ userRole }: ConsumablesManagementProps) {
  const [consumables, setConsumables] = useState<Consumable[]>([])
  const [categories, setCategories] = useState<ConsumableCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [alertFilter, setAlertFilter] = useState<string>("all")
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedConsumable, setSelectedConsumable] = useState<Consumable | null>(null)
  const [showUsageForm, setShowUsageForm] = useState(false)
  const [showReceiveStockForm, setShowReceiveStockForm] = useState(false)
  const [selectedConsumableForStock, setSelectedConsumableForStock] = useState<Consumable | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [usageSubmitting, setUsageSubmitting] = useState(false)
  const [receivingStock, setReceivingStock] = useState(false)
  const { toast } = useToast()

  const [newConsumable, setNewConsumable] = useState({
    item_name: "",
    item_code: "",
    generic_name: "",
    strength: "",
    dosage_form: "",
    unit_of_measure: "",
    category_id: "",
    reorder_level: 10,
    max_stock_level: 1000,
    is_controlled_substance: false,
    storage_temperature_min: null as number | null,
    storage_temperature_max: null as number | null,
  })

  const [newUsage, setNewUsage] = useState({
    quantity: 0,
    location: "",
    notes: "",
  })

  const [stockReceiptForm, setStockReceiptForm] = useState({
    batch_number: '',
    supplier_id: '',
    quantity_received: 0,
    unit_cost: 0,
    manufacture_date: '',
    expiry_date: '',
    location: 'Mobile Clinic'
  })

  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    supplier_name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    // Load consumables, categories, and suppliers on mount
    fetchConsumables()
    fetchCategories()
    fetchSuppliers()
  }, [])

  const fetchConsumables = async () => {
    try {
      setLoading(true)
      const response = await apiService.getConsumables()

      if (response.success && response.data) {
        setConsumables(response.data)
        // Fallback: derive categories from consumables if categories not loaded
        if (!categories.length) {
          const byId = new Map<
            number,
            {
              id: number
              category_name: string
              description: string | null
              requires_prescription: boolean
              storage_requirements: string | null
            }
          >()
          for (const c of response.data as Consumable[]) {
            if (typeof c.category_id === "number") {
              const name = c.category_name || `Category ${c.category_id}`
              if (!byId.has(c.category_id)) {
                byId.set(c.category_id, {
                  id: c.category_id,
                  category_name: name,
                  description: null,
                  requires_prescription: false,
                  storage_requirements: null,
                })
              }
            }
          }
          if (byId.size) {
            setCategories(Array.from(byId.values()))
          }
        }
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to fetch consumables",
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

  const fetchCategories = async () => {
    try {
      const response = await apiService.getConsumableCategories()
      if (response.success && response.data) {
        setCategories(response.data)
      } else if (!response.success) {
        toast({
          title: "Error",
          description: response.error || "Failed to fetch categories",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      })
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await apiService.getSuppliers({ is_active: 'true' })
      if (response.success && response.data) {
        setSuppliers(response.data)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load suppliers",
        variant: "destructive",
      })
    }
  }

  const createSupplier = async () => {
    if (!newSupplier.supplier_name.trim()) {
      toast({ title: 'Validation Error', description: 'Supplier name is required', variant: 'destructive' })
      return
    }
    const createdName = newSupplier.supplier_name.trim()
    try {
      const res = await apiService.createSupplier({
        supplier_name: createdName,
        contact_person: newSupplier.contact_person || undefined,
        phone: newSupplier.phone || undefined,
        email: newSupplier.email || undefined,
        address: newSupplier.address || undefined,
        is_active: true,
      })
      if (res.success) {
        toast({ title: 'Supplier created' })
        setShowAddSupplier(false)
        setNewSupplier({ supplier_name: '', contact_person: '', phone: '', email: '', address: '' })
        await fetchSuppliers()
        // Try preselect newly created supplier by name
        setStockReceiptForm((prev) => {
          const found = suppliers.find((s) => s.supplier_name === createdName)
          return { ...prev, supplier_id: found ? found.id.toString() : prev.supplier_id }
        })
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to create supplier', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to create supplier', variant: 'destructive' })
    }
  }

  const receiveStock = async () => {
    if (!selectedConsumableForStock || !stockReceiptForm.batch_number || !stockReceiptForm.supplier_id || 
        stockReceiptForm.quantity_received <= 0 || !stockReceiptForm.expiry_date || stockReceiptForm.unit_cost <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      })
      return
    }

    try {
      setReceivingStock(true)

      const stockPayload: StockReceiptRequest = {
        consumable_id: selectedConsumableForStock.id,
        batch_number: stockReceiptForm.batch_number,
        supplier_id: parseInt(stockReceiptForm.supplier_id),
        quantity_received: stockReceiptForm.quantity_received,
        unit_cost: stockReceiptForm.unit_cost,
        manufacture_date: stockReceiptForm.manufacture_date || undefined,
        expiry_date: stockReceiptForm.expiry_date,
        location: stockReceiptForm.location
      }

      const response = await apiService.receiveInventoryStock(stockPayload)

      if (response.success) {
        toast({
          title: "Success",
          description: "Stock received successfully",
        })

        // Reset form
        setStockReceiptForm({
          batch_number: '',
          supplier_id: '',
          quantity_received: 0,
          unit_cost: 0,
          manufacture_date: '',
          expiry_date: '',
          location: 'Mobile Clinic'
        })
        setShowReceiveStockForm(false)
        setSelectedConsumableForStock(null)

        // Refresh the consumables list to show updated stock levels
        fetchConsumables()
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to receive stock",
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
      setReceivingStock(false)
    }
  }

  const getExpiryStatus = (expiryDate: string) => {
    const today = new Date()
    const expiry = new Date(expiryDate)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

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
    const currentQuantity = consumable.total_quantity || consumable.quantity_current || 0
    const reorderLevel = consumable.reorder_level || 10
    const maxLevel = consumable.max_stock_level || 100
    const percentage = (currentQuantity / maxLevel) * 100

    if (currentQuantity === 0) {
      return { status: "out", color: "bg-red-100 text-red-800", label: "Out of Stock", percentage: 0 }
    } else if (currentQuantity <= reorderLevel) {
      return { status: "low", color: "bg-orange-100 text-orange-800", label: "Low Stock", percentage }
    } else if (percentage <= 50) {
      return { status: "medium", color: "bg-yellow-100 text-yellow-800", label: "Medium Stock", percentage }
    }
    return { status: "good", color: "bg-green-100 text-green-800", label: "Good Stock", percentage }
  }

  const filteredConsumables = consumables.filter((consumable) => {
    const matchesSearch =
      consumable.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      consumable.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (consumable.generic_name && consumable.generic_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (consumable.batch_number && consumable.batch_number.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = categoryFilter === "all" || consumable.category_id.toString() === categoryFilter

    let matchesAlert = true
    if (alertFilter === "expiring" && consumable.expiry_date) {
      const expiryStatus = getExpiryStatus(consumable.expiry_date)
      matchesAlert = expiryStatus.status === "expiring" || expiryStatus.status === "expired"
    } else if (alertFilter === "low_stock") {
      const stockStatus = getStockStatus(consumable)
      matchesAlert = stockStatus.status === "low" || stockStatus.status === "out"
    }

    return matchesSearch && matchesCategory && matchesAlert
  })

  const getCategoryConfig = (categoryId: number) => {
    // This is a simplified mapping - in a real app, you'd fetch categories from API
    const defaultCategory = consumableCategories[0]
    return defaultCategory
  }

  const addConsumable = async () => {
    if (
      !newConsumable.item_name ||
      !newConsumable.item_code ||
      !newConsumable.unit_of_measure ||
      !newConsumable.category_id
    ) {
      toast({
        title: "Validation Error",
        description: "Please fill in Item Name, Item Code, Unit of Measure, and select a Category.",
        variant: "destructive",
      })
      return
    }

    try {
      setSubmitting(true)

      const consumablePayload = {
        item_name: newConsumable.item_name,
        item_code: newConsumable.item_code,
        generic_name: newConsumable.generic_name || null,
        strength: newConsumable.strength || null,
        dosage_form: newConsumable.dosage_form || null,
        unit_of_measure: newConsumable.unit_of_measure,
        category_id: Number.parseInt(newConsumable.category_id),
        reorder_level: newConsumable.reorder_level,
        max_stock_level: newConsumable.max_stock_level,
        is_controlled_substance: newConsumable.is_controlled_substance,
        storage_temperature_min: newConsumable.storage_temperature_min,
        storage_temperature_max: newConsumable.storage_temperature_max,
      }

      const response = await apiService.createConsumable(consumablePayload)

      if (response.success) {
        toast({
          title: "Success",
          description: "Consumable added successfully",
        })

        // Reset form
        setNewConsumable({
          item_name: "",
          item_code: "",
          generic_name: "",
          strength: "",
          dosage_form: "",
          unit_of_measure: "",
          category_id: "",
          reorder_level: 10,
          max_stock_level: 1000,
          is_controlled_substance: false,
          storage_temperature_min: null,
          storage_temperature_max: null,
        })
        setShowAddForm(false)

        // Refresh the consumables list
        fetchConsumables()
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to add consumable",
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
      setSubmitting(false)
    }
  }

  const recordUsage = async () => {
    if (!selectedConsumable || newUsage.quantity <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid quantity",
        variant: "destructive",
      })
      return
    }

    try {
      setUsageSubmitting(true)
      const response = await apiService.recordInventoryUsage({
        consumable_id: selectedConsumable.id,
        quantity_used: newUsage.quantity,
        location: newUsage.location,
        notes: newUsage.notes,
      })

      if (response.success) {
        toast({
          title: "Success",
          description: "Usage recorded successfully",
        })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to record usage",
          variant: "destructive",
        })
        return
      }

      setNewUsage({
        quantity: 0,
        location: "",
        notes: "",
      })
      setShowUsageForm(false)
      setSelectedConsumable(null)

      // Refresh the consumables list
      fetchConsumables()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to record usage",
        variant: "destructive",
      })
    } finally {
      setUsageSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading consumables...</span>
      </div>
    )
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
                  placeholder="Search by name, code, generic name, or batch..."
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
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.category_name}
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
                <Label>Item Name *</Label>
                <Input
                  value={newConsumable.item_name}
                  onChange={(e) => setNewConsumable({ ...newConsumable, item_name: e.target.value })}
                  placeholder="Enter item name"
                />
              </div>

              <div className="space-y-2">
                <Label>Item Code *</Label>
                <Input
                  value={newConsumable.item_code}
                  onChange={(e) => setNewConsumable({ ...newConsumable, item_code: e.target.value })}
                  placeholder="Enter unique item code"
                />
              </div>

              <div className="space-y-2">
                <Label>Generic Name</Label>
                <Input
                  value={newConsumable.generic_name}
                  onChange={(e) => setNewConsumable({ ...newConsumable, generic_name: e.target.value })}
                  placeholder="Enter generic name"
                />
              </div>

              <div className="space-y-2">
                <Label>Strength</Label>
                <Input
                  value={newConsumable.strength}
                  onChange={(e) => setNewConsumable({ ...newConsumable, strength: e.target.value })}
                  placeholder="e.g., 500mg"
                />
              </div>

              <div className="space-y-2">
                <Label>Dosage Form</Label>
                <Input
                  value={newConsumable.dosage_form}
                  onChange={(e) => setNewConsumable({ ...newConsumable, dosage_form: e.target.value })}
                  placeholder="e.g., tablet, capsule, syrup"
                />
              </div>

              <div className="space-y-2">
                <Label>Unit of Measure</Label>
                <Input
                  value={newConsumable.unit_of_measure}
                  onChange={(e) => setNewConsumable({ ...newConsumable, unit_of_measure: e.target.value })}
                  placeholder="e.g., tablets, pieces, ml"
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={newConsumable.category_id}
                  onValueChange={(value) => setNewConsumable({ ...newConsumable, category_id: value })}
                >
                  <SelectTrigger disabled={categories.length === 0}>
                    <SelectValue
                      placeholder={categories.length === 0 ? "No categories available" : "Select a category"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Reorder Level</Label>
                <Input
                  type="number"
                  value={newConsumable.reorder_level}
                  onChange={(e) =>
                    setNewConsumable({ ...newConsumable, reorder_level: Number.parseInt(e.target.value) || 10 })
                  }
                  placeholder="Minimum stock level"
                />
              </div>

              <div className="space-y-2">
                <Label>Maximum Stock Level</Label>
                <Input
                  type="number"
                  value={newConsumable.max_stock_level}
                  onChange={(e) =>
                    setNewConsumable({ ...newConsumable, max_stock_level: Number.parseInt(e.target.value) || 1000 })
                  }
                  placeholder="Maximum stock level"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={addConsumable} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Consumable
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stock Receiving Form */}
      {showReceiveStockForm && selectedConsumableForStock && (
        <Card>
          <CardHeader>
            <CardTitle>Receive Stock - {selectedConsumableForStock.item_name}</CardTitle>
            <CardDescription>Add new inventory stock for this consumable item</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Batch Number *</Label>
                <Input
                  value={stockReceiptForm.batch_number}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, batch_number: e.target.value })}
                  placeholder="Enter batch/lot number"
                />
              </div>

              <div className="space-y-2">
                <Label>Supplier *</Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={stockReceiptForm.supplier_id}
                    onValueChange={(value) => setStockReceiptForm({ ...stockReceiptForm, supplier_id: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={suppliers.length ? 'Select supplier' : 'No suppliers available'} />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id.toString()}>
                          {supplier.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog open={showAddSupplier} onOpenChange={setShowAddSupplier}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline">New</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Supplier</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-3 py-2">
                        <div>
                          <Label>Name *</Label>
                          <Input value={newSupplier.supplier_name} onChange={(e) => setNewSupplier({ ...newSupplier, supplier_name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Contact</Label>
                            <Input value={newSupplier.contact_person} onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })} />
                          </div>
                          <div>
                            <Label>Phone</Label>
                            <Input value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Email</Label>
                            <Input value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} />
                          </div>
                          <div>
                            <Label>Address</Label>
                            <Input value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="button" onClick={createSupplier}>Save Supplier</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity Received *</Label>
                <Input
                  type="number"
                  min="1"
                  value={stockReceiptForm.quantity_received}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, quantity_received: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Unit: {selectedConsumableForStock.unit_of_measure}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Unit Cost (ZAR) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={stockReceiptForm.unit_cost}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, unit_cost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Manufacture Date</Label>
                <Input
                  type="date"
                  value={stockReceiptForm.manufacture_date}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, manufacture_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Expiry Date *</Label>
                <Input
                  type="date"
                  value={stockReceiptForm.expiry_date}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, expiry_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]} // Prevent past dates
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Storage Location</Label>
                <Input
                  value={stockReceiptForm.location}
                  onChange={(e) => setStockReceiptForm({ ...stockReceiptForm, location: e.target.value })}
                  placeholder="Storage location"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={receiveStock} disabled={receivingStock}>
                {receivingStock ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Receive Stock
              </Button>
              <Button variant="outline" onClick={() => setShowReceiveStockForm(false)}>
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
            <CardTitle>Record Usage - {selectedConsumable.item_name}</CardTitle>
            <CardDescription>Track consumption and usage details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity Used</Label>
                <Input
                  type="number"
                  value={newUsage.quantity}
                  onChange={(e) => setNewUsage({ ...newUsage, quantity: Number.parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  max={selectedConsumable.quantity_current || selectedConsumable.total_quantity || 0}
                />
                <p className="text-xs text-muted-foreground">
                  Available: {selectedConsumable.quantity_current || selectedConsumable.total_quantity || 0} {selectedConsumable.unit_of_measure}
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
              <Button onClick={recordUsage} disabled={usageSubmitting}>
                {usageSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Record Usage
              </Button>
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
            const categoryConfig = getCategoryConfig(consumable.category_id)
            const expiryStatus = consumable.expiry_date || consumable.earliest_expiry ? getExpiryStatus(consumable.expiry_date || consumable.earliest_expiry || '') : null
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
                          <h3 className="font-semibold text-foreground">{consumable.item_name}</h3>
                          {expiryStatus && (
                            <Badge className={expiryStatus.color}>
                              <Clock className="w-3 h-3 mr-1" />
                              {expiryStatus.label}
                            </Badge>
                          )}
                          <Badge className={stockStatus.color}>
                            <Package className="w-3 h-3 mr-1" />
                            {stockStatus.label}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <Badge variant="outline" className={categoryConfig.color}>
                            {categoryConfig.label}
                          </Badge>
                          <Badge variant="outline">Code: {consumable.item_code}</Badge>
                          {consumable.batch_number && <Badge variant="outline">Batch: {consumable.batch_number}</Badge>}
                        </div>

                        {(consumable.quantity_current !== undefined || consumable.total_quantity !== undefined) && (
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center justify-between text-sm">
                              <span>Stock Level</span>
                              <span>
                                {consumable.total_quantity || consumable.quantity_current || 0} / {consumable.max_stock_level}{" "}
                                {consumable.unit_of_measure}
                              </span>
                            </div>
                            <Progress value={stockStatus.percentage} className="h-2" />
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          {consumable.generic_name && (
                            <div>
                              <strong>Generic:</strong> {consumable.generic_name}
                            </div>
                          )}
                          {consumable.strength && (
                            <div>
                              <strong>Strength:</strong> {consumable.strength}
                            </div>
                          )}
                          {consumable.dosage_form && (
                            <div>
                              <strong>Form:</strong> {consumable.dosage_form}
                            </div>
                          )}
                          {(consumable.expiry_date || consumable.earliest_expiry) && (
                            <div>
                              <strong>Expires:</strong> {new Date(consumable.expiry_date || consumable.earliest_expiry || '').toLocaleDateString()}
                            </div>
                          )}
                          {(consumable.unit_cost !== undefined && consumable.unit_cost !== null) ||
                          (consumable.avg_unit_cost !== undefined && consumable.avg_unit_cost !== null) ? (
                            <div>
                              <strong>Cost/Unit:</strong> R{Number(
                                (consumable.unit_cost ?? consumable.avg_unit_cost ?? 0) as unknown as string | number
                              ).toFixed(2)}
                            </div>
                          ) : null}
                          <div>
                            <strong>Reorder Level:</strong> {consumable.reorder_level} {consumable.unit_of_measure}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedConsumableForStock(consumable);
                          setShowReceiveStockForm(true);
                        }}
                      >
                        <Truck className="w-4 h-4 mr-1" />
                        Receive Stock
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedConsumable(consumable)
                          setShowUsageForm(true)
                        }}
                        disabled={(consumable.quantity_current || consumable.total_quantity || 0) === 0}
                      >
                        <TrendingDown className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}