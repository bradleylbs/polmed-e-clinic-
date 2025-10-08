"use client"

import type React from "react"

import Image from "next/image"
import { useState, useEffect } from "react"
import { apiService } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Stethoscope, UserCheck, Users, Heart, AlertCircle, Eye, EyeOff } from "lucide-react"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface LoginFormProps {
  onLogin: (credentials: {
    email: string
    password: string
    role: UserRole
    mpNumber?: string
    userData?: any
    token?: string
  }) => void
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false) // Declare showPassword and setShowPassword

  // Clear error when inputs change
  useEffect(() => {
    setError(null)
  }, [email, password])

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
      console.log("[v0] Attempting login for:", email)

      const response = await apiService.login({
        email: email.trim().toLowerCase(),
        password: password,
      })

      console.log("[v0] Login response:", response)

      if (response.success && response.data) {
        const rawRole = String(response.data.user.role).toLowerCase().trim()
        const userRole = rawRole.replace(/\s+/g, "_") as UserRole

        console.log("[v0] Raw role from backend:", response.data.user.role)
        console.log("[v0] Normalized role:", userRole)
        console.log("[v0] Full user data:", JSON.stringify(response.data.user, null, 2))

        console.log("[v0] Login successful, role:", userRole)

        onLogin({
          email: email.trim().toLowerCase(),
          password,
          role: userRole,
          mpNumber: response.data.user.mp_number,
          userData: response.data.user, // Pass full user data
          token: response.data.token, // Pass token
        })
      } else {
        console.error("[v0] Login failed:", response.error)
        setError(response.error || "Login failed. Please check your credentials.")
      }
    } catch (err: any) {
      console.error("[v0] Login error:", err)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = handleSubmit

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/20 p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <Card className="w-full max-w-md relative shadow-2xl border-2 border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <Image
              src="/polmed_logo.png"
              alt="POLMED"
              width={200}
              height={64}
              className="h-16 w-auto transition-all hover:scale-105 duration-300"
              priority
            />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Staff Portal
            </h1>
            <CardDescription className="text-base">Electronic Patient Management System</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                autoComplete="email"
                disabled={isLoading}
                className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} // Use showPassword to toggle password visibility
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className="h-11 pr-10 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
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
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}{" "}
                  {/* Toggle icon based on showPassword */}
                  <span className="sr-only">Toggle password visibility</span>
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 group"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Signing in...
                </div>
              ) : (
                <>
                  Sign In
                  <Shield className="w-4 h-4 ml-2 group-hover:rotate-12 transition-transform" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
