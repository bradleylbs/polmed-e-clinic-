import { apiService, type ApiResponse } from "./api-service"

const DEFAULT_REMOTE_API_BASE_URL = "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net/api"

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
    medical_aid_number: string
    first_name: string
    last_name: string
    phone_number: string
    date_of_birth: string
    gender: string
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
    return apiService["request"](`/patient-portal/dashboard/${patientId}`)
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
    const params = new URLSearchParams()
    if (filters?.province) params.set("province", filters.province)
    if (filters?.city) params.set("city", filters.city)
    if (filters?.date_from) params.set("date_from", filters.date_from)
    if (filters?.date_to) params.set("date_to", filters.date_to)
    if (filters?.max_distance_km) params.set("max_distance_km", filters.max_distance_km.toString())

    const queryString = params.toString() ? `?${params.toString()}` : ""
    return apiService["request"](`/patient-portal/appointments/available/${patientId}${queryString}`)
  }

  async bookAppointmentViaPortal(
    patientId: number,
    appointmentId: number,
    notes?: string,
  ): Promise<ApiResponse<{ booking_reference: string; confirmation_sent: boolean }>> {
    return apiService["request"](`/patient-portal/appointments/${appointmentId}/book`, {
      method: "POST",
      body: JSON.stringify({
        patient_id: patientId,
        patient_notes: notes,
      }),
    })
  }

  async cancelAppointmentViaPortal(
    appointmentId: number,
    reason: string,
  ): Promise<ApiResponse<{ cancelled: boolean }>> {
    return apiService["request"](`/patient-portal/appointments/${appointmentId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ cancellation_reason: reason }),
    })
  }

  // Patient Preferences
  async getPatientPreferences(patientId: number): Promise<ApiResponse<PatientAppointmentPreferences>> {
    return apiService["request"](`/patient-portal/preferences/${patientId}`)
  }

  async updatePatientPreferences(
    patientId: number,
    preferences: Partial<PatientAppointmentPreferences>,
  ): Promise<ApiResponse<PatientAppointmentPreferences>> {
    return apiService["request"](`/patient-portal/preferences/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(preferences),
    })
  }

  // Patient Health Records
  async getPatientVisitHistory(patientId: number): Promise<ApiResponse<PatientDashboardData["recent_visits"]>> {
    return apiService["request"](`/patient-portal/visits/${patientId}`)
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
    return apiService["request"](`/patient-portal/visits/details/${visitId}`)
  }

  // Patient Feedback
  async submitPatientFeedback(
    patientId: number,
    feedback: Omit<PatientFeedback, "id" | "patient_id">,
  ): Promise<ApiResponse<PatientFeedback>> {
    return apiService["request"](`/patient-portal/feedback/${patientId}`, {
      method: "POST",
      body: JSON.stringify(feedback),
    })
  }

  async getPatientFeedbackHistory(patientId: number): Promise<ApiResponse<PatientFeedback[]>> {
    return apiService["request"](`/patient-portal/feedback/${patientId}`)
  }

  // Patient Communications
  async getPatientNotifications(patientId: number): Promise<ApiResponse<PatientDashboardData["notifications"]>> {
    return apiService["request"](`/patient-portal/notifications/${patientId}`)
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<{ marked: boolean }>> {
    return apiService["request"](`/patient-portal/notifications/${notificationId}/read`, {
      method: "POST",
    })
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
    return apiService["request"](`/patient-portal/documents/${patientId}`)
  }

  async downloadPatientDocument(documentId: number): Promise<ApiResponse<{ download_url: string }>> {
    return apiService["request"](`/patient-portal/documents/download/${documentId}`)
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
}

export const patientPortalService = new PatientPortalService()
// Already exported above, remove duplicate export
