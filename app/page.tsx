import { redirect } from "next/navigation"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Home",
  description: "Welcome to POLMED Mobile Clinic ERP - Your gateway to accessible healthcare.",
}

export default function Home() {
  // Server component redirect to public landing with proper status code
  redirect("/landing")
}
