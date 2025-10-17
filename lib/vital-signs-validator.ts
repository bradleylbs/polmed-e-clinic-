/**
 * 🏥 Vital Signs Validator - Medical Standards Based
 * 
 * Validates nursing vital signs against medical reference ranges
 * Used for real-time validation feedback in clinical workflow
 * 
 * Based on:
 * - WHO Guidelines
 * - American Heart Association (AHA) Standards
 * - Clinical Practice Guidelines
 */

export interface VitalSignValidation {
  isValid: boolean
  status: "valid" | "caution" | "critical" | "empty"
  message: string
  normalRange: string
  referenceRange: string
}

export interface AllVitalsValidation {
  systolic_bp: VitalSignValidation
  diastolic_bp: VitalSignValidation
  heart_rate: VitalSignValidation
  temperature: VitalSignValidation
  weight: VitalSignValidation
  height: VitalSignValidation
  oxygen_saturation: VitalSignValidation
  respiratory_rate?: VitalSignValidation
  bmi?: VitalSignValidation
  allValid: boolean
  anyWarnings: boolean
  anyCritical: boolean
  summary: string
}

/**
 * Validate Blood Pressure (Systolic)
 * Reference: Normal <120, Elevated 120-129, High ≥130
 */
export const validateSystolicBP = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Systolic BP not entered",
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  if (val < 70 || val > 250) {
    return {
      isValid: false,
      status: "critical",
      message: `Systolic BP ${val} mmHg is dangerously outside physiological range (70-250)`,
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  if (val < 90) {
    return {
      isValid: false,
      status: "critical",
      message: `Hypotension: ${val} mmHg is dangerously low (may indicate shock)`,
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  if (val >= 180) {
    return {
      isValid: false,
      status: "critical",
      message: `Hypertensive crisis: ${val} mmHg (≥180 indicates severe hypertension)`,
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  if (val >= 130) {
    return {
      isValid: true,
      status: "caution",
      message: `Stage 2 Hypertension: ${val} mmHg (≥130 is high, refer to doctor)`,
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  if (val >= 120) {
    return {
      isValid: true,
      status: "caution",
      message: `Elevated BP: ${val} mmHg (120-129 is elevated, monitor closely)`,
      normalRange: "< 120 mmHg",
      referenceRange: "90-120 mmHg (Normal Adult)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val} mmHg`,
    normalRange: "< 120 mmHg",
    referenceRange: "90-120 mmHg (Normal Adult)",
  }
}

/**
 * Validate Blood Pressure (Diastolic)
 * Reference: Normal <80, Elevated 80-89, High ≥90
 */
export const validateDiastolicBP = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Diastolic BP not entered",
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  if (val < 40 || val > 150) {
    return {
      isValid: false,
      status: "critical",
      message: `Diastolic BP ${val} mmHg is dangerously outside physiological range (40-150)`,
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  if (val < 50) {
    return {
      isValid: false,
      status: "critical",
      message: `Severe hypotension: ${val} mmHg is critically low`,
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  if (val >= 120) {
    return {
      isValid: false,
      status: "critical",
      message: `Severe hypertension: ${val} mmHg (≥120 indicates crisis)`,
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  if (val >= 90) {
    return {
      isValid: true,
      status: "caution",
      message: `Stage 2 Hypertension: ${val} mmHg (≥90 is high)`,
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  if (val >= 80) {
    return {
      isValid: true,
      status: "caution",
      message: `Stage 1 Hypertension: ${val} mmHg (80-89 is elevated)`,
      normalRange: "< 80 mmHg",
      referenceRange: "60-80 mmHg (Normal Adult)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val} mmHg`,
    normalRange: "< 80 mmHg",
    referenceRange: "60-80 mmHg (Normal Adult)",
  }
}

/**
 * Validate Heart Rate (Pulse)
 * Reference: Normal 60-100 bpm at rest
 */
export const validateHeartRate = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Heart rate not entered",
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  if (val < 20 || val > 300) {
    return {
      isValid: false,
      status: "critical",
      message: `Heart rate ${val} bpm is outside physiological range (20-300)`,
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  if (val < 40) {
    return {
      isValid: true,
      status: "caution",
      message: `Bradycardia: ${val} bpm (abnormally slow, <40)`,
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  if (val > 120) {
    return {
      isValid: true,
      status: "caution",
      message: `Tachycardia: ${val} bpm (abnormally fast, >120)`,
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  if (val < 60) {
    return {
      isValid: true,
      status: "caution",
      message: `Slightly slow: ${val} bpm (below normal range)`,
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  if (val > 100) {
    return {
      isValid: true,
      status: "caution",
      message: `Slightly elevated: ${val} bpm (above normal range)`,
      normalRange: "60-100 bpm",
      referenceRange: "60-100 bpm (Normal at rest)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val} bpm`,
    normalRange: "60-100 bpm",
    referenceRange: "60-100 bpm (Normal at rest)",
  }
}

/**
 * Validate Temperature (Celsius)
 * Reference: Normal 36.5-37.5°C
 */
export const validateTemperature = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Temperature not entered",
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val < 32 || val > 44) {
    return {
      isValid: false,
      status: "critical",
      message: `Temperature ${val}°C is dangerously outside physiological range (32-44)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val < 35) {
    return {
      isValid: false,
      status: "critical",
      message: `Hypothermia: ${val}°C is critically low (≤35 is severe)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val >= 40) {
    return {
      isValid: false,
      status: "critical",
      message: `Hyperthermia: ${val}°C is critically high (≥40 is severe)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val < 36.5) {
    return {
      isValid: true,
      status: "caution",
      message: `Low: ${val}°C (mild hypothermia, <36.5)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val > 38.5) {
    return {
      isValid: true,
      status: "caution",
      message: `High fever: ${val}°C (≥38.5 indicates significant fever)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  if (val > 37.5) {
    return {
      isValid: true,
      status: "caution",
      message: `Mild fever: ${val}°C (slightly elevated, investigate cause)`,
      normalRange: "36.5-37.5°C",
      referenceRange: "36.5-37.5°C (Normal)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val}°C`,
    normalRange: "36.5-37.5°C",
    referenceRange: "36.5-37.5°C (Normal)",
  }
}

/**
 * Validate Weight (kg)
 * Reference: Adult 30-150 kg (with context)
 */
export const validateWeight = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Weight not entered",
      normalRange: "30-150 kg",
      referenceRange: "30-150 kg (Adult)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "30-150 kg",
      referenceRange: "30-150 kg (Adult)",
    }
  }

  if (val < 10 || val > 300) {
    return {
      isValid: false,
      status: "critical",
      message: `Weight ${val} kg is outside physiological range (10-300)`,
      normalRange: "30-150 kg",
      referenceRange: "30-150 kg (Adult)",
    }
  }

  if (val < 30) {
    return {
      isValid: true,
      status: "caution",
      message: `Low weight: ${val} kg (possibly underweight, check BMI)`,
      normalRange: "30-150 kg",
      referenceRange: "30-150 kg (Adult)",
    }
  }

  if (val > 150) {
    return {
      isValid: true,
      status: "caution",
      message: `High weight: ${val} kg (possibly overweight, check BMI)`,
      normalRange: "30-150 kg",
      referenceRange: "30-150 kg (Adult)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Weight: ${val} kg`,
    normalRange: "30-150 kg",
    referenceRange: "30-150 kg (Adult)",
  }
}

/**
 * Validate Height (cm)
 * Reference: Adult 140-220 cm
 */
export const validateHeight = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Height not entered",
      normalRange: "140-220 cm",
      referenceRange: "140-220 cm (Adult)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "140-220 cm",
      referenceRange: "140-220 cm (Adult)",
    }
  }

  if (val < 50 || val > 300) {
    return {
      isValid: false,
      status: "critical",
      message: `Height ${val} cm is outside physiological range (50-300)`,
      normalRange: "140-220 cm",
      referenceRange: "140-220 cm (Adult)",
    }
  }

  if (val < 140) {
    return {
      isValid: true,
      status: "caution",
      message: `Short stature: ${val} cm (below average)`,
      normalRange: "140-220 cm",
      referenceRange: "140-220 cm (Adult)",
    }
  }

  if (val > 220) {
    return {
      isValid: true,
      status: "caution",
      message: `Tall stature: ${val} cm (above average)`,
      normalRange: "140-220 cm",
      referenceRange: "140-220 cm (Adult)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Height: ${val} cm`,
    normalRange: "140-220 cm",
    referenceRange: "140-220 cm (Adult)",
  }
}

/**
 * Validate Oxygen Saturation (SpO2)
 * Reference: Normal ≥95%, concerning <94%
 */
export const validateOxygenSaturation = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "O2 saturation not entered",
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  if (val < 0 || val > 100) {
    return {
      isValid: false,
      status: "critical",
      message: `O2 saturation ${val}% is outside valid range (0-100)`,
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  if (val < 85) {
    return {
      isValid: false,
      status: "critical",
      message: `Severe hypoxia: ${val}% (critical - immediate intervention needed)`,
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  if (val < 90) {
    return {
      isValid: false,
      status: "critical",
      message: `Hypoxia: ${val}% (requires oxygen therapy)`,
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  if (val < 95) {
    return {
      isValid: true,
      status: "caution",
      message: `Low O2: ${val}% (below normal, consider supplemental O2)`,
      normalRange: "≥95%",
      referenceRange: "95-100% (Normal on room air)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val}%`,
    normalRange: "≥95%",
    referenceRange: "95-100% (Normal on room air)",
  }
}

/**
 * Validate Respiratory Rate
 * Reference: Normal 12-20 breaths/min
 */
export const validateRespiratoryRate = (value: string | number | undefined): VitalSignValidation => {
  if (!value || value === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Respiratory rate not entered",
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  const val = Number(value)
  if (isNaN(val)) {
    return {
      isValid: false,
      status: "critical",
      message: "Invalid number",
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  if (val < 4 || val > 60) {
    return {
      isValid: false,
      status: "critical",
      message: `Respiratory rate ${val} is outside physiological range (4-60)`,
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  if (val < 10) {
    return {
      isValid: false,
      status: "critical",
      message: `Severe bradypnea: ${val} breaths/min (critically slow, <10)`,
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  if (val > 40) {
    return {
      isValid: false,
      status: "critical",
      message: `Severe tachypnea: ${val} breaths/min (critically fast, >40)`,
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  if (val < 12) {
    return {
      isValid: true,
      status: "caution",
      message: `Bradypnea: ${val} breaths/min (slow breathing, <12)`,
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  if (val > 20) {
    return {
      isValid: true,
      status: "caution",
      message: `Tachypnea: ${val} breaths/min (fast breathing, >20)`,
      normalRange: "12-20 breaths/min",
      referenceRange: "12-20 breaths/min (Normal at rest)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: ${val} breaths/min`,
    normalRange: "12-20 breaths/min",
    referenceRange: "12-20 breaths/min (Normal at rest)",
  }
}

/**
 * Calculate BMI from weight and height
 * Reference: <18.5 underweight, 18.5-24.9 normal, 25-29.9 overweight, ≥30 obese
 */
export const calculateAndValidateBMI = (
  weight: string | number | undefined,
  height: string | number | undefined
): VitalSignValidation => {
  if (!weight || !height || weight === "" || height === "") {
    return {
      isValid: true,
      status: "empty",
      message: "Weight and height needed for BMI calculation",
      normalRange: "18.5-24.9",
      referenceRange: "18.5-24.9 kg/m² (Normal)",
    }
  }

  const w = Number(weight)
  const h = Number(height)

  if (isNaN(w) || isNaN(h)) {
    return {
      isValid: true,
      status: "empty",
      message: "Enter valid weight and height",
      normalRange: "18.5-24.9",
      referenceRange: "18.5-24.9 kg/m² (Normal)",
    }
  }

  const heightInMeters = h / 100
  const bmi = w / (heightInMeters * heightInMeters)

  if (bmi < 18.5) {
    return {
      isValid: true,
      status: "caution",
      message: `Underweight: BMI ${bmi.toFixed(1)} (<18.5)`,
      normalRange: "18.5-24.9",
      referenceRange: "18.5-24.9 kg/m² (Normal)",
    }
  }

  if (bmi >= 30) {
    return {
      isValid: true,
      status: "caution",
      message: `Obese: BMI ${bmi.toFixed(1)} (≥30)`,
      normalRange: "18.5-24.9",
      referenceRange: "18.5-24.9 kg/m² (Normal)",
    }
  }

  if (bmi >= 25) {
    return {
      isValid: true,
      status: "caution",
      message: `Overweight: BMI ${bmi.toFixed(1)} (25-29.9)`,
      normalRange: "18.5-24.9",
      referenceRange: "18.5-24.9 kg/m² (Normal)",
    }
  }

  return {
    isValid: true,
    status: "valid",
    message: `Normal: BMI ${bmi.toFixed(1)} (18.5-24.9)`,
    normalRange: "18.5-24.9",
    referenceRange: "18.5-24.9 kg/m² (Normal)",
  }
}

/**
 * Validate all vital signs together
 */
export const validateAllVitalSigns = (vitals: {
  systolic_bp?: string | number
  diastolic_bp?: string | number
  heart_rate?: string | number
  temperature?: string | number
  weight?: string | number
  height?: string | number
  oxygen_saturation?: string | number
  respiratory_rate?: string | number
}): AllVitalsValidation => {
  const systolic = validateSystolicBP(vitals.systolic_bp)
  const diastolic = validateDiastolicBP(vitals.diastolic_bp)
  const heartRate = validateHeartRate(vitals.heart_rate)
  const temperature = validateTemperature(vitals.temperature)
  const weight = validateWeight(vitals.weight)
  const height = validateHeight(vitals.height)
  const oxygenSat = validateOxygenSaturation(vitals.oxygen_saturation)
  const respiratoryRate = vitals.respiratory_rate ? validateRespiratoryRate(vitals.respiratory_rate) : undefined
  const bmi = calculateAndValidateBMI(vitals.weight, vitals.height)

  const validations = [systolic, diastolic, heartRate, temperature, weight, height, oxygenSat]
  if (respiratoryRate) validations.push(respiratoryRate)

  const anyCritical = validations.some((v) => v.status === "critical")
  const anyWarnings = validations.some((v) => v.status === "caution")
  const allValid = validations.every((v) => v.isValid)

  // Generate summary
  const criticalItems = validations.filter((v) => v.status === "critical")
  const cautionItems = validations.filter((v) => v.status === "caution")

  let summary = ""
  if (criticalItems.length > 0) {
    summary = `⚠️ ${criticalItems.length} critical value(s) detected - review required`
  } else if (cautionItems.length > 0) {
    summary = `⚡ ${cautionItems.length} caution value(s) - monitor closely`
  } else {
    summary = "✅ All vital signs within acceptable ranges"
  }

  return {
    systolic_bp: systolic,
    diastolic_bp: diastolic,
    heart_rate: heartRate,
    temperature,
    weight,
    height,
    oxygen_saturation: oxygenSat,
    respiratory_rate: respiratoryRate,
    bmi,
    allValid,
    anyWarnings,
    anyCritical,
    summary,
  }
}

/**
 * Get color coding for validation status
 */
export const getValidationColor = (status: "valid" | "caution" | "critical" | "empty") => {
  switch (status) {
    case "critical":
      return "border-red-500 bg-red-50 text-red-900"
    case "caution":
      return "border-yellow-500 bg-yellow-50 text-yellow-900"
    case "valid":
      return "border-green-500 bg-green-50 text-green-900"
    case "empty":
      return "border-gray-300 bg-gray-50 text-gray-600"
  }
}

/**
 * Get icon for validation status
 */
export const getValidationIcon = (status: "valid" | "caution" | "critical" | "empty") => {
  switch (status) {
    case "critical":
      return "🔴"
    case "caution":
      return "🟡"
    case "valid":
      return "🟢"
    case "empty":
      return "⭕"
  }
}
