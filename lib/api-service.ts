export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

interface LoginCredentials {
  email: string
  password: string
}

interface Patient {
  id?: number
  medical_aid_number: string
  full_name: string
  physical_address: string
  telephone_number: string
  email?: string
  status: string
  created_at?: string
}

// Payload expected by backend /api/patients (POST)
export interface CreatePatientRequest {
  // Required
  first_name: string
  last_name: string
  date_of_birth: string // YYYY-MM-DD
  gender: string // 'Male' | 'Female' | 'Other'
  phone_number: string

  // Optional
  medical_aid_number?: string | null
  email?: string | null
  physical_address?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  is_palmed_member?: boolean
  member_type?: string
  chronic_conditions?: string[] | string
  allergies?: string[] | string
  current_medications?: string[] | string
  id_number?: string | null
}

interface Route {
  id?: number
  name: string
  description?: string
  location: string
  location_type: string
  province: string
  scheduled_date: string
  start_time?: string
  end_time?: string
  max_appointments: number
  status: string
}

interface Asset {
  id?: number
  name: string
  serial_number: string
  category: string
  status: string
  location: string
  purchase_date: string
  warranty_expiry?: string
}

interface Consumable {
  id?: number
  name: string
  category: string
  batch_number: string
  supplier: string
  expiry_date: string
  quantity_available: number
  unit_of_measure: string
}

// Supplier interface
export interface Supplier {
  id: number
  supplier_name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  is_active: boolean
}

// Stock receiving interface
export interface StockReceiptRequest {
  consumable_id: number
  batch_number: string
  supplier_id: number
  quantity_received: number
  unit_cost: number
  manufacture_date?: string
  expiry_date: string
  location?: string
}

// Enhanced Dashboard Response Types
interface DashboardStats {
  todayPatients: number
  weeklyPatients: number
  monthlyPatients: number
  pendingAppointments: number
  completedWorkflows: number
  activeRoutes: number
  lowStockAlerts: number
  maintenanceAlerts: number
  recentActivity: Array<{
    id: string
    type: "patient" | "appointment" | "inventory" | "route"
    description: string
    timestamp: string
    location?: string
    status: "completed" | "pending" | "alert"
  }>
  upcomingTasks: Array<{
    id: string
    title: string
    description: string
    dueDate: string
    priority: "high" | "medium" | "low"
    type: "maintenance" | "appointment" | "inventory" | "review"
  }>
  roleSpecificMetrics: {
    metricType: string
    todayBookings?: number
    weekBookings?: number
    monthBookings?: number
    todayAssessments?: number
    weekAssessments?: number
    monthAssessments?: number
    todayDiagnoses?: number
    todayTreatments?: number
    todayReferrals?: number
    weekReferrals?: number
  }
}

// Referrals
export interface Referral {
  id: number
  patient_id: number
  visit_id?: number | null
  referral_type: "internal" | "external"
  from_stage: "Registration" | "Nursing Assessment" | "Doctor Consultation" | "Counseling Session"
  to_stage?: "Registration" | "Nursing Assessment" | "Doctor Consultation" | "Counseling Session" | null
  external_provider?: string | null
  department?: string | null
  reason: string
  notes?: string | null
  status: "pending" | "sent" | "accepted" | "completed" | "cancelled"
  appointment_date?: string | null
  created_by: number
  created_at: string
  updated_at?: string | null
}

export interface CreateReferralRequest {
  referral_type: "internal" | "external"
  from_stage: Referral["from_stage"]
  to_stage?: Referral["to_stage"]
  external_provider?: string
  department?: string
  reason: string
  notes?: string
  visit_id?: number
  appointment_date?: string
}

export interface UpdateReferralRequest {
  status?: Referral["status"]
  appointment_date?: string
  notes?: string
}

