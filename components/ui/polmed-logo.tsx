"use client"

import Image from "next/image"
import { cn } from "@/lib/utils"

interface PolmedLogoProps {
  variant?: "header" | "hero" | "large" | "compact"
  className?: string
  showGlow?: boolean
  animated?: boolean
  priority?: boolean
}

export function PolmedLogo({ 
  variant = "header", 
  className, 
  showGlow = true,
  animated = true,
  priority = false 
}: PolmedLogoProps) {
  const sizeClasses = {
    compact: "polmed-logo-header max-w-[120px]",
    header: "polmed-logo-header",
    hero: "polmed-logo-hero",
    large: "polmed-logo-large"
  }

  return (
    <div className={cn(
      "polmed-logo relative group",
      sizeClasses[variant],
      animated && "transition-all duration-300",
      className
    )}>
      <Image
        src="/polmed_logo.png"
        alt="POLMED - Professional Online Medical Services"
        width={variant === "large" ? 400 : variant === "hero" ? 320 : 200}
        height={variant === "large" ? 120 : variant === "hero" ? 96 : 60}
        className="w-full h-auto object-contain"
        priority={priority}
        quality={95}
        sizes={
          variant === "large" 
            ? "(max-width: 640px) 280px, (max-width: 768px) 320px, (max-width: 1024px) 360px, 400px"
            : variant === "hero"
            ? "(max-width: 640px) 200px, (max-width: 768px) 240px, (max-width: 1024px) 280px, 320px"
            : variant === "compact"
            ? "(max-width: 640px) 100px, (max-width: 768px) 110px, 120px"
            : "(max-width: 640px) 140px, (max-width: 768px) 160px, (max-width: 1024px) 180px, 200px"
        }
      />
      {showGlow && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-md" />
      )}
      {animated && showGlow && (
        <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 opacity-0 group-hover:opacity-30 blur-xl transition-all duration-500 rounded-lg -z-10" />
      )}
    </div>
  )
}

// Export variants for easier use
export const PolmedLogoHeader = (props: Omit<PolmedLogoProps, 'variant'>) => (
  <PolmedLogo variant="header" {...props} />
)

export const PolmedLogoHero = (props: Omit<PolmedLogoProps, 'variant'>) => (
  <PolmedLogo variant="hero" {...props} />
)

export const PolmedLogoLarge = (props: Omit<PolmedLogoProps, 'variant'>) => (
  <PolmedLogo variant="large" {...props} />
)

export const PolmedLogoCompact = (props: Omit<PolmedLogoProps, 'variant'>) => (
  <PolmedLogo variant="compact" {...props} />
)