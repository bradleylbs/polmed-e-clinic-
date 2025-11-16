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
  first_name?: string
  last_name?: string
  full_name?: string
  date_of_birth?: string
  gender?: string
  id_number?: string
  phone_number?: string
  physical_address?: string
  telephone_number?: string
  email?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  is_palmed_member?: boolean
  member_type?: string
  chronic_conditions?: any
  allergies?: any
  current_medications?: any
  status?: string
  created_at?: string
  updated_at?: string
  total_visits?: number
  last_visit?: string
}

// Payload expected by backend /api/patients (POST)
export interface CreatePatientRequest {
  // Required
  first_name: string
  last_name: string
  date_of_birth: string // YYYY-MM-DD
  gender: string // 'Male' | 'Female' | 'Other'
  phone_number: string
  id_number: string

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
}

export type RouteLocationDTO = {
  id?: number | string
  route_location_id?: number
  name?: string
  type?: string
  city?: string
  address?: string
  contact_person?: string
  contact_phone?: string
  province?: string
  capacity?: number
  visit_date?: string
  start_time?: string
  end_time?: string
  max_appointments?: number
  appointment_duration?: number
  coordinates?: {
    lat: number
    lng: number
  }
}

// Updated Route interface to match backend
export interface Route {
  id?: number | string
  name?: string
  route_name?: string
  description?: string
  location?: string
  location_type?: string
  province?: string
  scheduled_date?: string
  start_date?: string
  end_date?: string
  start_time?: string
  end_time?: string
  max_appointments?: number
  max_appointments_per_day?: number
  status?: string
  locations?: RouteLocationDTO[]
  time_slots?: Array<{
    start_time: string
    end_time: string
    max_appointments: number
  }>
  created_by?: number
  is_active?: boolean
  route_type?: string
  total_appointments?: number
  booked_appointments?: number
  location_count?: number
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
    type: "patient" | "appointment" | "inventory" | "route" | "system" | "visit"
    description: string
    timestamp: string
    location?: string
    status: "completed" | "pending" | "alert"
    performedBy?: string
    action?: string
    table?: string
    recordId?: number | string | null
    ipAddress?: string | null
    changeSummary?: string
    locationData?: unknown
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

export interface PatientDocument {
  id: number
  patient_id: number
  visit_id?: number | null
  document_type: string
  file_name: string
  file_path?: string | null
  file_size?: number | null
  mime_type?: string | null
  is_confidential?: boolean
  uploaded_by?: number | null
  uploaded_by_name?: string | null
  uploaded_at?: string | null
  specialist_type?: string | null
  workflow_step?: string | null
  tags?: string[] | Record<string, unknown> | string | null
  notes?: string | null
  download_url?: string
}

export interface UploadPatientDocumentOptions {
  file: File
  visitId?: number | null
  documentType?: string
  specialistType?: string
  workflowStep?: string
  isConfidential?: boolean
  tags?: string[] | Record<string, unknown>
  notes?: string
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

// Vital Signs Interface
export interface VitalSignsRequest {
  systolic_bp?: number
  diastolic_bp?: number
  heart_rate?: number
  temperature?: number
  weight?: number
  height?: number
  oxygen_saturation?: number
  blood_glucose?: number
  respiratory_rate?: number
  nursing_notes?: string
  additional_measurements?: Record<string, any>
}

// Appointment interfaces
export interface Appointment {
  id?: number
  route_location_id: number
  patient_id?: number
  booked_by_name: string
  booked_by_phone: string
  booked_by_email?: string
  appointment_date: string
  appointment_time: string
  status: "available" | "booked" | "confirmed" | "completed" | "cancelled"
  special_requirements?: string
  created_at?: string
  updated_at?: string
  booking_reference?: string
  patient_name?: string
  patient_phone?: string
  patient_medical_aid?: string
  route_name?: string
  location_name?: string
  location_city?: string
  location_province?: string
}

export interface BookAppointmentRequest {
  patient_id?: number | null
  booked_by_name: string
  booked_by_phone: string
  booked_by_email?: string
  special_requirements?: string
}

// User interfaces
export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role_name: string
  is_active: boolean
  created_at?: string
  geographic_restrictions?: string
}

export interface CreateUserRequest {
  email: string
  password: string
  first_name: string
  last_name: string
  role_name: string
  geographic_restrictions?: string
  is_active?: boolean
}

export type UpdateUserRequest = Partial<User> & {
  approve?: boolean
  status?: string
  role?: string
  role_name?: string
  phone_number?: string
  assigned_province?: string
  mp_number?: string
  username?: string
  notes?: string
  geographic_restrictions?: string
  password?: string
  [key: string]: unknown
}

// Clinical Notes interfaces
export interface ClinicalNote {
  id: number
  visit_id: number
  note_type:
    | "Assessment"
    | "Diagnosis"
    | "Treatment"
    | "Referral"
    | "Counseling"
    | "Closure"
    | "Dentist"
    | "Optometrist"
    | "Audiologist"
    | "Gynaecologist"
    | "Ultrasound"
    | "Psychology"
  content: string
  icd10_codes?: string[]
  medications_prescribed?: string[]
  follow_up_required: boolean
  follow_up_date?: string
  created_by: number
  created_at: string
}

export interface CreateClinicalNoteRequest {
  note_type: ClinicalNote["note_type"]
  content: string
  icd10_codes?: string[]
  medications_prescribed?: string[]
  follow_up_required?: boolean
  follow_up_date?: string
}

export interface SpecialistCatalogEntry {
  specialist_type: string
  label: string
  role: string
  note_type: string
}

export interface VisitSpecialistConfiguration {
  visit_id: number
  specialist_stages: string[]
}

export interface SpecialistAssignment {
  visit_id: number
  patient_id: number
  specialist_type: string
  required: boolean
  status: "pending" | "completed"
  created_at?: string
  updated_at?: string
  completed_at?: string | null
  notes?: string | null
  visit_date?: string | null
  visit_time?: string | null
  location?: string | null
  route_id?: number | null
  current_stage_id?: number | null
  patient_name?: string | null
  phone_number?: string | null
  medical_aid_number?: string | null
  id_number?: string | null
}

export interface SpecialistAssignmentsSummary {
  total: number
  pending: number
  completed: number
}

export interface SpecialistAssignmentsResponse {
  assignments: SpecialistAssignment[]
  summary: SpecialistAssignmentsSummary
}

export interface CreateVisitRequest {
  visit_date?: string
  visit_time?: string
  route_id?: number
  location?: string
  chief_complaint?: string
  specialists?: Array<string> | Record<string, boolean> | string
  required_specialists?: Array<string> | Record<string, boolean> | string
  specialist_selection?: Array<string> | Record<string, boolean> | string
  [key: string]: unknown
}

export type SmartSuggestionType = "icd10" | "medication" | "investigation" | "all"

export interface SmartSuggestionRequest {
  input_text: string
  suggestion_type?: SmartSuggestionType
  patient_context?: Record<string, unknown>
}

export interface SmartSuggestionRecord {
  type: "icd10" | "medication" | "investigation"
  text: string
  code?: string
  confidence?: number
  [key: string]: unknown
}

export interface SmartSuggestionResponse {
  suggestions: SmartSuggestionRecord[]
  log_id?: number | null
}

const DEFAULT_REMOTE_API_BASE_URL =
  "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api"

class ApiService {
  private baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    DEFAULT_REMOTE_API_BASE_URL ||
    (typeof window !== "undefined" ? `${window.location.origin.replace(/\/$/, "")}/api` : "http://localhost:5000/api")
  constructor() {
    // No longer need to manage tokens - using httpOnly cookies
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
    const headers: Record<string, string> = isFormData
      ? {}
      : {
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

    // No longer setting Authorization header - using httpOnly cookies

    console.log(`🚀 API Request: ${options.method || "GET"} ${url}`, options.body)

    try {
      const isBrowser = typeof window !== "undefined"
      const isOffline = isBrowser ? !navigator.onLine : false
      const method = (options.method || "GET").toUpperCase()
      const isMutation = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE"

      if (isOffline && isMutation) {
        if (isFormData) {
          return {
            success: false,
            error: "File uploads are unavailable while offline.",
          }
        }
        try {
          const { offlineManager } = await import("./offline-manager")
          const body = options.body && typeof options.body === "string" ? JSON.parse(options.body) : options.body

          const opType: any = endpoint.startsWith("/patients")
            ? "patient"
            : endpoint.startsWith("/routes")
              ? "route"
              : endpoint.startsWith("/inventory")
                ? "inventory"
                : endpoint.startsWith("/appointments")
                  ? "appointment"
                  : "inventory"

          const opId = await offlineManager.queueOperation({
            type: opType,
            action: (method === "POST" ? "create" : method === "DELETE" ? "delete" : "update") as any,
            data: body ?? {},
            endpoint,
            method,
          })

          return {
            success: true,
            data: { id: opId, optimistic: true } as any,
            message: "Queued offline; will sync when online.",
          }
        } catch (e) {
          console.warn("Failed to queue offline operation", e)
        }
      }

      // Online request with retry logic
      const attemptFetch = async () =>
        fetch(url, {
          ...options,
          headers,
          credentials: 'include', // Include cookies in requests
        })

      let response = await attemptFetch()

      // Retry once for server errors
      if (!response.ok && response.status >= 500) {
        console.log("🔄 Retrying request due to server error...")
        await new Promise((r) => setTimeout(r, 500))
        response = await attemptFetch()
      }

      let data
      try {
        data = await response.json()
        console.log(`📨 API Response: ${response.status}`, data)
      } catch (e) {
        console.error("❌ Failed to parse JSON response:", e)
        data = { message: response.statusText }
      }

      if (!response.ok) {
        const errorMessage = (data && (data.error || data.message)) || `HTTP ${response.status}: ${response.statusText}`
        console.error(`❌ API Error: ${errorMessage}`)
        return {
          success: false,
          error: errorMessage,
        }
      }

      // Enhanced response unwrapping
      let unwrapped = data
      if (data && typeof data === "object") {
        // Prefer data field if it exists
        if (data.data !== undefined) {
          unwrapped = data.data
        }

        // For arrays, look for common collection keys
        if (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)) {
          const collectionKeys = [
            "routes",
            "patients",
            "assets",
            "consumables",
            "categories",
            "appointments",
            "users",
            "stats",
            "workflow",
            "notes",
            "referrals",
            "suppliers",
            "locations",
            "sync_status",
            "batches",
            "alerts",
            "usage_history",
          ]

          for (const key of collectionKeys) {
            if (Object.prototype.hasOwnProperty.call(unwrapped, key) && Array.isArray(unwrapped[key])) {
              unwrapped = unwrapped[key]
              break
            }
          }
        }
      }

      return {
        success: true,
        data: unwrapped,
        message: data.message,
      }
    } catch (error) {
      console.error("💥 API Request Error:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error occurred",
      }
    }
  }

