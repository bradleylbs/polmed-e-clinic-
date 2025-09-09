interface LoginCredentials {
  email: string
  password: string
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
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

// Referrals
export interface Referral {
  id: number
  patient_id: number
  visit_id?: number | null
  referral_type: 'internal' | 'external'
  from_stage: 'Registration' | 'Nursing Assessment' | 'Doctor Consultation' | 'Counseling Session'
  to_stage?: 'Registration' | 'Nursing Assessment' | 'Doctor Consultation' | 'Counseling Session' | null
  external_provider?: string | null
  department?: string | null
  reason: string
  notes?: string | null
  status: 'pending' | 'sent' | 'accepted' | 'completed' | 'cancelled'
  appointment_date?: string | null
  created_by: number
  created_at: string
  updated_at?: string | null
}

export interface CreateReferralRequest {
  referral_type: 'internal' | 'external'
  from_stage: Referral['from_stage']
  to_stage?: Referral['to_stage']
  external_provider?: string
  department?: string
  reason: string
  notes?: string
  visit_id?: number
  appointment_date?: string
}

export interface UpdateReferralRequest {
  status?: Referral['status']
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
      const body = (data && data.data !== undefined) ? data.data : data
      let unwrapped = body
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const preferredKeys = ['patients', 'routes', 'assets', 'consumables', 'appointments', 'users', 'stats']
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
      console.error('API Request Error:', error)
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
    } = {}
  ): Promise<ApiResponse<{ visit_id: number }>> {
    return this.request<{ visit_id: number }>(`/patients/${patientId}/visits`, {
      method: 'POST',
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
    }
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/visits/${visitId}/vital-signs`, {
      method: 'POST',
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
    route_type?: 'Police Stations' | 'Schools' | 'Community Centers' | 'Mixed'
    location_type?: 'police_station' | 'school' | 'community_center'
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

  // Inventory Management
  async getAssets(params?: Record<string, string>): Promise<ApiResponse<Asset[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Asset[]>(`/inventory/assets${queryString}`)
  }

  async createAsset(asset: Omit<Asset, "id">): Promise<ApiResponse<Asset>> {
    return this.request<Asset>("/inventory/assets", {
      method: "POST",
      body: JSON.stringify(asset),
    })
  }

  async updateAsset(id: number, asset: Partial<Asset>): Promise<ApiResponse<Asset>> {
    return this.request<Asset>(`/inventory/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(asset),
    })
  }

  async getConsumables(params?: Record<string, string>): Promise<ApiResponse<Consumable[]>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : ""
    return this.request<Consumable[]>(`/inventory/consumables${queryString}`)
  }

  async createConsumable(consumable: Omit<Consumable, "id">): Promise<ApiResponse<Consumable>> {
    return this.request<Consumable>("/inventory/consumables", {
      method: "POST",
      body: JSON.stringify(consumable),
    })
  }

  async updateConsumable(id: number, consumable: Partial<Consumable>): Promise<ApiResponse<Consumable>> {
    return this.request<Consumable>(`/inventory/consumables/${id}`, {
      method: "PUT",
      body: JSON.stringify(consumable),
    })
  }

  // Dashboard and Analytics
  async getDashboardStats(): Promise<ApiResponse<any>> {
    return this.request<any>("/dashboard/stats")
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
    return this.request<Referral[]>(`/patients/${patientId}/referrals`, { method: 'GET' })
  }

  async createReferral(patientId: number, payload: CreateReferralRequest): Promise<ApiResponse<Referral>> {
    return this.request<Referral>(`/patients/${patientId}/referrals`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateReferral(referralId: number, payload: UpdateReferralRequest): Promise<ApiResponse<Referral>> {
    return this.request<Referral>(`/referrals/${referralId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  }
}

export const apiService = new ApiService()
export type { Patient, Route, Asset, Consumable, ApiResponse }