class ApiService {
  // Prefer explicit public env var; otherwise use current origin (client) falling back to localhost
  private baseUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== "undefined" ? `${window.location.origin}/api` : "http://localhost:5000/api")
  private token: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("token")
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, options.headers as Record<string, string>)
      }
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle non-JSON responses
      let data
      try {
        data = await response.json()
      } catch (e) {
        data = { message: response.statusText }
      }

      if (!response.ok) {
        return {
          success: false,
          error: (data && (data.error || data.message)) || `HTTP ${response.status}: ${response.statusText}`,
        }
      }

      // Unwrap common envelope keys so callers get the array/object directly
      const body = data && data.data !== undefined ? data.data : data
      let unwrapped = body
      if (body && typeof body === "object" && !Array.isArray(body)) {
        const preferredKeys = [
          "patients",
          "routes",
          "assets",
          "consumables",
          "categories",
          "appointments",
          "users",
          "stats",
          "workflow",
          "notes",
          "referrals",
          "suppliers", // Added for supplier endpoints
        ]
        for (const key of preferredKeys) {
          if (Object.prototype.hasOwnProperty.call(body, key)) {
            unwrapped = body[key]
            break
          }
        }
      }

      return {
        success: true,
        data: unwrapped,
        message: data.message,
      }
    } catch (error) {
      console.error("API Request Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred",
      }
    }
  }

  // Authentication
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await this.request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    })

    if (response.success && response.data?.token) {
      this.token = response.data.token
      if (typeof window !== "undefined") {
        localStorage.setItem("token", response.data.token)
        localStorage.setItem("user", JSON.stringify(response.data.user))
      }
    }

    return response
  }

  async logout(): Promise<void> {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }
  }

  // Patient Management
  async getPatients(params?: Record<string, string>): Promise<ApiResponse<Patient[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Patient[]>(`/patients${queryString}`)
  }

  async getPatient(id: number): Promise<ApiResponse<Patient>> {
    return this.request<Patient>(`/patients/${id}`)
  }

  async createPatient(patient: CreatePatientRequest): Promise<ApiResponse<any>> {
    return this.request<any>("/patients", {
      method: "POST",
      body: JSON.stringify(patient),
    })
  }

  async updatePatient(id: number, patient: Partial<Patient>): Promise<ApiResponse<Patient>> {
    return this.request<Patient>(`/patients/${id}`, {
      method: "PUT",
      body: JSON.stringify(patient),
    })
  }

  async searchMember(medicalAidNumber: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/patients/search-member/${medicalAidNumber}`)
  }

  // Visits and Vital Signs
  async createVisit(
    patientId: number,
    payload: {
      visit_date?: string
      visit_time?: string
      route_id?: number
      location?: string
      chief_complaint?: string
    } = {},
  ): Promise<ApiResponse<{ visit_id: number }>> {
    return this.request<{ visit_id: number }>(`/patients/${patientId}/visits`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async addVitalSigns(
    visitId: number,
    payload: {
      systolic_bp?: number | string
      diastolic_bp?: number | string
      heart_rate?: number | string
      temperature?: number | string
      weight?: number | string
      height?: number | string
      oxygen_saturation?: number | string
      blood_glucose?: number | string
      respiratory_rate?: number | string
      nursing_notes?: string
    },
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/visits/${visitId}/vital-signs`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async getLatestVisit(patientId: number): Promise<ApiResponse<{ id: number } | null>> {
    return this.request<{ id: number } | null>(`/patients/${patientId}/visits/latest`)
  }

  async getVisitVitals(visitId: number): Promise<ApiResponse<{ count: number; latest: any }>> {
    return this.request<{ count: number; latest: any }>(`/visits/${visitId}/vital-signs`)
  }

  // Route Management
  async getRoutes(params?: Record<string, string>): Promise<ApiResponse<Route[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Route[]>(`/routes${queryString}`)
  }

  async createRoute(payload: {
    route_name: string
    description?: string
    start_date: string
    end_date: string
    province: string
    route_type?: "Police Stations" | "Schools" | "Community Centers" | "Mixed"
    location_type?: "police_station" | "school" | "community_center"
    max_appointments_per_day?: number
  }): Promise<ApiResponse<Route>> {
    return this.request<Route>("/routes", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async updateRoute(id: number, route: Partial<Route>): Promise<ApiResponse<Route>> {
    return this.request<Route>(`/routes/${id}`, {
      method: "PUT",
      body: JSON.stringify(route),
    })
  }

  async getAppointments(routeId?: number): Promise<ApiResponse<any[]>> {
    const endpoint = routeId ? `/appointments?route_id=${routeId}` : "/appointments"
    return this.request<any[]>(endpoint)
  }

  async bookAppointment(appointment: any): Promise<ApiResponse<any>> {
    return this.request<any>("/appointments", {
      method: "POST",
      body: JSON.stringify(appointment),
    })
  }

  // Inventory Management - Enhanced methods
  async getAssets(params?: Record<string, string>): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any[]>(`/inventory/assets${queryString}`)
  }

  async createAsset(asset: {
    asset_name: string
    asset_tag: string
    serial_number?: string
    manufacturer: string
    model?: string
    category_id: number
    purchase_date: string
    warranty_expiry?: string | null
    status: string
    location?: string
    purchase_cost: number
    current_value: number
    maintenance_notes?: string | null
  }): Promise<ApiResponse<any>> {
    return this.request<any>("/inventory/assets", {
      method: "POST",
      body: JSON.stringify(asset),
    })
  }

  async updateAsset(id: number, asset: Partial<any>): Promise<ApiResponse<any>> {
    return this.request<any>(`/inventory/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(asset),
    })
  }

  async getAssetCategories(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/inventory/asset-categories`)
  }

  // Asset categories for Asset Management form (dedicated endpoint)
  async getAssetCategoriesForAssets(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/inventory/assets/categories`)
  }

  async getConsumables(params?: Record<string, string>): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any[]>(`/inventory/consumables${queryString}`)
  }

  async getConsumableCategories(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/inventory/consumable-categories`)
  }

  async createConsumable(consumable: {
    item_name: string
    item_code: string
    generic_name?: string | null
    strength?: string | null
    dosage_form?: string | null
    unit_of_measure: string
    category_id: number
    reorder_level: number
    max_stock_level: number
    is_controlled_substance: boolean
    storage_temperature_min?: number | null
    storage_temperature_max?: number | null
  }): Promise<ApiResponse<any>> {
    return this.request<any>("/inventory/consumables", {
      method: "POST",
      body: JSON.stringify(consumable),
    })
  }

  async updateConsumable(id: number, consumable: Partial<any>): Promise<ApiResponse<any>> {
    return this.request<any>(`/inventory/consumables/${id}`, {
      method: "PUT",
      body: JSON.stringify(consumable),
    })
  }

  // Supplier Management
  async getSuppliers(params?: Record<string, string>): Promise<ApiResponse<Supplier[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Supplier[]>(`/inventory/suppliers${queryString}`)
  }

  async createSupplier(supplier: {
    supplier_name: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    tax_number?: string
    is_active?: boolean
  }): Promise<ApiResponse<Supplier>> {
    return this.request<Supplier>("/inventory/suppliers", {
      method: "POST",
      body: JSON.stringify(supplier),
    })
  }

  async updateSupplier(id: number, supplier: Partial<Supplier>): Promise<ApiResponse<Supplier>> {
    return this.request<Supplier>(`/inventory/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(supplier),
    })
  }

  // Stock Management - NEW METHODS
  async receiveInventoryStock(stockData: StockReceiptRequest): Promise<ApiResponse<any>> {
    return this.request<any>("/inventory/stock/receive", {
      method: "POST",
      body: JSON.stringify(stockData),
    })
  }

  async getConsumableBatches(consumableId: number): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/inventory/consumables/${consumableId}/batches`)
  }

  async adjustInventoryStock(
    stockId: number,
    payload: {
      adjustment_type: "increase" | "decrease" | "set"
      quantity: number
      reason: string
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/inventory/stock/${stockId}/adjust`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  // Inventory usage tracking
  async recordInventoryUsage(payload: {
    consumable_id: number
    quantity_used: number
    visit_id?: number
    location: string
    notes?: string
  }): Promise<ApiResponse<any>> {
    return this.request<any>("/inventory/usage", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async getUsageHistory(params?: Record<string, string>): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any[]>(`/inventory/usage/history${queryString}`)
  }

  // Inventory Alerts and Reports
  async getExpiryAlerts(daysAhead = 90, alertLevel?: string): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams({ days_ahead: daysAhead.toString() })
    if (alertLevel) {
      params.append('alert_level', alertLevel)
    }
    return this.request<any[]>(`/inventory/alerts/expiry?${params}`)
  }

  async getStockAlerts(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/inventory/alerts/stock")
  }

  async getInventoryValuation(params?: Record<string, string>): Promise<ApiResponse<any>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any>(`/inventory/reports/valuation${queryString}`)
  }

  async getInventoryTurnover(periodMonths = 12, categoryId?: number): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ period_months: periodMonths.toString() })
    if (categoryId) {
      params.append('category_id', categoryId.toString())
    }
    return this.request<any>(`/inventory/reports/turnover?${params}`)
  }

  // Dashboard and Analytics - Updated for role-specific stats
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>("/dashboard/stats")
  }

  // User Management
  async getUsers(params?: Record<string, string>): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any[]>(`/users${queryString}`)
  }

  async createUser(user: any): Promise<ApiResponse<any>> {
    return this.request<any>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    })
  }

  async updateUser(id: number, user: any): Promise<ApiResponse<any>> {
    return this.request<any>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(user),
    })
  }

  // Offline Sync
  async uploadOfflineData(data: any): Promise<ApiResponse<any>> {
    return this.request<any>("/sync/upload", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async downloadSyncData(lastSync?: string): Promise<ApiResponse<any>> {
    const endpoint = lastSync ? `/sync/download?last_sync=${lastSync}` : "/sync/download"
    return this.request<any>(endpoint)
  }

  // Referrals
  async listReferrals(patientId: number): Promise<ApiResponse<Referral[]>> {
    return this.request<Referral[]>(`/patients/${patientId}/referrals`, { method: "GET" })
  }

  async createReferral(patientId: number, payload: CreateReferralRequest): Promise<ApiResponse<Referral>> {
    return this.request<Referral>(`/patients/${patientId}/referrals`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async updateReferral(referralId: number, payload: UpdateReferralRequest): Promise<ApiResponse<Referral>> {
    return this.request<Referral>(`/referrals/${referralId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  }

  // Clinical notes and workflow
  async getWorkflowStatus(visitId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/visits/${visitId}/workflow/status`)
  }

  async getClinicalNotes(visitId: number): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/visits/${visitId}/clinical-notes`)
  }

  async createClinicalNote(
    visitId: number,
    payload: {
      note_type: "Assessment" | "Diagnosis" | "Treatment" | "Referral" | "Counseling" | "Closure"
      content: string
      icd10_codes?: string[]
      medications_prescribed?: string[]
      follow_up_required?: boolean
      follow_up_date?: string
    },
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/visits/${visitId}/clinical-notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }
}

export const apiService = new ApiService()
// Note: Supplier and StockReceiptRequest are already exported above via `export interface`,
// so we don't re-export them here to avoid TS2484 conflicts.
export type { Patient, Route, Asset, Consumable, DashboardStats }