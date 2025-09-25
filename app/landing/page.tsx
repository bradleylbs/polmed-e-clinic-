"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Stethoscope, ShieldCheck, Truck, Activity, Users, ArrowRight } from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top Nav */}
      <header className="sticky top-0 z-40 bg-background/70 backdrop-blur border-b">
        <div className="container mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2">
            {/* Consider swapping to your logo */}
            <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">POLMED Clinic</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="hover:text-primary">Features</Link>
            <Link href="#how" className="hover:text-primary">How it works</Link>
            <Link href="#contact" className="hover:text-primary">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/book-appointment">
              <Button variant="default" className="hidden sm:inline-flex">Book Appointment</Button>
            </Link>
            <Link href="/staff">
              <Button variant="outline">Staff Sign In</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center py-16">
          <div className="space-y-6">
            <Badge className="w-fit" variant="default">Mobile Health Outreach</Badge>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              Accessible Primary Care, Anywhere
            </h1>
            <p className="text-lg text-muted-foreground max-w-prose">
              Book appointments at our mobile clinics across communities. POLMED’s modern platform brings
              screening, chronic care, and essential services closer to you.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/book-appointment">
                <Button size="lg">Book an Appointment <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">Explore Features</Button>
              </a>
            </div>
            <div className="flex items-center gap-6 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Secure & Private</div>
              <div className="flex items-center gap-2"><Truck className="w-4 h-4" /> Mobile Clinics</div>
              <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> Real-time Updates</div>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <CalendarDays className="w-6 h-6 text-primary" />
                    <div>
                      <div className="font-semibold">Easy Scheduling</div>
                      <div className="text-sm text-muted-foreground">Find locations and time slots</div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Users className="w-6 h-6 text-primary" />
                    <div>
                      <div className="font-semibold">Community Focused</div>
                      <div className="text-sm text-muted-foreground">Schools, stations, centers</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="sm:col-span-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">Upcoming Outreach</div>
                        <div className="text-sm text-muted-foreground">Check published schedules near you</div>
                      </div>
                      <Link href="/book-appointment">
                        <Button size="sm" variant="secondary">Browse</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-muted/30 border-t">
        <div className="container mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">Why choose POLMED outreach?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Public Booking", desc: "Reserve time slots online at convenient locations.", icon: <CalendarDays className="w-5 h-5 text-primary" /> },
              { title: "Clinical Workflows", desc: "Streamlined, role-based care for staff.", icon: <Stethoscope className="w-5 h-5 text-primary" /> },
              { title: "Secure by Design", desc: "Privacy-first with secure data handling.", icon: <ShieldCheck className="w-5 h-5 text-primary" /> },
            ].map((f) => (
              <Card key={f.title}>
                <CardContent className="p-6 space-y-2">
                  <div className="flex items-center gap-2">{f.icon}<span className="font-medium">{f.title}</span></div>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="container mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: 1, title: "Find a location", desc: "Browse published mobile clinic stops near you." },
            { step: 2, title: "Choose a time", desc: "Select an open time slot that suits your schedule." },
            { step: 3, title: "Confirm booking", desc: "Enter your details and receive a confirmation." },
          ].map((s) => (
            <Card key={s.step}>
              <CardContent className="p-6 space-y-2">
                <Badge variant="secondary">Step {s.step}</Badge>
                <div className="font-semibold">{s.title}</div>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary/5 border-t">
        <div className="container mx-auto max-w-7xl px-4 py-16 flex flex-col items-center text-center gap-4">
          <h3 className="text-2xl md:text-3xl font-bold">Ready to book your appointment?</h3>
          <p className="text-muted-foreground max-w-prose">Choose a location and time that works for you. It only takes a minute.</p>
          <Link href="/book-appointment">
            <Button size="lg">Book Now</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t">
        <div className="container mx-auto max-w-7xl px-4 py-10 text-sm text-muted-foreground">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded bg-primary/10 flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-primary" />
              </div>
              <span>POLMED Clinic</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="mailto:info@example.com" className="hover:text-foreground">info@example.com</a>
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="text-center">© {new Date().getFullYear()} POLMED. All rights reserved.</div>
        </div>
      </footer>
    </main>
  )
}
