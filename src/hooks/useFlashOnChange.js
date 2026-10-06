import { useEffect, useRef, useState } from 'react'

// Briefly scales a value up and back after it changes (not on first mount),
// so a derived number updating reads as "this just happened" rather than
// silently swapping in place.
export function useFlashOnChange(value) {
  const [bump, setBump] = useState(false)
  const prev = useRef(value)
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      prev.current = value
      return
    }
    if (prev.current === value) return
    prev.current = value
    setBump(true)
    const t = setTimeout(() => setBump(false), 260)
    return () => clearTimeout(t)
  }, [value])

  return bump
}
