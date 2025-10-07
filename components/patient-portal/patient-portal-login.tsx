"use client"

import type React from "react"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Eye, EyeOff, Mail, Lock, Stethoscope, Shield, Heart, AlertCircle, ArrowRight } from "lucide-react"
import { patientPortalService } from "@/lib/patient-portal-service"
import { useToast } from "@/hooks/use-toast"

interface PatientPortalLoginProps {
  onLogin: (email: string, password: string) => Promise<void>
  onRegister: () => void
}

export function PatientPortalLogin({ onLogin, onRegister }: PatientPortalLoginProps) {
  // State management
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  // Handle login submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }
    setIsLoading(true)
    try {
      await onLogin(email, password)
    } catch (error) {
      setError("Login failed. Please check your credentials.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle forgot password submit
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) {
      setError("Please enter your email address")
      return
    }
    setIsLoading(true)
    try {
      const response = await patientPortalService.resetPatientPassword(resetEmail)
      if (response.success) {
        toast({
          title: "Reset Email Sent",
          description: "Please check your email for password reset instructions.",
        })
        setShowForgotPassword(false)
        setResetEmail("")
      } else {
        setError(response.error || "Failed to send reset email")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div
            className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <Card className="w-full max-w-md relative shadow-2xl border-2 border-border/50 bg-card/80 backdrop-blur-sm animate-fade-in">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-primary/30">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl">Reset Password</CardTitle>
              <CardDescription className="text-base">
                Enter your email address and we'll send you a link to reset your password
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="animate-fade-in">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="resetEmail" className="text-sm font-medium">
                  Email Address
                </Label>
                <Input
                  id="resetEmail"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105"
                disabled={isLoading}
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 bg-transparent"
                onClick={() => {
                  setShowForgotPassword(false)
                  setError(null)
                }}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main login view
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative">
        {/* Left side - Branding and Info */}
        <aside className="text-center lg:text-left space-y-8 animate-fade-in" aria-label="Patient Portal Info">
          <div className="flex items-center justify-center lg:justify-start">
            <Image
              src="/polmed_logo.png"
              alt="POLMED"
              width={220}
              height={72}
              className="h-20 w-auto transition-all hover:scale-105 duration-300"
              priority
            />
          </div>
          <div className="space-y-6">
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
              <span className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Your Health,{" "}
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                At Your Fingertips
              </span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Access your medical records, book appointments, and manage your healthcare journey with ease.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <Card className="border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 bg-card/80 backdrop-blur-sm group">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-bold text-sm">Secure Access</p>
                  <p className="text-xs text-muted-foreground">POPI Act Compliant</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 bg-card/80 backdrop-blur-sm group">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center shadow-lg shadow-secondary/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <Heart className="w-6 h-6 text-secondary-foreground" />
                </div>
                <div>
                  <p className="font-bold text-sm">Health Records</p>
                  <p className="text-xs text-muted-foreground">Complete History</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 bg-card/80 backdrop-blur-sm group">
              <CardContent className="p-6 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg shadow-accent/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <Stethoscope className="w-6 h-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="font-bold text-sm">Easy Booking</p>
                  <p className="text-xs text-muted-foreground">24/7 Access</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Right side - Login Form */}
        <main className="w-full max-w-md mx-auto animate-fade-in-up" aria-label="Login Form">
          <Card className="shadow-2xl border-2 border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="space-y-2">
                <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
                <CardDescription className="text-base">Sign in to your patient portal account</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5" aria-label="Patient Login">
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
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="pl-10 h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
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
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
                <Separator className="my-6" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={onRegister}
                      className="text-primary hover:underline font-semibold transition-colors"
                    >
                      Register here
                    </button>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
