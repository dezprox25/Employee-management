'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

/**
 * Default theme behavior
 * - Initializes the app in light mode by default
 * - Disables automatic system theme detection
 * - Preserves manual theme switching via next-themes (setTheme)
 * - Uses `class` attribute so Tailwind `dark:` variants work correctly
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      {...props}
      attribute={props.attribute ?? 'class'}
      defaultTheme="light"
      enableSystem={false}
      storageKey={props.storageKey ?? 'dp-theme'}
      disableTransitionOnChange
      themes={props.themes ?? ['light', 'dark']}
    >
      {children}
    </NextThemesProvider>
  )
}
