"use client"

import type { ReactNode } from "react"
import { CardEntrance } from "./card-entrance"

interface StatsGridProps {
  children: ReactNode
}

export function StatsGrid({ children }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.isArray(children) ? (
        children.map((child, index) => (
          <CardEntrance key={index} delay={index * 0.1}>
            {child}
          </CardEntrance>
        ))
      ) : (
        <CardEntrance>{children}</CardEntrance>
      )}
    </div>
  )
}
