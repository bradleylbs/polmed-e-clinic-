import { apiService, type ApiResponse } from "./api-service"

const DEFAULT_REMOTE_API_BASE_URL =
  "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api"

export interface PatientPortalUser {
  id: number
  patient_id: number
  email: string
  is_verified: boolean
  last_login?: string
  created_at: string
}

export interface PatientDashboardData {
  patient_info: {
    id: number
    full_name: string
    medical_aid_number: string
    is_palmed_member: boolean
    member_type: string
    phone_number?: string
    email?: string
  }
  upcoming_appointments: Array<{
    id: number
    booking_reference: string
    appointment_date: string
    appointment_time: string
    location_name: string
    city: string
    province: string
    status: string
  }>
  recent_visits: Array<{
    visit_id: number
    visit_date: string
    location_name: string
    chief_complaint?: string
    is_completed: boolean
    completed_stages: number
    total_stages: number
  }>
  health_summary: {
    total_visits: number
    chronic_conditions?: string[]
    allergies?: string[]
    current_medications?: string[]
    last_visit_date?: string
    recent_diagnoses?: Array<{
      icd10_code: string
      description: string
      date: string
    }>
  }
  notifications: Array<{
    id: number
    type: string
    subject?: string
    sent_at?: string
    status: string
  }>
}

export interface PatientAppointmentPreferences {
  id?: number
  patient_id: number
  preferred_provinces: string[]
  preferred_cities: string[]
  preferred_times: string[]
  max_travel_distance_km: number
  notification_preferences: {
    email: boolean
    sms: boolean
    reminders: boolean
  }
  accessibility_requirements?: string
}

export interface PatientFeedback {
  id?: number
  patient_id: number
  visit_id?: number
  feedback_type: "service_rating" | "complaint" | "suggestion" | "compliment"
  overall_rating?: number
  service_ratings?: Record<string, number>
  comments?: string
  is_anonymous: boolean
}

class PatientPortalService {
  // Get patient portal token from localStorage
  private getPatientToken(): string | null {
    if (typeof window === "undefined") return null
    
    try {
      const sessionData = localStorage.getItem("patient_portal_session")
      if (sessionData) {
        const parsed = JSON.parse(sessionData)
        return parsed.token || null
      }
    } catch (error) {
      console.warn("Failed to parse patient portal session:", error)
    }
    
    return null
  }

  // Make authenticated request with patient portal token
  private async makeAuthenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getPatientToken()
    
    if (!token) {
      throw new Error("No patient authentication token found")
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...((options.headers as Record<string, string>) || {}),
    }

    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // Medical Aid Validation for Registration (new endpoint)
  async validateMedicalAid(medicalAidNumber: string): Promise<
    ApiResponse<{
      is_valid: boolean
      member_type?: string
      validation_message: string
      details?: {
        first_name?: string
        last_name?: string
        date_of_birth?: string
        gender?: string
        email?: string
        phone_number?: string
      }
    }>
  > {
    return apiService["request"]("/patient/validate-medical-aid", {
      method: "POST",
      body: JSON.stringify({ medical_aid_number: medicalAidNumber }),
    })
  }
  private baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    DEFAULT_REMOTE_API_BASE_URL ||
    (typeof window !== "undefined" ? `${window.location.origin.replace(/\/$/, "")}/api` : "http://localhost:5000/api")

