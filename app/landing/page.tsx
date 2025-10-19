"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { PolmedLogoHeader, PolmedLogoCompact } from "@/components/ui/polmed-logo"
import {
  CalendarDays,
  Stethoscope,
  ShieldCheck,
  Truck,
  Activity,
  Users,
  User,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Clock,
  Menu,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react"
import { useState, useEffect } from "react"

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 overflow-x-hidden">
      {/* Enhanced Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 will-change-transform ${
          scrolled
            ? "bg-background/95 backdrop-blur-xl border-b border-border/60 shadow-lg transform-gpu"
            : "bg-background/85 backdrop-blur-xl border-b border-border/40"
        }`}
      >
        <div className={`container mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between transition-all duration-300 ${
          scrolled ? "py-2" : "py-4"
        }`}>
          <Link
            href="/landing"
            className="flex items-center gap-2 transition-all duration-300"
          >
            {scrolled ? (
              <Image
                src="/polmed_logo.png"
                alt="POLMED Logo"
                width={120}
                height={40}
                priority
                className="h-8 w-auto object-contain"
              />
            ) : (
              <Image
                src="/polmed_logo.png"
                alt="POLMED Logo"
                width={180}
                height={60}
                priority
                className="h-12 w-auto object-contain"
              />
            )}
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            {["How it works", "Features", "Contact"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="text-muted-foreground hover:text-primary transition-all relative group py-2"
              >
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/patient-portal" className="hidden sm:block">
              <Button className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105">
                <User className="w-4 h-4 mr-2" />
                Patient Portal
              </Button>
            </Link>
            <Link href="/staff">
              <Button className="shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105">
                Staff Sign In
              </Button>
            </Link>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-primary/10 rounded-lg transition-all"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`md:hidden transition-all duration-300 overflow-hidden ${
            mobileMenuOpen ? "max-h-96 border-t border-border/50" : "max-h-0"
          }`}
        >
          <nav className="container mx-auto max-w-7xl px-4 py-4 flex flex-col gap-3">
            {["How it works", "Features", "Contact"].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase().replace(" ", "-")}`}
                className="text-muted-foreground hover:text-primary transition-colors py-2 px-4 hover:bg-primary/5 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </Link>
            ))}
            <Separator className="my-2" />
            <Link href="/patient-portal" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full justify-start shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
                <User className="w-4 h-4 mr-2" />
                Patient Portal
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Enhanced Hero Section */}
      <section className="relative container mx-auto max-w-7xl px-4 sm:px-6 pt-32 pb-24 md:pt-40 md:pb-32">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse animate-delay-1s" />
        </div>

        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="space-y-8 animate-fade-in">
            <Badge className="w-fit text-sm px-5 py-2 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-all duration-300 hover:scale-105 cursor-default">
              <Activity className="w-3.5 h-3.5 mr-2 animate-pulse" />
              Mobile Health Outreach
            </Badge>
            
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.1] tracking-tight">
              <span className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                Accessible Primary Care,{" "}
              </span>
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                  Anywhere
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none">
                  <path
                    d="M0 7C66.6667 2.33333 133.333 2.33333 200 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary/30"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
              Book appointments at our mobile clinics across communities. POLMED's modern platform brings screening,
              chronic care, and essential services closer to you.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/patient-portal">
                <Button
                  size="lg"
                  className="text-base px-10 h-14 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 group"
                >
                  <User className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                  Patient Portal
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a href="#features">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-10 h-14 border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300 bg-transparent group"
                >
                  Explore Features
                  <ChevronDown className="w-5 h-5 ml-2 group-hover:translate-y-1 transition-transform" />
                </Button>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-8 pt-6">
              {[
                { icon: ShieldCheck, label: "Secure & Private", color: "primary" },
                { icon: Truck, label: "Mobile Clinics", color: "secondary" },
                { icon: Activity, label: "Real-time Updates", color: "accent" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-muted-foreground group cursor-default">
                  <div className={`w-10 h-10 rounded-full bg-${item.color}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`w-5 h-5 text-${item.color}`} />
                  </div>
                  <span className="font-medium text-sm group-hover:text-foreground transition-colors">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Enhanced Feature Cards Grid */}
          <div className="relative animate-fade-in-up">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl opacity-30 animate-pulse" />
            <div className="relative rounded-3xl border-2 border-border/50 bg-card/80 backdrop-blur-sm p-8 md:p-10 shadow-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  {
                    icon: CalendarDays,
                    title: "Easy Scheduling",
                    desc: "Find locations and time slots that work for you",
                    color: "primary",
                    gradient: "from-primary to-primary/70",
                  },
                  {
                    icon: Users,
                    title: "Community Focused",
                    desc: "Schools, stations, and community centers",
                    color: "secondary",
                    gradient: "from-secondary to-secondary/70",
                  },
                  {
                    icon: User,
                    title: "Patient Portal",
                    desc: "Access your health records anytime",
                    color: "accent",
                    gradient: "from-accent to-accent/70",
                  },
                  {
                    icon: MapPin,
                    title: "Upcoming Outreach",
                    desc: "Check published schedules near you",
                    color: "primary",
                    gradient: "from-primary to-primary/70",
                  },
                ].map((item, idx) => (
                  <Card
                    key={item.title}
                    className="border-2 border-border/50 shadow-lg hover:shadow-2xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 bg-gradient-to-br from-card to-muted/20 group"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <CardContent className="p-6 flex flex-col gap-4">
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg shadow-${item.color}/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300`}>
                        <item.icon className={`w-7 h-7 text-${item.color}-foreground`} />
                      </div>
                      <div className="space-y-2">
                        <div className="font-bold text-lg group-hover:text-primary transition-colors">{item.title}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed">{item.desc}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden lg:block">
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </div>
      </section>

      {/* Enhanced Features Section */}
      <section id="features" className="relative border-y border-border/50 bg-gradient-to-b from-muted/30 to-muted/10">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32">
          <div className="text-center mb-20 space-y-6 max-w-4xl mx-auto">
            <Badge className="text-sm px-5 py-2 bg-primary/10 text-primary border-primary/20 hover:scale-105 transition-transform cursor-default">
              <Sparkles className="w-3.5 h-3.5 mr-2" />
              POLMED Mobile Clinics
            </Badge>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Healthcare at Your Doorstep
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Bringing quality healthcare services directly to your community through our state-of-the-art mobile clinic network
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              {
                title: "Public Booking",
                desc: "Reserve time slots online at convenient locations with real-time availability and instant confirmation.",
                icon: CalendarDays,
                color: "primary",
                gradient: "from-primary/10 to-primary/5",
              },
              {
                title: "Clinical Workflows",
                desc: "Streamlined, role-based care delivery system designed for healthcare staff efficiency.",
                icon: Stethoscope,
                color: "secondary",
                gradient: "from-secondary/10 to-secondary/5",
              },
              {
                title: "Secure by Design",
                desc: "Privacy-first architecture with enterprise-grade data protection and compliance.",
                icon: ShieldCheck,
                color: "accent",
                gradient: "from-accent/10 to-accent/5",
              },
            ].map((f, idx) => (
              <Card
                key={f.title}
                className="group border-2 border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-2 bg-card/80 backdrop-blur-sm overflow-hidden relative"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <CardContent className="relative p-10 space-y-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-${f.color} to-${f.color}/70 flex items-center justify-center shadow-lg shadow-${f.color}/30 text-${f.color}-foreground group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                    <f.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold group-hover:text-primary transition-colors">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-base">{f.desc}</p>
                  <div className="pt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-x-0 group-hover:translate-x-2">
                    <CheckCircle2 className={`w-5 h-5 text-${f.color}`} />
                    <span className="text-sm font-medium text-muted-foreground">Learn more</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Patient Portal Section */}
      <section className="container mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32">
        <div className="text-center mb-20 space-y-6 max-w-3xl mx-auto">
          <Badge className="text-sm px-5 py-2 bg-secondary/10 text-secondary border-secondary/20 hover:scale-105 transition-transform cursor-default">
            Patient Portal
          </Badge>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            Manage Your Health Online
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Access your patient portal to view appointments, health records, and communicate with your healthcare team.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          {[
            {
              title: "View Appointments",
              desc: "See upcoming and past appointments with detailed information",
              icon: CalendarDays,
              color: "primary",
            },
            {
              title: "Health Records",
              desc: "Access your complete medical history and test results",
              icon: Activity,
              color: "secondary",
            },
            {
              title: "Secure Messaging",
              desc: "Communicate directly with your care team securely",
              icon: Users,
              color: "accent",
            },
            {
              title: "Privacy Protected",
              desc: "Your data is encrypted and completely secure",
              icon: ShieldCheck,
              color: "primary",
            },
          ].map((feature, idx) => (
            <Card
              key={feature.title}
              className="group border-2 border-border/50 shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-1 bg-card/80 backdrop-blur-sm"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <CardContent className="p-8 text-center space-y-5">
                <div className={`mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-${feature.color} to-${feature.color}/70 flex items-center justify-center text-${feature.color}-foreground shadow-lg shadow-${feature.color}/30 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Link href="/patient-portal">
            <Button
              size="lg"
              className="text-base px-10 h-14 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 group"
            >
              <User className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
              Access Patient Portal
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Enhanced How It Works Section */}
      <section id="how-it-works" className="relative border-y border-border/50 bg-gradient-to-b from-muted/10 to-muted/30">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32">
          <div className="text-center mb-20 space-y-6 max-w-4xl mx-auto">
            <Badge className="text-sm px-5 py-2 bg-accent/10 text-accent border-accent/20 hover:scale-105 transition-transform cursor-default">
              Easy Access to Healthcare
            </Badge>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              How It Works
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Four simple steps to access quality healthcare through our mobile clinic network
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 relative">
            {/* Enhanced connection lines */}
            <div className="hidden lg:block absolute top-20 left-[12.5%] right-[12.5%] h-0.5 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-primary via-secondary to-accent opacity-30 animate-pulse" />
            </div>

            {[
              {
                step: 1,
                title: "Find Mobile Clinic",
                desc: "Check our interactive schedule to find mobile clinic locations visiting your area.",
                icon: MapPin,
                color: "primary",
                action: "Browse Schedules"
              },
              {
                step: 2,
                title: "Book Appointment",
                desc: "Select a convenient time slot and book your appointment online or by phone.",
                icon: CalendarDays,
                color: "secondary",
                action: "Book Now"
              },
              {
                step: 3,
                title: "Visit Mobile Unit",
                desc: "Arrive at the scheduled time for your appointment at the mobile clinic location.",
                icon: Truck,
                color: "accent",
                action: "Get Care"
              },
              {
                step: 4,
                title: "Access Records",
                desc: "View your health records, results, and follow-up care through your patient portal.",
                icon: Activity,
                color: "primary",
                action: "Portal Access"
              },
            ].map((s, idx) => (
              <Card
                key={s.step}
                className="relative border-2 border-border/50 shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all duration-500 hover:-translate-y-3 bg-card/80 backdrop-blur-sm group"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <CardContent className="p-8 space-y-6 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-${s.color} to-${s.color}/70 flex items-center justify-center text-2xl font-bold text-${s.color}-foreground shadow-lg shadow-${s.color}/30 group-hover:scale-110 transition-all duration-500`}>
                        {s.step}
                      </div>
                      <div className={`absolute -top-1 -right-1 w-8 h-8 rounded-full bg-${s.color}/20 backdrop-blur flex items-center justify-center border-2 border-${s.color} group-hover:rotate-12 transition-transform duration-500`}>
                        <s.icon className={`w-4 h-4 text-${s.color}`} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-bold group-hover:text-primary transition-colors">{s.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-sm">{s.desc}</p>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs text-${s.color} border-${s.color}/30 group-hover:bg-${s.color}/10 transition-colors cursor-default`}
                  >
                    {s.action}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <div className="space-y-4 max-w-2xl mx-auto">
              <p className="text-sm text-muted-foreground">
                11 Thora Cres, Wynberg, Sandton, Johannesburg, South Africa 2090
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/patient-portal">
                  <Button
                    size="lg"
                    className="text-base px-10 h-14 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 group"
                  >
                    <User className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                    Patient Portal
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="#contact">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-base px-8 h-12 hover:scale-105 transition-all duration-300 group"
                  >
                    <MapPin className="w-5 h-5 mr-2 group-hover:bounce transition-transform" />
                    Find Locations
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Enhanced CTA Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-secondary/20 rounded-full blur-3xl animate-pulse animate-delay-1-5s" />
        
        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32 flex flex-col items-center text-center gap-10">
          <div className="space-y-6 max-w-3xl">
            <h3 className="text-4xl sm:text-5xl md:text-6xl font-bold">
              <span className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Ready to Book Your{" "}
              </span>
              <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Appointment?
              </span>
            </h3>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Choose a location and time that works for you. It only takes a minute to get started.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/patient-portal">
              <Button
                size="lg"
                className="text-base px-10 h-14 shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-105 transition-all duration-300 group"
              >
                <User className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Patient Portal
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Enhanced Footer */}
      {/* Enhanced Contact Section */}
      <section id="contact" className="relative border-t border-border/50 bg-gradient-to-b from-background to-muted/20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32">
          <div className="text-center mb-20 space-y-6 max-w-4xl mx-auto">
            <Badge className="text-sm px-5 py-2 bg-primary/10 text-primary border-primary/20 hover:scale-105 transition-transform cursor-default">
              <MapPin className="w-3.5 h-3.5 mr-2" />
              Get In Touch
            </Badge>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              Contact Us
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Need assistance with appointments or have questions? We're here to help you access the healthcare you need.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
            {/* Contact Information */}
            <div className="space-y-8">
              <Card className="border-2 border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardContent className="p-8 space-y-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                      <Activity className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold">Patient Support</h3>
                  </div>
                  
                  <div className="grid gap-6">
                    <div className="flex items-start gap-4">
                      <MapPin className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Head Office</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          Bldg 4, Villebois Office Park<br />
                          920 Jacques Street, Pretoria<br />
                          South Africa 0167
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Activity className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-2">Contact Numbers</h4>
                        <div className="space-y-1">
                          <a href="tel:+27129970383" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                            📞 +27 12 997 0383
                          </a>
                          <a href="tel:+27822644888" className="block text-muted-foreground hover:text-primary transition-colors text-sm">
                            📱 +27 82 264 4888
                          </a>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-4">
                      <Users className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold mb-1">Email Support</h4>
                        <a 
                          href="mailto:info@ramabulana.com" 
                          className="text-primary hover:text-primary/80 transition-colors hover:underline text-sm"
                        >
                          info@ramabulana.com
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Partnership Information */}
            <div className="space-y-8">
              <Card className="border-2 border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
                <CardContent className="p-7 space-y-5">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center shadow-lg">
                      <Truck className="w-6 h-6 text-secondary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold">Our Partners</h3>
                  </div>
                  
                  <div className="space-y-3.5">
                    <div className="text-center">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground block mb-3">
                        Powered by
                      </span>
                      <Image
                        src="/rm_logo.png"
                        alt="Masala Ramabulana Holdings"
                        width={220}
                        height={90}
                        className="h-12 w-auto mx-auto object-contain transition-all hover:scale-105 duration-300 filter brightness-110"
                        priority
                        quality={100}
                      />
                    </div>
                    
                    <div className="text-center space-y-3">
                      <h4 className="font-semibold">Masala Ramabulana Holdings</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Proudly partnering with POLMED to deliver innovative healthcare access across South Africa through our mobile clinic network.
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border/50">
                      <div className="flex items-start gap-4">
                        <Truck className="w-5 h-5 text-secondary mt-1 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold mb-1">Warehouse & Operations</h4>
                          <p className="text-muted-foreground text-sm leading-normal">
                            11 Thora Cres, Wynberg<br />
                            Sandton, Johannesburg<br />
                            South Africa 2090
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Quick Links */}
          <div className="text-center border-t border-border/50 pt-12">
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-8">
              <Link href="/patient-portal">
                <Button variant="outline" className="hover:scale-105 transition-all duration-300">
                  <User className="w-4 h-4 mr-2" />
                  Patient Portal
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" className="hover:scale-105 transition-all duration-300">
                  <Stethoscope className="w-4 h-4 mr-2" />
                  Features
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" className="hover:scale-105 transition-all duration-300">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  How It Works
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-border/50">
            <div>
              © {new Date().getFullYear()} Masala Ramabulana Holdings. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
          
          {/* Accreditation */}
          <div className="pt-4 text-center text-xs text-muted-foreground/70">
            <p>Developed by <span className="font-semibold text-muted-foreground hover:text-primary transition-colors cursor-default">Ongoti Tech Solutions</span></p>
          </div>
        </div>
      </footer>

      {/* Scroll to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-8 right-8 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 z-40 ${
          scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ChevronDown className="w-5 h-5 rotate-180" />
      </button>

      {/* Scroll to top button */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-8 right-8 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-primary/40 z-40 ${
          scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
        aria-label="Scroll to top"
      >
        <ChevronDown className="w-5 h-5 rotate-180" />
      </button>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }

        .animate-fade-in-up {
          animation: fade-in-up 1s ease-out forwards;
        }

        .bg-grid-pattern {
          background-image: 
            linear-gradient(to right, currentColor 1px, transparent 1px),
            linear-gradient(to bottom, currentColor 1px, transparent 1px);
          background-size: 40px 40px;
        }

        /* Smooth scroll behavior */
        html {
          scroll-behavior: smooth;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 10px;
        }

        ::-webkit-scrollbar-track {
          background: hsl(var(--background));
        }

        ::-webkit-scrollbar-thumb {
          background: hsl(var(--primary) / 0.3);
          border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--primary) / 0.5);
        }
      `}</style>
    </main>
  )
}
