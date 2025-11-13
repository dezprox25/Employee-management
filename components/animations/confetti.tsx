"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"

interface ConfettiProps {
  trigger?: boolean
}

export function Confetti({ trigger = false }: ConfettiProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!trigger || !containerRef.current) return

    const pieces = Array.from({ length: 30 }, () => {
      const piece = document.createElement("div")
      piece.style.position = "fixed"
      piece.style.width = "10px"
      piece.style.height = "10px"
      piece.style.pointerEvents = "none"
      piece.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 50%)`
      piece.style.borderRadius = "50%"
      piece.style.left = Math.random() * window.innerWidth + "px"
      piece.style.top = "-10px"
      containerRef.current?.appendChild(piece)
      return piece
    })

    pieces.forEach((piece) => {
      gsap.to(piece, {
        y: window.innerHeight + 10,
        x: (Math.random() - 0.5) * 200,
        rotation: Math.random() * 360,
        opacity: 0,
        duration: 2,
        ease: "power2.in",
        onComplete: () => {
          piece.remove()
        },
      })
    })
  }, [trigger])

  return <div ref={containerRef} />
}
