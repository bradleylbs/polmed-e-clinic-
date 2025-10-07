"use client"

import { toast } from "@/components/ui/use-toast"
import { useState } from "react"

const RouteDetails = ({ params }: { params: { id: string } }) => {
  const [locations, setLocations] = useState<Record<string, unknown>[]>([])
  const routeId = params.id
  
  const fetchLocations = async () => {
    try {
      const response = await fetch(`/api/routes/${routeId}/locations`)
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }
      const data = await response.json()
      const locationsData = Array.isArray(data) ? data : (data as any).locations || []
      setLocations(locationsData)
    } catch (error) {
      console.error("Failed to fetch locations:", error)
      toast({
        title: "Error",
        description: "Failed to load route locations",
        variant: "destructive",
      })
    }
  }

  return <div>{/* ... existing code ... */}</div>
}

export default RouteDetails
