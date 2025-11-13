"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { Button, type ButtonProps } from "@/components/ui/button"
import type React from "react"

interface PulseButtonProps extends ButtonProps {
  children: React.ReactNode
  isPulsing?: boolean
}

export function PulseButton({ children, isPulsing = true, ...props }: PulseButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!buttonRef.current || !isPulsing) return

    const pulse = gsap.timeline({ repeat: -1 })
    pulse.to(buttonRef.current, {
      scale: 1.05,
      boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
      duration: 0.8,
      ease: "sine.inOut",
    })
    pulse.to(buttonRef.current, {
      scale: 1,
      boxShadow: "0 0 0px rgba(59, 130, 246, 0)",
      duration: 0.8,
      ease: "sine.inOut",
    })
  }, [isPulsing])

  return (
    <Button ref={buttonRef} {...props}>
      {children}
    </Button>
  )
}
