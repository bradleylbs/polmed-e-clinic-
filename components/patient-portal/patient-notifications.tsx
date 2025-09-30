"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bell, Calendar, Heart, AlertCircle, Info, CheckCircle, X, Loader2, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface PatientNotificationsProps {
  patientId: number
}

interface Notification {
  id: number
  type: "appointment" | "health" | "system" | "reminder"
  title: string
  message: string
  created_at: string
  is_read: boolean
  priority: "low" | "medium" | "high"
  action_url?: string
}

export function PatientNotifications({ patientId }: PatientNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchNotifications()
  }, [patientId])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      // Mock data for now - replace with actual API calls
      const mockNotifications: Notification[] = [
        {
          id: 1,
          type: "appointment",
          title: "Upcoming Appointment Reminder",
          message: "You have an appointment scheduled for tomorrow at 10:00 AM at Johannesburg Mobile Clinic.",
          created_at: "2024-01-14T09:00:00Z",
          is_read: false,
          priority: "high",
          action_url: "/patient-portal?tab=appointments",
        },
        {
          id: 2,
          type: "health",
          title: "Lab Results Available",
          message: "Your blood test results from your recent visit are now available for review.",
          created_at: "2024-01-13T14:30:00Z",
          is_read: false,
          priority: "medium",
          action_url: "/patient-portal?tab=health",
        },
        {
          id: 3,
          type: "reminder",
          title: "Medication Reminder",
          message: "Don't forget to take your prescribed medication (Amlodipine 5mg) this evening.",
          created_at: "2024-01-12T18:00:00Z",
          is_read: true,
          priority: "medium",
        },
        {
          id: 4,
          type: "system",
          title: "Profile Update Required",
          message: "Please update your emergency contact information in your profile.",
          created_at: "2024-01-10T10:00:00Z",
          is_read: true,
          priority: "low",
          action_url: "/patient-portal?tab=profile",
        },
      ]

      setNotifications(mockNotifications)
    } catch (err) {
      setError("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, is_read: true } : notification,
        ),
      )
      toast({
        title: "Notification marked as read",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })))
      toast({
        title: "All notifications marked as read",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      })
    }
  }

  const deleteNotification = async (notificationId: number) => {
    try {
      setNotifications((prev) => prev.filter((notification) => notification.id !== notificationId))
      toast({
        title: "Notification deleted",
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      })
    }
  }

  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case "appointment":
        return <Calendar className="w-5 h-5 text-blue-500" />
      case "health":
        return <Heart className="w-5 h-5 text-red-500" />
      case "reminder":
        return <Bell className="w-5 h-5 text-orange-500" />
      case "system":
        return <Info className="w-5 h-5 text-gray-500" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive"
      case "medium":
        return "default"
      case "low":
        return "secondary"
      default:
        return "secondary"
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`
    } else if (diffInHours < 48) {
      return "Yesterday"
    } else {
      return date.toLocaleDateString("en-ZA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading notifications...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground">
              You have {unreadCount} unread notification{unreadCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all ${!notification.is_read ? "border-l-4 border-l-primary bg-muted/30" : ""}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{getNotificationIcon(notification.type, notification.priority)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium ${!notification.is_read ? "font-semibold" : ""}`}>
                            {notification.title}
                          </h4>
                          <Badge variant={getPriorityColor(notification.priority)} className="text-xs">
                            {notification.priority}
                          </Badge>
                          {!notification.is_read && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(notification.created_at)}</p>
                      </div>
                      <div className="flex gap-1">
                        {!notification.is_read && (
                          <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {notification.action_url && (
                      <Button variant="outline" size="sm" className="mt-2 bg-transparent">
                        View Details
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
