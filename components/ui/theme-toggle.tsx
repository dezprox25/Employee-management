'use client'

import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'

  const handleToggle = () => {
    // Add a transient class to smooth the theme switch
    document.documentElement.classList.add('theme-switching')
    setTimeout(() => {
      document.documentElement.classList.remove('theme-switching')
    }, 300)
    setTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label="Toggle theme"
      aria-pressed={isDark}
      className="inline-flex items-center  cursor-pointer px-2  rounded-md  py-2 text-sm text-foreground  transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
   >
      {mounted ? (
        isDark ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />
      ) : (
        <Sun className="size-4" aria-hidden="true" />
      )}
      <span className="sr-only">Toggle dark mode</span>
    </button>
  )}