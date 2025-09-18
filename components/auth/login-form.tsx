"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { apiService } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Stethoscope, UserCheck, Users, Heart, AlertCircle, Eye, EyeOff } from "lucide-react"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface LoginFormProps {
  onLogin: (credentials: { email: string; password: string; role: UserRole; mpNumber?: string }) => void
}

const roleConfig = {
  administrator: {
    icon: Shield,
    label: "Administrator",
    description: "Full system access and configuration",
    color: "bg-primary text-primary-foreground",
  },
  doctor: {
    icon: Stethoscope,
    label: "Doctor",
    description: "Patient diagnosis and treatment",
    color: "bg-chart-1 text-white",
  },
  nurse: {
    icon: Heart,
    label: "Nurse",
    description: "Vital signs and medical screening",
    color: "bg-chart-2 text-white",
  },
  clerk: {
    icon: UserCheck,
    label: "Clerk",
    description: "Patient registration and scheduling",
    color: "bg-muted text-muted-foreground",
  },
  social_worker: {
    icon: Users,
    label: "Social Worker",
    description: "Counseling and mental health support",
    color: "bg-accent text-accent-foreground",
  },
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("clerk")
  const [mpNumber, setMpNumber] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRoleSelection, setShowRoleSelection] = useState(false)

  // Clear error when inputs change
  useEffect(() => {
    setError(null)
  }, [email, password, mpNumber])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Client-side validation
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields")
      setIsLoading(false)
      return
    }

    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }

    try {
      console.log("Attempting login for:", email)
      
      const response = await apiService.login({
        email: email.trim().toLowerCase(),
        password: password,
      })

      console.log("Login response:", response)

      if (response.success && response.data) {
        const userRole = String(response.data.user.role).toLowerCase().replace(/\s+/g, "_") as UserRole

        // Auto-set role based on backend response
        setRole(userRole)
        setShowRoleSelection(false)

        // Validate MP number for doctors if provided
        if (userRole === "doctor" && mpNumber && response.data.user.mp_number) {
          if (response.data.user.mp_number !== mpNumber) {
            setError("MP number does not match your registered number")
            setIsLoading(false)
            return
          }
        }

        // Success - call onLogin with actual user role
        onLogin({
          email: email.trim().toLowerCase(),
          password,
          role: userRole,
          ...(userRole === "doctor" && mpNumber && { mpNumber }),
        })

      } else {
        console.error("Login failed:", response.error)
        setError(response.error || "Login failed. Please check your credentials.")
        setShowRoleSelection(false)
      }
    } catch (err: any) {
      console.error("Login error:", err)
      setError("Network error. Please check your connection and try again.")
      setShowRoleSelection(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields")
      return
    }

    // First, try to determine user role from backend
    try {
      setIsLoading(true)
      const response = await apiService.login({
        email: email.trim().toLowerCase(),
        password: password,
      })

      if (response.success && response.data) {
        // Login successful - use actual role from backend (normalized)
        const userRole = String(response.data.user.role).toLowerCase().replace(/\s+/g, "_") as UserRole
        onLogin({
          email: email.trim().toLowerCase(),
          password,
          role: userRole,
        })
      } else {
        setError(response.error || "Invalid credentials")
      }
    } catch (err) {
      setError("Network error. Please check your connection.")
    } finally {
      setIsLoading(false)
    }
  }

  const RoleIcon = roleConfig[role]?.icon || UserCheck

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Stethoscope className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold text-balance">POLMED Mobile Clinic</CardTitle>
          <CardDescription className="text-pretty">Electronic Patient Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={showRoleSelection ? handleSubmit : handleInitialSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            {showRoleSelection && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="role">User Role</Label>
                  <Select value={role} onValueChange={(value: UserRole) => setRole(value)} disabled={isLoading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleConfig).map(([key, config]) => {
                        const Icon = config.icon
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              <span>{config.label}</span>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  {roleConfig[role] && (
                    <Badge className={roleConfig[role].color}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {roleConfig[role].description}
                    </Badge>
                  )}
                </div>

                {role === "doctor" && (
                  <div className="space-y-2">
                    <Label htmlFor="mpNumber">MP Number (Optional)</Label>
                    <Input
                      id="mpNumber"
                      type="text"
                      value={mpNumber}
                      onChange={(e) => setMpNumber(e.target.value)}
                      placeholder="Medical Practice number"
                      disabled={isLoading}
                    />
                  </div>
                )}
              </>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>

            {showRoleSelection && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowRoleSelection(false)
                  setError(null)
                }}
                disabled={isLoading}
              >
                Back to Login
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}