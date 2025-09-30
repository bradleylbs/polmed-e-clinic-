import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    // Guard for environments without window (SSR) – effect only runs on client
    if (typeof window === "undefined") return

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`) // max-width is inclusive of value

    const onChange = () => {
      // Prefer matchMedia over innerWidth to avoid potential layout thrash
      setIsMobile(mql.matches)
    }

    // Set initial value from media query
    setIsMobile(mql.matches)

    // Safari < 14 fallback: addListener/removeListener
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    } else if (typeof (mql as any).addListener === "function") {
      ;(mql as any).addListener(onChange)
      return () => (mql as any).removeListener(onChange)
    }

    // If no listener API, no-op cleanup
    return () => {}
  }, [])

  return !!isMobile
}
