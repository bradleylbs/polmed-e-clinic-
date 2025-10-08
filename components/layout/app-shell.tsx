"use client"

import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { OfflineIndicator } from "@/components/offline/offline-indicator"
import {
  Users,
  Calendar,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Shield,
  Stethoscope,
  UserCheck,
  Heart,
  Route,
} from "lucide-react"

type UserRole = "administrator" | "doctor" | "nurse" | "clerk" | "social_worker"

interface User {
  username: string
  role: UserRole
  mpNumber?: string
}

interface AppShellProps {
  user: User
  children: ReactNode
  onLogout: () => void
}

const roleConfig = {
  administrator: { icon: Shield, label: "Administrator", color: "bg-primary text-primary-foreground" },
  doctor: { icon: Stethoscope, label: "Doctor", color: "bg-chart-1 text-white" },
  nurse: { icon: Heart, label: "Nurse", color: "bg-chart-2 text-white" },
  clerk: { icon: UserCheck, label: "Clerk", color: "bg-muted text-muted-foreground" },
  social_worker: { icon: Users, label: "Social Worker", color: "bg-accent text-accent-foreground" },
}

const navigationItems = [
  {
    id: "patients",
    label: "Patients",
    icon: Users,
    roles: ["administrator", "doctor", "nurse", "clerk", "social_worker"],
  },
  {
    id: "routes",
    label: "Routes",
    icon: Route,
    roles: ["administrator", "doctor", "nurse", "clerk"],
  },
  { id: "appointments", label: "Appointments", icon: Calendar, roles: ["administrator", "doctor", "nurse", "clerk"] },
  { id: "inventory", label: "Inventory", icon: Package, roles: ["administrator", "doctor", "nurse"] },
  { id: "reports", label: "Reports", icon: BarChart3, roles: ["administrator", "doctor"] },
  { id: "settings", label: "Settings", icon: Settings, roles: ["administrator"] },
]

export function AppShell({ user, children, onLogout }: AppShellProps) {
  const [activeTab, setActiveTab] = useState("patients")
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleNavigation = (itemId: string) => {
    setActiveTab(itemId)
    window.dispatchEvent(new CustomEvent("navigate", { detail: { view: itemId } }))
  }

  useEffect(() => {
    const handleNavigationEvent = (event: CustomEvent) => {
      if (event.detail?.view) {
        setActiveTab(event.detail.view)
      }
    }

    window.addEventListener("navigate", handleNavigationEvent as EventListener)
    return () => window.removeEventListener("navigate", handleNavigationEvent as EventListener)
  }, [])

  // Add validation to prevent the error
  if (!user || !user.role || !roleConfig[user.role]) {
    console.error("Invalid user object:", user)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    )
  }

  const normalizedRole = String(user.role).toLowerCase().replace(/\s+/g, "_") as UserRole
  const roleInfo = roleConfig[normalizedRole] || roleConfig["clerk"]
  const RoleIcon = roleInfo.icon

  console.log("[v0] AppShell user role:", user.role, "Normalized:", normalizedRole)

  const userNavItems = navigationItems.filter((item) => item.roles.includes(normalizedRole))

  console.log(
    "[v0] Available navigation items for role:",
    normalizedRole,
    userNavItems.map((i) => i.id),
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-r from-primary via-primary/95 to-primary/90 border-b border-primary/20 px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">POLMED Clinic</h1>
              <p className="text-xs text-white/80">Mobile ERP System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <OfflineIndicator />

            <div className="text-right">
              <p className="text-sm font-medium text-white">{user.username}</p>
              <Badge className={`text-xs ${roleInfo.color} shadow-sm`}>
                <RoleIcon className="w-3 h-3 mr-1" />
                {roleInfo.label}
              </Badge>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              className="bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-lg"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-16">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border shadow-2xl z-50">
        <div className="flex">
          {userNavItems.length > 0 ? (
            userNavItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all duration-300 ${
                    isActive
                      ? "text-primary bg-primary/10 border-t-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  <span className={`text-xs font-medium ${isActive ? "font-semibold" : ""}`}>{item.label}</span>
                </button>
              )
            })
          ) : (
            <div className="flex-1 text-center py-3 text-sm text-muted-foreground">
              No navigation items available for your role
            </div>
          )}
        </div>
      </nav>
    </div>
  )
}
