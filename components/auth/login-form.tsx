"use client"

import type React from "react"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { apiService } from "@/lib/api-service"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, Stethoscope, Heart, AlertCircle, Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft } from "lucide-react"

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

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setError(null)
  }, [email, password])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

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
      const response = await apiService.login({
        email: email.trim().toLowerCase(),
        password,
      })

      if (response.success && response.data) {
        const rawRole = String(response.data.user.role).toLowerCase().trim()
        const userRole = rawRole.replace(/\s+/g, "_") as UserRole

        onLogin({
          email: email.trim().toLowerCase(),
          password,
          role: userRole,
          mpNumber: response.data.user.mp_number,
          userData: response.data.user,
          token: response.data.token,
        })
      } else {
        setError(response.error || "Login failed. Please check your credentials.")
      }
    } catch (err) {
      console.error("[staff-login] Login error:", err)
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20 flex items-center justify-center p-4">
      {/* Header with Back Button */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-start">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-300 group"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
        </div>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse animate-delay-1s" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative mt-20">
        {/* Left side - Branding and messaging */}
        <aside className="text-center lg:text-left space-y-8 animate-fade-in" aria-label="Staff Portal Overview">
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
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Login - POLMED</p>
            <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
              <span className="bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Your Health,
              </span>
              <br />
              <span className="bg-linear-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                At Your Fingertips
              </span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Access your medical records, book appointments, and manage your healthcare journey with ease.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {[
              {
                icon: Shield,
                title: "Secure Access",
                description: "POPI Act Compliant",
                gradient: "from-primary to-primary/70",
                shadow: "shadow-primary/30",
                iconColor: "text-primary-foreground",
              },
              {
                icon: Heart,
                title: "Health Records",
                description: "Complete History",
                gradient: "from-secondary to-secondary/70",
                shadow: "shadow-secondary/30",
                iconColor: "text-secondary-foreground",
              },
              {
                icon: Stethoscope,
                title: "Easy Booking",
                description: "24/7 Access",
                gradient: "from-accent to-accent/70",
                shadow: "shadow-accent/30",
                iconColor: "text-accent-foreground",
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 bg-card/80 backdrop-blur-sm group"
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div
                    className={`mx-auto w-12 h-12 rounded-xl bg-linear-to-br ${item.gradient} flex items-center justify-center shadow-lg ${item.shadow} group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}
                  >
                    <item.icon className={`w-6 h-6 ${item.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </aside>

        {/* Right side - Login form */}
        <main className="w-full max-w-md mx-auto animate-fade-in-up" aria-label="Staff Login Form">
              <Card className="shadow-2xl border-2 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center space-y-4 pb-6">
                  <div className="space-y-2">
                    <CardTitle className="text-3xl font-bold">Staff Portal Access</CardTitle>
                    <CardDescription className="text-base">
                      Sign in securely to manage clinical workflows and patient services.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5" aria-label="Staff Login">
                    {error && (
                      <Alert variant="destructive" className="animate-fade-in">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Work Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="Enter your email"
                          autoComplete="email"
                          disabled={isLoading}
                          className="pl-10 h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-sm font-medium">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          disabled={isLoading}
                          className="pl-10 pr-10 h-11 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
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
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
  )
}
