"use client"

import { useEffect } from "react"
import gsap from "gsap"

export function PageTransition() {
  useEffect(() => {
    // Animate page entry
    gsap.fromTo(
      "body > *",
      {
        opacity: 0,
        y: 20,
      },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      },
    )
  }, [])

  return null
}
