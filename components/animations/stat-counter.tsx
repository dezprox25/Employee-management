"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"

interface StatCounterProps {
  from: number
  to: number
  duration?: number
  format?: (val: number) => string
}

export function StatCounter({ from, to, duration = 1.5, format = (v) => v.toString() }: StatCounterProps) {
  const [displayValue, setDisplayValue] = useState(from)
  const counterRef = useRef({ value: from })

  useEffect(() => {
    gsap.to(counterRef.current, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        setDisplayValue(Math.floor(counterRef.current.value))
      },
    })
  }, [to, duration])

  return <span>{format(displayValue)}</span>
}
