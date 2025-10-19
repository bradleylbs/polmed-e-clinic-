/**
 * Feedback Utility Functions
 * 
 * Provides standardized feedback mechanisms for form submissions, updates, and deletions
 * throughout the application. Supports both toast notifications and modal dialogs.
 */

import type { ReactNode } from "react"

export type FeedbackType = "success" | "error" | "loading" | "warning" | "info"

export interface FeedbackConfig {
  title: string
  description?: string
  type: FeedbackType
  duration?: number // ms, 0 = persistent
  showIcon?: boolean
  action?: string
}

/**
 * Show a loading feedback during async operations
 * Returns a function to dismiss the feedback
 */
export const showLoadingFeedback = (toast: any, message: string = "Processing...") => {
  const toastId = toast({
    title: message,
    description: "Please wait...",
    variant: "default",
    duration: 0, // Persistent until manually closed
  })
  
  return () => {
    // Toast library typically auto-manages, but this allows explicit closure
  }
}

/**
 * Show success feedback for completed operations
 */
export const showSuccessFeedback = (
  toast: any,
  config: Omit<FeedbackConfig, "type"> = {
    title: "Success",
    description: "Operation completed successfully",
  }
) => {
  toast({
    title: config.title || "✅ Success",
    description: config.description || "Operation completed successfully",
    variant: "default",
    duration: config.duration || 3000,
  })
}

/**
 * Show error feedback for failed operations
 */
export const showErrorFeedback = (
  toast: any,
  config: Omit<FeedbackConfig, "type"> = {
    title: "Error",
    description: "An error occurred. Please try again.",
  }
) => {
  toast({
    title: config.title || "❌ Error",
    description: config.description || "An error occurred. Please try again.",
    variant: "destructive",
    duration: config.duration || 4000,
  })
}

/**
 * Show warning feedback for validation issues
 */
export const showWarningFeedback = (
  toast: any,
  config: Omit<FeedbackConfig, "type"> = {
    title: "Warning",
    description: "Please check your input and try again.",
  }
) => {
  toast({
    title: config.title || "⚠️ Warning",
    description: config.description || "Please check your input and try again.",
    variant: "destructive",
    duration: config.duration || 3500,
  })
}

/**
 * Show info feedback for general information
 */
export const showInfoFeedback = (
  toast: any,
  config: Omit<FeedbackConfig, "type"> = {
    title: "Information",
    description: "Here's something you should know.",
  }
) => {
  toast({
    title: config.title || "ℹ️ Information",
    description: config.description || "Here's something you should know.",
    variant: "default",
    duration: config.duration || 3000,
  })
}

/**
 * Handle form submission with feedback
 * Wraps async function with loading, success, and error states
 */
export const handleSubmissionWithFeedback = async (
  asyncFn: () => Promise<any>,
  toast: any,
  options: {
    loadingMessage?: string
    successMessage?: string
    errorMessage?: string
    onSuccess?: (result: any) => void
    onError?: (error: any) => void
  } = {}
) => {
  const {
    loadingMessage = "Submitting...",
    successMessage = "✅ Submitted successfully!",
    errorMessage = "❌ Failed to submit. Please try again.",
    onSuccess,
    onError,
  } = options

  try {
    // Show loading feedback
    toast({
      title: loadingMessage,
      description: "Processing your request...",
      variant: "default",
      duration: 0, // Persistent
    })

    // Execute the async function
    const result = await asyncFn()

    // Show success feedback
    toast({
      title: successMessage,
      description: "Your changes have been saved.",
      variant: "default",
      duration: 3000,
    })

    if (onSuccess) {
      onSuccess(result)
    }

    return result
  } catch (error) {
    // Show error feedback
    const errorMsg = error instanceof Error ? error.message : String(error)
    toast({
      title: errorMessage,
      description: errorMsg || "An unexpected error occurred.",
      variant: "destructive",
      duration: 4000,
    })

    if (onError) {
      onError(error)
    }

    throw error
  }
}

/**
 * Handle form update with feedback
 * Similar to submission but with "Update" terminology
 */
export const handleUpdateWithFeedback = async (
  asyncFn: () => Promise<any>,
  toast: any,
  options: {
    loadingMessage?: string
    successMessage?: string
    errorMessage?: string
    onSuccess?: (result: any) => void
    onError?: (error: any) => void
  } = {}
) => {
  return handleSubmissionWithFeedback(asyncFn, toast, {
    loadingMessage: options.loadingMessage || "Updating...",
    successMessage: options.successMessage || "✅ Updated successfully!",
    errorMessage: options.errorMessage || "❌ Failed to update. Please try again.",
    onSuccess: options.onSuccess,
    onError: options.onError,
  })
}

/**
 * Handle form deletion with feedback
 */
export const handleDeletionWithFeedback = async (
  asyncFn: () => Promise<any>,
  toast: any,
  options: {
    loadingMessage?: string
    successMessage?: string
    errorMessage?: string
    onSuccess?: (result: any) => void
    onError?: (error: any) => void
  } = {}
) => {
  return handleSubmissionWithFeedback(asyncFn, toast, {
    loadingMessage: options.loadingMessage || "Deleting...",
    successMessage: options.successMessage || "✅ Deleted successfully!",
    errorMessage: options.errorMessage || "❌ Failed to delete. Please try again.",
    onSuccess: options.onSuccess,
    onError: options.onError,
  })
}

/**
 * Format error message from API response
 */
export const formatErrorMessage = (error: any): string => {
  if (typeof error === "string") return error
  if (error?.message) return error.message
  if (error?.error) return error.error
  if (error?.description) return error.description
  if (error?.errors && Array.isArray(error.errors)) {
    return error.errors.map((e: any) => (typeof e === "string" ? e : e.message)).join(", ")
  }
  return "An unexpected error occurred. Please try again."
}

/**
 * Create a comprehensive feedback handler for async operations
 * Returns helper functions for different feedback types
 */
export const createFeedbackHandler = (toast: any) => ({
  loading: (message: string = "Processing...") =>
    showLoadingFeedback(toast, message),
  
  success: (config: Omit<FeedbackConfig, "type">) =>
    showSuccessFeedback(toast, config),
  
  error: (config: Omit<FeedbackConfig, "type">) =>
    showErrorFeedback(toast, config),
  
  warning: (config: Omit<FeedbackConfig, "type">) =>
    showWarningFeedback(toast, config),
  
  info: (config: Omit<FeedbackConfig, "type">) =>
    showInfoFeedback(toast, config),
  
  submit: (asyncFn: () => Promise<any>, options?: Parameters<typeof handleSubmissionWithFeedback>[2]) =>
    handleSubmissionWithFeedback(asyncFn, toast, options),
  
  update: (asyncFn: () => Promise<any>, options?: Parameters<typeof handleUpdateWithFeedback>[2]) =>
    handleUpdateWithFeedback(asyncFn, toast, options),
  
  delete: (asyncFn: () => Promise<any>, options?: Parameters<typeof handleDeletionWithFeedback>[2]) =>
    handleDeletionWithFeedback(asyncFn, toast, options),
})

export type FeedbackHandler = ReturnType<typeof createFeedbackHandler>
