"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

interface ErrorFallbackProps {
  title: string
  message: string
  onAction: () => void
  actionLabel: string
  secondaryAction?: () => void
  secondaryActionLabel?: string
  icon?: React.ReactNode
}

export function ErrorFallback({
  title,
  message,
  onAction,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  icon,
}: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
              {icon || <AlertTriangle className="w-10 h-10 text-yellow-600" />}
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">{title}</h3>
              <p className="text-muted-foreground">{message}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button onClick={onAction} className="flex-1">
                {actionLabel}
              </Button>
              {secondaryAction && secondaryActionLabel && (
                <Button variant="outline" onClick={secondaryAction} className="flex-1 bg-transparent">
                  {secondaryActionLabel}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