  // Patient Portal Authentication
  async registerPatient(data: {
    email: string
    password: string
    polmed_number?: string // Optional for non-POLMED users
    first_name: string
    last_name: string
    mobile_number: string
    date_of_birth: string
    gender: string
    is_private_patient?: boolean // Flag for non-POLMED users
    terms_accepted: boolean
    privacy_accepted: boolean
    marketing_consent?: boolean
    terms_version?: string
    privacy_version?: string
  }): Promise<ApiResponse<{ patient_id: number; requires_verification: boolean }>> {
    return apiService["request"]("/patient/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async loginPatient(
    email: string,
    password: string,
  ): Promise<
    ApiResponse<{
      token: string
      patient_data: PatientDashboardData["patient_info"]
    }>
  > {
    return apiService["request"]("/patient-portal/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  }

  async verifyPatientEmail(token: string): Promise<ApiResponse<{ verified: boolean }>> {
    return apiService["request"]("/patient-portal/verify-email", {
      method: "POST",
      body: JSON.stringify({ verification_token: token }),
    })
  }

  async resetPatientPassword(email: string): Promise<ApiResponse<{ reset_sent: boolean }>> {
    return apiService["request"]("/patient-portal/reset-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  }

  // Patient Dashboard
  async getPatientDashboard(patientId: number): Promise<ApiResponse<PatientDashboardData>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/dashboard/${patientId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard data",
      }
    }
  }

  // Patient Appointments
  async getAvailableAppointmentsForPatient(
    patientId: number,
    filters?: {
      province?: string
      city?: string
      date_from?: string
      date_to?: string
      max_distance_km?: number
    },
  ): Promise<ApiResponse<any[]>> {
    try {
      const params = new URLSearchParams()
      if (filters?.province) params.set("province", filters.province)
      if (filters?.city) params.set("city", filters.city)
      if (filters?.date_from) params.set("date_from", filters.date_from)
      if (filters?.date_to) params.set("date_to", filters.date_to)
      if (filters?.max_distance_km) params.set("max_distance_km", filters.max_distance_km.toString())

      const queryString = params.toString() ? `?${params.toString()}` : ""
      return await this.makeAuthenticatedRequest(`/patient-portal/appointments/available/${patientId}${queryString}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch appointments",
      }
    }
  }

  async bookAppointmentViaPortal(
    patientId: number,
    appointmentId: number,
    notes?: string,
  ): Promise<ApiResponse<{ booking_reference: string; confirmation_sent: boolean }>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/appointments/${appointmentId}/book`, {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          patient_notes: notes,
        }),
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to book appointment",
      }
    }
  }

  async cancelAppointmentViaPortal(
    appointmentId: number,
    reason: string,
  ): Promise<ApiResponse<{ cancelled: boolean }>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/appointments/${appointmentId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ cancellation_reason: reason }),
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cancel appointment",
      }
    }
  }

  // Patient Preferences
  async getPatientPreferences(patientId: number): Promise<ApiResponse<PatientAppointmentPreferences>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/preferences/${patientId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch preferences",
      }
    }
  }

  async updatePatientPreferences(
    patientId: number,
    preferences: Partial<PatientAppointmentPreferences>,
  ): Promise<ApiResponse<PatientAppointmentPreferences>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/preferences/${patientId}`, {
        method: "PUT",
        body: JSON.stringify(preferences),
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update preferences",
      }
    }
  }

  // Patient Health Records
  async getPatientVisitHistory(patientId: number): Promise<ApiResponse<PatientDashboardData["recent_visits"]>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/visits/${patientId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch visit history",
      }
    }
  }

  async getVisitDetails(visitId: number): Promise<
    ApiResponse<{
      visit_info: any
      vital_signs: any[]
      diagnoses: any[]
      clinical_notes: any[]
      prescriptions: any[]
    }>
  > {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/visits/details/${visitId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch visit details",
      }
    }
  }

  // Patient Feedback
  async submitPatientFeedback(
    patientId: number,
    feedback: Omit<PatientFeedback, "id" | "patient_id">,
  ): Promise<ApiResponse<PatientFeedback>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/feedback/${patientId}`, {
        method: "POST",
        body: JSON.stringify(feedback),
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to submit feedback",
      }
    }
  }

  async getPatientFeedbackHistory(patientId: number): Promise<ApiResponse<PatientFeedback[]>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/feedback/${patientId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch feedback history",
      }
    }
  }

  // Patient Communications
  async getPatientNotifications(patientId: number): Promise<ApiResponse<PatientDashboardData["notifications"]>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/notifications/${patientId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch notifications",
      }
    }
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<{ marked: boolean }>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/notifications/${notificationId}/read`, {
        method: "POST",
      })
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to mark notification as read",
      }
    }
  }

  // Patient Documents
  async getPatientDocuments(patientId: number): Promise<
    ApiResponse<
      Array<{
        id: number
        document_type: string
        document_name: string
        created_at: string
        file_size?: number
      }>
    >
  > {
    try {
      const response = await this.makeAuthenticatedRequest(`/patient-portal/documents/${patientId}`) as any
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data.map((doc: any) => ({
            id: doc.id,
            visit_id: doc.visit_id,
            document_name: doc.file_name || doc.document_name,
            file_name: doc.file_name,
            document_type: doc.document_type,
            mime_type: doc.mime_type,
            size: doc.size,
            upload_date: doc.created_at || doc.upload_date,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            download_url: doc.download_url,
            storage_path: doc.storage_path,
            uploader: doc.uploader
          }))
        }
      }
      return response || { success: false, error: "No data returned" }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch documents",
      }
    }
  }

  async downloadPatientDocument(documentId: number): Promise<ApiResponse<{ download_url: string }>> {
    try {
      return await this.makeAuthenticatedRequest(`/patient-portal/documents/download/${documentId}`)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to download document",
      }
    }
  }

  // POLMED Membership Validation
  async validatePolmedMembership(
    medicalAidNumber: string,
    patientId?: number,
  ): Promise<
    ApiResponse<{
      is_valid: boolean
      member_type?: string
      status: string
      benefits_available?: any[]
      validation_message: string
    }>
  > {
    const body = patientId
      ? { medical_aid_number: medicalAidNumber, patient_id: patientId }
      : { medical_aid_number: medicalAidNumber }

    return apiService["request"]("/patient-portal/validate-membership", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  // Patient Profile Management
  async updatePatientProfile(
    patientId: number,
    updates: {
      phone_number?: string
      email?: string
      physical_address?: string
      emergency_contact_name?: string
      emergency_contact_phone?: string
    },
  ): Promise<ApiResponse<{ updated: boolean }>> {
    return apiService["request"](`/patient-portal/profile/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
  }

  async requestDataDeletion(patientId: number, reason: string): Promise<ApiResponse<{ request_submitted: boolean }>> {
    return apiService["request"](`/patient-portal/data-deletion/${patientId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    })
  }

  async changePassword(
    patientId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<ApiResponse<{ changed: boolean }>> {
    return apiService["request"](`/patient-portal/password/change`, {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        current_password: currentPassword,
        new_password: newPassword,
      }),
    })
  }

  async forgotPassword(email: string): Promise<ApiResponse<{ reset_sent: boolean }>> {
    return apiService["request"](`/patient-portal/password/forgot`, {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  }

  async resetPasswordWithToken(token: string, newPassword: string): Promise<ApiResponse<{ reset: boolean }>> {
    return apiService["request"](`/patient-portal/password/reset`, {
      method: "POST",
      body: JSON.stringify({
        reset_token: token,
        new_password: newPassword,
      }),
    })
  }

  async getMedicalRecords(patientId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService["request"](`/patient-portal/medical-records/${patientId}`) as any
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data.map((record: any) => ({
            id: record.id,
            visit_id: record.visit_id,
            record_type: record.record_type,
            description: record.description,
            icd10_code: record.icd10_code,
            provider: record.provider,
            status: record.status || 'active',
            clinical_notes: record.clinical_notes,
            severity: record.severity,
            onset_date: record.onset_date,
            resolution_date: record.resolution_date,
            created_at: record.created_at,
            updated_at: record.updated_at
          }))
        }
      }
      return response || { success: false, error: "No data returned" }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch medical records"
      }
    }
  }

  async getPrescriptions(patientId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService["request"](`/patient-portal/prescriptions/${patientId}`) as any
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data.map((rx: any) => ({
            id: rx.id,
            name: rx.medication_name || rx.name,
            medication_name: rx.medication_name,
            generic_name: rx.generic_name,
            dosage: rx.dosage,
            frequency: rx.frequency,
            duration: rx.duration,
            prescribed_by: rx.prescriber || rx.prescribed_by,
            prescriber: rx.prescriber,
            start_date: rx.start_date,
            end_date: rx.end_date,
            instructions: rx.instructions,
            side_effects: [],
            is_active: rx.is_active,
            adherence_rate: 0,
            strength: rx.strength,
            dosage_form: rx.dosage_form,
            therapeutic_class: rx.therapeutic_class,
            created_at: rx.created_at,
            updated_at: rx.updated_at
          }))
        }
      }
      return response || { success: false, error: "No data returned" }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch prescriptions"
      }
    }
  }

  async getTestResults(patientId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService["request"](`/patient-portal/test-results/${patientId}`) as any
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data.map((result: any) => ({
            id: result.id,
            visit_id: result.visit_id,
            test_code: result.test_code,
            test_name: result.test_name,
            result_value: result.result_value,
            unit: result.unit,
            reference_range: result.reference_range,
            abnormal_flag: result.abnormal_flag,
            test_date: result.test_date,
            lab_name: result.lab_name,
            notes: result.lab_name ? `Tested at ${result.lab_name}` : '',
            ordered_by: result.ordered_by,
            created_at: result.created_at,
            updated_at: result.updated_at
          }))
        }
      }
      return response || { success: false, error: "No data returned" }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch test results"
      }
    }
  }

  async getInvoices(patientId: number): Promise<ApiResponse<any[]>> {
    return apiService["request"](`/patient-portal/invoices/${patientId}`)
  }

  async getPaymentHistory(patientId: number): Promise<ApiResponse<any[]>> {
    return apiService["request"](`/patient-portal/payments/${patientId}`)
  }

  async sendMessage(
    patientId: number,
    payload: {
      subject: string
      message: string
      recipient_type: "admin" | "doctor" | "support"
    },
  ): Promise<ApiResponse<{ message_id: number }>> {
    return apiService["request"](`/patient-portal/messages/${patientId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  async getMessages(patientId: number): Promise<ApiResponse<any[]>> {
    return apiService["request"](`/patient-portal/messages/${patientId}`)
  }

  async getAvailableSlots(params: {
    province?: string
    city?: string
    date?: string
    location_type?: string
  }): Promise<ApiResponse<any[]>> {
    const queryString = new URLSearchParams(params as Record<string, string>).toString()
    return apiService["request"](`/patient-portal/slots/available?${queryString}`)
  }

  async getAvailableLocations(params?: {
    province?: string
    location_type?: string
  }): Promise<ApiResponse<any[]>> {
    const queryString = params ? `?${new URLSearchParams(params as Record<string, string>)}` : ""
    return apiService["request"](`/patient-portal/locations${queryString}`)
  }

  async getPatientDiagnoses(patientId: number): Promise<ApiResponse<any[]>> {
    try {
      const response = await apiService["request"](`/patient-portal/diagnoses/${patientId}`) as any
      
      if (response?.success && response?.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data.map((dx: any) => ({
            id: dx.id,
            patient_id: dx.patient_id,
            visit_id: dx.visit_id,
            diagnosis_text: dx.diagnosis_text,
            icd10_code: dx.icd10_code,
            severity: dx.severity,
            status: dx.status || 'active',
            onset_date: dx.onset_date,
            resolution_date: dx.resolution_date,
            clinical_notes: dx.clinical_notes,
            confirmed_by: dx.confirmed_by,
            created_at: dx.created_at,
            updated_at: dx.updated_at
          }))
        }
      }
      return response || { success: false, error: "No data returned" }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch diagnoses"
      }
    }
  }
}

export const patientPortalService = new PatientPortalService()
