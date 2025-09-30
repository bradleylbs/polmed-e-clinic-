"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Star, MessageSquare, Send, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PatientFeedbackProps {
  patientId: number
}

interface FeedbackItem {
  id: number
  visit_date: string
  location_name: string
  rating: number
  feedback_text: string
  submitted_at: string
  status: "pending" | "reviewed" | "responded"
  response?: string
}

export function PatientFeedback({ patientId }: PatientFeedbackProps) {
  const [activeTab, setActiveTab] = useState<"submit" | "history">("submit")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Form state for new feedback
  const [feedbackForm, setFeedbackForm] = useState({
    visit_date: "",
    location_name: "",
    rating: 0,
    feedback_text: "",
    service_areas: {
      registration: 0,
      nursing: 0,
      doctor_consultation: 0,
      overall_experience: 0,
    },
  })

  // Mock feedback history
  const [feedbackHistory] = useState<FeedbackItem[]>([
    {
      id: 1,
      visit_date: "2024-01-15",
      location_name: "Johannesburg Mobile Clinic",
      rating: 5,
      feedback_text:
        "Excellent service! The staff was very professional and caring. The doctor took time to explain my condition thoroughly.",
      submitted_at: "2024-01-16T10:30:00Z",
      status: "responded",
      response: "Thank you for your positive feedback! We're glad you had a great experience with our team.",
    },
    {
      id: 2,
      visit_date: "2024-02-20",
      location_name: "Cape Town Mobile Clinic",
      rating: 4,
      feedback_text:
        "Good service overall, but the waiting time was a bit long. The medical care was excellent though.",
      submitted_at: "2024-02-21T14:15:00Z",
      status: "reviewed",
    },
  ])

  const handleRatingChange = (field: string, rating: number) => {
    if (field === "overall") {
      setFeedbackForm((prev) => ({ ...prev, rating }))
    } else {
      setFeedbackForm((prev) => ({
        ...prev,
        service_areas: { ...prev.service_areas, [field]: rating },
      }))
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.visit_date || !feedbackForm.location_name || feedbackForm.rating === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and provide a rating.",
        variant: "destructive",
      })
      return
    }

    try {
      setLoading(true)
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Feedback submitted successfully",
        description: "Thank you for your feedback! We appreciate your input.",
      })

      // Reset form
      setFeedbackForm({
        visit_date: "",
        location_name: "",
        rating: 0,
        feedback_text: "",
        service_areas: {
          registration: 0,
          nursing: 0,
          doctor_consultation: 0,
          overall_experience: 0,
        },
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const renderStarRating = (rating: number, onRatingChange?: (rating: number) => void, size: "sm" | "md" = "md") => {
    const starSize = size === "sm" ? "w-4 h-4" : "w-6 h-6"

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            title={`Set rating to ${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onRatingChange?.(star)}
            disabled={!onRatingChange}
            className={`${starSize} ${
              star <= rating ? "text-yellow-400 fill-current" : "text-gray-300"
            } ${onRatingChange ? "hover:text-yellow-400 cursor-pointer" : ""}`}
          >
            <Star className={starSize} />
          </button>
        ))}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "secondary"
      case "reviewed":
        return "default"
      case "responded":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feedback & Reviews</h2>
        <div className="flex gap-2">
          <Button variant={activeTab === "submit" ? "default" : "outline"} onClick={() => setActiveTab("submit")}>
            Submit Feedback
          </Button>
          <Button variant={activeTab === "history" ? "default" : "outline"} onClick={() => setActiveTab("history")}>
            Feedback History
          </Button>
        </div>
      </div>

      {activeTab === "submit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Submit New Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="visit_date">Visit Date *</Label>
                <Input
                  id="visit_date"
                  type="date"
                  value={feedbackForm.visit_date}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, visit_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="location_name">Location *</Label>
                <Input
                  id="location_name"
                  placeholder="e.g., Johannesburg Mobile Clinic"
                  value={feedbackForm.location_name}
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, location_name: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Overall Rating *</Label>
              <div className="flex items-center gap-2 mt-2">
                {renderStarRating(feedbackForm.rating, (rating) => handleRatingChange("overall", rating))}
                <span className="text-sm text-muted-foreground ml-2">
                  {feedbackForm.rating > 0 ? `${feedbackForm.rating}/5` : "Select rating"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Service Area Ratings (Optional)</Label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Registration Process</span>
                  {renderStarRating(
                    feedbackForm.service_areas.registration,
                    (rating) => handleRatingChange("registration", rating),
                    "sm",
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Nursing Assessment</span>
                  {renderStarRating(
                    feedbackForm.service_areas.nursing,
                    (rating) => handleRatingChange("nursing", rating),
                    "sm",
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Doctor Consultation</span>
                  {renderStarRating(
                    feedbackForm.service_areas.doctor_consultation,
                    (rating) => handleRatingChange("doctor_consultation", rating),
                    "sm",
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm">Overall Experience</span>
                  {renderStarRating(
                    feedbackForm.service_areas.overall_experience,
                    (rating) => handleRatingChange("overall_experience", rating),
                    "sm",
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="feedback_text">Your Feedback</Label>
              <Textarea
                id="feedback_text"
                placeholder="Please share your experience, suggestions, or any concerns..."
                value={feedbackForm.feedback_text}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, feedback_text: e.target.value }))}
                rows={4}
              />
            </div>

            <Button onClick={handleSubmitFeedback} disabled={loading} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Submit Feedback
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          {feedbackHistory.length > 0 ? (
            feedbackHistory.map((feedback) => (
              <Card key={feedback.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{feedback.location_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Visit: {formatDate(feedback.visit_date)} • Submitted: {formatDate(feedback.submitted_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStarRating(feedback.rating, undefined, "sm")}
                      <Badge variant={getStatusColor(feedback.status)}>{feedback.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{feedback.feedback_text}</p>

                  {feedback.response && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Response from PALMED Team:</strong>
                        <br />
                        {feedback.response}
                      </AlertDescription>
                    </Alert>
                  )}

                  {feedback.status === "pending" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your feedback is being reviewed by our team. We'll respond within 2-3 business days.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No feedback submitted yet</p>
                <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveTab("submit")}>
                  Submit Your First Feedback
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