  // ==================== AUTHENTICATION ====================
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ token: string; user: any }>> {
    const response = await this.request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    })

    if (response.success && response.data?.user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(response.data.user))
      }
    }

    return response
  }

  async logout(): Promise<void> {
    // Call backend logout endpoint to clear httpOnly cookie
    await this.request("/auth/logout", { method: "POST" })
    
    if (typeof window !== "undefined") {
      localStorage.removeItem("user")
    }
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>("/auth/me")
  }

  // ==================== PATIENT MANAGEMENT ====================
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

  async searchMember(medicalAidNumber: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/patients/search-member/${medicalAidNumber}`)
  }

  // ==================== VISITS AND VITAL SIGNS ====================
  async createVisit(patientId: number, payload: CreateVisitRequest = {}): Promise<ApiResponse<{ visit_id: number }>> {
    return this.request<{ visit_id: number }>(`/patients/${patientId}/visits`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async addVitalSigns(visitId: number, payload: VitalSignsRequest): Promise<ApiResponse<any>> {
    // Clean the payload - convert empty strings to undefined and ensure numbers
    const cleanPayload: Record<string, any> = {}

    for (const [key, value] of Object.entries(payload)) {
      if (value === "" || value === null) {
        cleanPayload[key] = undefined
      } else if (typeof value === "string" && !isNaN(Number(value)) && key !== "nursing_notes") {
        // Convert numeric strings to numbers, except for nursing_notes
        cleanPayload[key] = Number(value)
      } else {
        cleanPayload[key] = value
      }
    }

    return this.request<any>(`/visits/${visitId}/vital-signs`, {
      method: "POST",
      body: JSON.stringify(cleanPayload),
    })
  }

  async getLatestVisit(patientId: number): Promise<ApiResponse<{ id: number } | null>> {
    return this.request<{ id: number } | null>(`/patients/${patientId}/visits/latest`)
  }

  async getVisitVitals(visitId: number): Promise<ApiResponse<{ count: number; latest: any }>> {
    return this.request<{ count: number; latest: any }>(`/visits/${visitId}/vital-signs`)
  }

  // ==================== DOCUMENT MANAGEMENT ====================
  async uploadPatientDocument(
    patientId: number,
    options: UploadPatientDocumentOptions,
  ): Promise<ApiResponse<PatientDocument>> {
    const formData = new FormData()
    formData.append("file", options.file)

    if (options.visitId !== undefined && options.visitId !== null) {
      formData.append("visit_id", String(options.visitId))
    }

    if (options.documentType) {
      formData.append("document_type", options.documentType)
    }

    if (options.specialistType) {
      formData.append("specialist_type", options.specialistType)
    }

    if (options.workflowStep) {
      formData.append("workflow_step", options.workflowStep)
    }

    if (typeof options.isConfidential === "boolean") {
      formData.append("is_confidential", options.isConfidential ? "1" : "0")
    }

    if (options.tags) {
      try {
        formData.append("tags", JSON.stringify(options.tags))
      } catch (error) {
        console.warn("Failed to serialise document tags", error)
      }
    }

    if (options.notes) {
      formData.append("notes", options.notes)
    }

    return this.request<PatientDocument>(`/patients/${patientId}/documents`, {
      method: "POST",
      body: formData,
    })
  }

  // ==================== ROUTE MANAGEMENT ====================
  async getRoutes(params?: Record<string, string>): Promise<ApiResponse<Route[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Route[]>(`/routes${queryString}`)
  }

  async getRoute(id: number): Promise<ApiResponse<Route>> {
    return this.request<Route>(`/routes/${id}`)
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
    max_appointments?: number
    status?: string
    name?: string
    location?: string
    locations?: RouteLocationDTO[]
    time_slots?: Array<{ start_time: string; end_time: string; max_appointments: number }>
  }): Promise<ApiResponse<Route>> {
    // Ensure required fields are present
    const routePayload = {
      route_name: payload.route_name || payload.name,
      description: payload.description,
      start_date: payload.start_date,
      end_date: payload.end_date,
      province: payload.province,
      route_type:
        payload.route_type ||
        (payload.location_type === "police_station"
          ? "Police Stations"
          : payload.location_type === "school"
            ? "Schools"
            : payload.location_type === "community_center"
              ? "Community Centers"
              : "Mixed"),
      max_appointments_per_day: payload.max_appointments_per_day || payload.max_appointments || 100,
      ...(payload.status && { status: payload.status }),
      ...(payload.locations && payload.locations.length
        ? {
            locations: payload.locations.map((loc) => ({
              name: loc.name,
              type: loc.type,
              province: loc.province,
              city: loc.city,
              address: loc.address,
              capacity: loc.capacity,
              contact_person: loc.contact_person,
              contact_phone: loc.contact_phone,
              coordinates: loc.coordinates,
            })),
          }
        : {}),
      ...(payload.time_slots && payload.time_slots.length
        ? {
            time_slots: payload.time_slots.map((slot) => ({
              start_time: slot.start_time,
              end_time: slot.end_time,
              max_appointments: slot.max_appointments,
            })),
          }
        : {}),
    }

    console.log("📤 Creating route with payload:", routePayload)

    return this.request<Route>("/routes", {
      method: "POST",
      body: JSON.stringify(routePayload),
    })
  }

  async updateRoute(id: number, route: Partial<Route>): Promise<ApiResponse<Route>> {
    // Clean the payload for backend
    const updatePayload: any = {}

    if (route.name !== undefined) updatePayload.route_name = route.name
    if (route.description !== undefined) updatePayload.description = route.description
    if (route.start_date !== undefined) updatePayload.start_date = route.start_date
    if (route.end_date !== undefined) updatePayload.end_date = route.end_date
    if (route.province !== undefined) updatePayload.province = route.province
    if (route.max_appointments !== undefined) updatePayload.max_appointments_per_day = route.max_appointments
    if (route.route_type !== undefined) updatePayload.route_type = route.route_type

    console.log("📤 Updating route with payload:", updatePayload)

    return this.request<Route>(`/routes/${id}`, {
      method: "PUT",
      body: JSON.stringify(updatePayload),
    })
  }

  async deleteRoute(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/routes/${id}`, {
      method: "DELETE",
    })
  }

  // ==================== APPOINTMENTS ====================
  async getAppointments(routeId?: number): Promise<ApiResponse<Appointment[]>> {
    const endpoint = routeId ? `/appointments?route_id=${routeId}` : "/appointments"
    return this.request<Appointment[]>(endpoint)
  }

  async bookAppointment(appointment: any): Promise<ApiResponse<any>> {
    return this.request<any>("/appointments", {
      method: "POST",
      body: JSON.stringify(appointment),
    })
  }

  // Public appointments
  async getAvailableAppointments(params?: {
    province?: string
    date_from?: string
    date_to?: string
    location_type?: string
    location_name?: string
    city?: string
  }): Promise<ApiResponse<any[]>> {
    const usp = new URLSearchParams()
    if (params?.province) usp.set("province", params.province)
    if (params?.date_from) usp.set("date_from", params.date_from)
    if (params?.date_to) usp.set("date_to", params.date_to)
    if (params?.location_type) usp.set("location_type", params.location_type)
    if (params?.location_name) usp.set("location_name", params.location_name)
    if (params?.city) usp.set("city", params.city)
    const qs = usp.toString() ? `?${usp.toString()}` : ""
    return this.request<any[]>(`/appointments/available${qs}`)
  }

  async bookAppointmentPublic(
    appointmentId: number,
    payload: BookAppointmentRequest,
  ): Promise<ApiResponse<{ booking_reference: string }>> {
    return this.request<{ booking_reference: string }>(`/appointments/${appointmentId}/book`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async updateAppointment(id: number, payload: Partial<Appointment>): Promise<ApiResponse<Appointment>> {
    return this.request<Appointment>(`/appointments/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  }

  async cancelAppointment(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/appointments/${id}/cancel`, {
      method: "POST",
    })
  }

  // ==================== PATIENT CHECK-IN ====================
  async getTodaysCheckInAppointments(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>("/appointments/check-in/today")
  }

  async checkInPatient(appointmentId: number): Promise<ApiResponse<{
    visit_id: number
    appointment_id: number
    patient_id: number
    check_in_time: string
    stage_id: number
  }>> {
    return this.request(`/appointments/${appointmentId}/check-in`, {
      method: "POST",
    })
  }

  async createPatientVisit(patientId: number, data?: {
    route_id?: number
    location?: string
  }): Promise<ApiResponse<{
    visit_id: number
    patient_id: number
    stage_id: number
  }>> {
    return this.request(`/patients/${patientId}/visit`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    })
  }

  // ==================== INVENTORY MANAGEMENT ====================
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

  // ==================== SUPPLIER MANAGEMENT ====================
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

  // ==================== STOCK MANAGEMENT ====================
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
    },
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

  // ==================== INVENTORY ALERTS AND REPORTS ====================
  async getExpiryAlerts(daysAhead = 90, alertLevel?: string): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams({ days_ahead: daysAhead.toString() })
    if (alertLevel) {
      params.append("alert_level", alertLevel)
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
      params.append("category_id", categoryId.toString())
    }
    return this.request<any>(`/inventory/reports/turnover?${params}`)
  }

  // ==================== DASHBOARD AND ANALYTICS ====================
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.request<DashboardStats>("/dashboard/stats")
  }

  // ==================== USER MANAGEMENT ====================
  async getUsers(params?: Record<string, string>): Promise<ApiResponse<User[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<User[]>(`/users${queryString}`)
  }

  async createUser(user: CreateUserRequest): Promise<ApiResponse<User>> {
    return this.request<User>("/users", {
      method: "POST",
      body: JSON.stringify(user),
    })
  }

  async updateUser(id: number, user: UpdateUserRequest): Promise<ApiResponse<User>> {
    return this.request<User>(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(user),
    })
  }

  async deleteUser(id: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/users/${id}`, {
      method: "DELETE",
    })
  }

  // ==================== OFFLINE SYNC ====================
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

  async getSyncStatus(): Promise<ApiResponse<{ last_sync: string; pending_operations: number }>> {
    return this.request<{ last_sync: string; pending_operations: number }>("/sync/status")
  }

  // ==================== REFERRALS ====================
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

  async getReferral(referralId: number): Promise<ApiResponse<Referral>> {
    return this.request<Referral>(`/referrals/${referralId}`)
  }

  // ==================== CLINICAL NOTES AND WORKFLOW ====================
  async getSpecialistCatalog(): Promise<ApiResponse<SpecialistCatalogEntry[]>> {
    return this.request<SpecialistCatalogEntry[]>("/workflow/specialists/catalog")
  }

  async getWorkflowStatus(visitId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/visits/${visitId}/workflow/status`)
  }

  async updateVisitSpecialists(
    visitId: number,
    specialists: string[],
  ): Promise<ApiResponse<VisitSpecialistConfiguration>> {
    return this.request<VisitSpecialistConfiguration>(`/visits/${visitId}/workflow/specialists`, {
      method: "PUT",
      body: JSON.stringify({ specialists }),
    })
  }

  async getMySpecialistAssignments(params?: {
    status?: "pending" | "completed" | "all"
    limit?: number
    patientId?: number | string
  }): Promise<ApiResponse<SpecialistAssignmentsResponse>> {
    const query = new URLSearchParams()
    if (params?.status) {
      query.set("status", params.status)
    }
    if (typeof params?.limit === "number" && !Number.isNaN(params.limit)) {
      query.set("limit", String(params.limit))
    }
    if (params?.patientId !== undefined && params.patientId !== null) {
      query.set("patient_id", String(params.patientId))
    }

    const suffix = query.toString()
    const path = suffix ? `/specialists/assignments?${suffix}` : "/specialists/assignments"
    return this.request<SpecialistAssignmentsResponse>(path)
  }

  async getClinicalNotes(visitId: number): Promise<ApiResponse<ClinicalNote[]>> {
    return this.request<ClinicalNote[]>(`/visits/${visitId}/clinical-notes`)
  }

  async createClinicalNote(visitId: number, payload: CreateClinicalNoteRequest): Promise<ApiResponse<ClinicalNote>> {
    return this.request<ClinicalNote>(`/visits/${visitId}/clinical-notes`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async updateClinicalNote(
    noteId: number,
    payload: Partial<CreateClinicalNoteRequest>,
  ): Promise<ApiResponse<ClinicalNote>> {
    return this.request<ClinicalNote>(`/clinical-notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  }

  // ==================== LOCATIONS MANAGEMENT ====================
  async getLocations(params?: Record<string, string>): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<any[]>(`/locations${queryString}`)
  }

  async createLocation(location: {
    location_name: string
    location_type: string
    address: string
    city: string
    province: string
    contact_person?: string
    contact_phone?: string
    capacity?: number
    is_active?: boolean
  }): Promise<ApiResponse<any>> {
    return this.request<any>("/locations", {
      method: "POST",
      body: JSON.stringify(location),
    })
  }

  async updateLocation(id: number, location: Partial<any>): Promise<ApiResponse<any>> {
    return this.request<any>(`/locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(location),
    })
  }

  // ==================== ROUTE LOCATIONS ====================
  async getRouteLocations(routeId: number): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/routes/${routeId}/locations`)
  }

  async addRouteLocation(
    routeId: number,
    payload: {
      location_id: number
      visit_date: string
      start_time: string
      end_time: string
      max_appointments?: number
    },
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/routes/${routeId}/locations`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async updateRouteLocation(
    routeLocationId: number,
    payload: Partial<{
      visit_date: string
      start_time: string
      end_time: string
      max_appointments: number
    }>,
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/route-locations/${routeLocationId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  }

  async deleteRouteLocation(routeLocationId: number): Promise<ApiResponse<void>> {
    return this.request<void>(`/route-locations/${routeLocationId}`, {
      method: "DELETE",
    })
  }

  // ==================== SMART SUGGESTIONS ====================
  async getSmartSuggestions(
    payload: SmartSuggestionRequest,
    options: { signal?: AbortSignal } = {},
  ): Promise<ApiResponse<SmartSuggestionResponse>> {
    return this.request<SmartSuggestionResponse>("/smart-suggestions", {
      method: "POST",
      body: JSON.stringify({
        suggestion_type: "all",
        ...payload,
      }),
      signal: options.signal,
    })
  }

  async sendSmartSuggestionFeedback(
    suggestionId: number,
    feedback: {
      was_accepted?: boolean
      feedback_score?: number
      feedback_notes?: string
    },
  ): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/smart-suggestions/${suggestionId}/feedback`, {
      method: "POST",
      body: JSON.stringify(feedback),
    })
  }

  // ==================== HEALTH CHECKS ====================
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>("/health")
  }

  // ==================== UTILITY METHODS ====================
  // Deprecated: tokens are now managed via httpOnly cookies
  setToken(token: string): void {
    console.warn('setToken is deprecated - tokens are now managed via httpOnly cookies')
  }

  getToken(): string | null {
    console.warn('getToken is deprecated - tokens are now managed via httpOnly cookies')
    return null
  }

  clearToken(): void {
    console.warn('clearToken is deprecated - use logout endpoint instead')
    if (typeof window !== "undefined") {
      localStorage.removeItem("token")
      localStorage.removeItem("user")
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.getStoredUser() !== null
  }

  // Get stored user data
  getStoredUser(): User | null {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem("user")
      return userStr ? JSON.parse(userStr) : null
    }
    return null
  }

  // ==================== ICD-10 SEARCH ====================
  async searchICD10(query: string, limit = 20): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams({ q: query, limit: limit.toString() })
    return this.request<any[]>(`/icd10/search?${params}`)
  }
}

export const apiService = new ApiService()
export type { Patient, Asset, Consumable, DashboardStats }
