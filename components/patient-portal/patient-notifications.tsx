"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bell, Calendar, Heart, AlertCircle, Info, CheckCircle, X, Loader2, Settings } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { patientPortalService } from "@/lib/patient-portal-service"

interface PatientNotificationsProps {
  patientId: number
}

interface Notification {
  id: number
  type: string
  subject?: string
  sent_at?: string
  status: string
  // Map these to work with existing component logic
  title?: string
  message?: string  
  created_at?: string
  is_read?: boolean
  priority?: "low" | "medium" | "high" | "urgent"
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
      setError(null)
      
      const response = await patientPortalService.getPatientNotifications(patientId)
      
      if (response.success && response.data) {
        setNotifications(response.data || [])
      } else {
        throw new Error(response.error || 'Failed to fetch notifications')
      }
    } catch (err) {
      setError("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: number) => {
    try {
      const response = await patientPortalService.markNotificationAsRead(notificationId)
      
      if (response.success) {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId 
              ? { ...notification, status: "read", sent_at: notification.sent_at || new Date().toISOString() } 
              : notification,
          ),
        )
        toast({
          title: "Notification marked as read",
        })
      } else {
        throw new Error(response.error || 'Failed to mark notification as read')
      }
    } catch (err) {
      console.error('Error marking notification as read:', err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark notification as read",
        variant: "destructive",
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((notification) => ({ ...notification, status: "read" })))
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
      case "health_update":
        return <Heart className="w-5 h-5 text-red-500" />
      case "reminder":
        return <Bell className="w-5 h-5 text-orange-500" />
      case "system":
        return <Info className="w-5 h-5 text-gray-500" />
      case "alert":
        return <AlertCircle className="w-5 h-5 text-red-600" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive"
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

  const unreadCount = notifications.filter((n) => n.status === "unread").length

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
              className={`transition-all ${notification.status === "unread" ? "border-l-4 border-l-primary bg-muted/30" : ""}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">{getNotificationIcon(notification.type || "system", notification.priority || "medium")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-medium ${notification.status === "unread" ? "font-semibold" : ""}`}>
                            {notification.title || notification.subject || "Notification"}
                          </h4>
                          <Badge variant={getPriorityColor(notification.priority || "medium")} className="text-xs">
                            {notification.priority || "medium"}
                          </Badge>
                          {notification.status === "unread" && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{notification.message || "No message content"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(notification.created_at || notification.sent_at || new Date().toISOString())}</p>
                      </div>
                      <div className="flex gap-1">
                        {notification.status === "unread" && (
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
