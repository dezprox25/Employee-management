"use client"

import type React from "react"

import { useEffect, useRef } from "react"
import gsap from "gsap"

interface CardEntranceProps {
  children: React.ReactNode
  delay?: number
}

export function CardEntrance({ children, delay = 0 }: CardEntranceProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!cardRef.current) return

    gsap.fromTo(
      cardRef.current,
      {
        opacity: 0,
        y: 30,
        scale: 0.95,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.5,
        delay,
        ease: "back.out(1.2)",
      },
    )
  }, [delay])

  return <div ref={cardRef}>{children}</div>
}
