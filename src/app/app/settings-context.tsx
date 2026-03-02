'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppLanguage = 'pt' | 'en' | 'es'
export type AppTheme = 'light' | 'dark'
export type AppCurrency = 'EUR' | 'BRL' | 'USD'

type Settings = {
  language: AppLanguage
  theme: AppTheme
  currency: AppCurrency
  setLanguage: (l: AppLanguage) => void
  setTheme: (t: AppTheme) => void
  setCurrency: (c: AppCurrency) => void
}

const SettingsContext = createContext<Settings | null>(null)

const STORAGE_KEY = 'guardian.settings.v1'
const LEGACY_STORAGE_KEY = 'organizador.settings.v1'

function safeParse(raw: string | null): { language?: AppLanguage; theme?: AppTheme; currency?: AppCurrency } {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return {}
    const obj = v as { language?: string; theme?: string; currency?: string }

    const language = obj.language
    const theme = obj.theme
    const currency = obj.currency

    return {
      language: language === 'pt' || language === 'en' || language === 'es' ? language : undefined,
      theme: theme === 'light' || theme === 'dark' ? theme : undefined,
      currency: currency === 'EUR' || currency === 'BRL' || currency === 'USD' ? currency : undefined,
    }
  } catch {
    return {}
  }
}

function applyTheme(theme: AppTheme) {
  const el = document.documentElement

  // data-attribute (used by our CSS)
  el.dataset.theme = theme

  // class toggle (useful if we later adopt Tailwind dark variants)
  el.classList.toggle('dark', theme === 'dark')

  // helps built-in controls pick correct palette
  ;(el.style as unknown as { colorScheme?: string }).colorScheme = theme
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>('pt')
  const [theme, setTheme] = useState<AppTheme>('light')
  const [currency, setCurrency] = useState<AppCurrency>('EUR')

  // Load from localStorage on first mount (with legacy migration)
  useEffect(() => {
    const currentRaw = localStorage.getItem(STORAGE_KEY)
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY)

    const parsed = safeParse(currentRaw ?? legacyRaw)
    if (parsed.language) setLanguage(parsed.language)
    if (parsed.theme) setTheme(parsed.theme)
    if (parsed.currency) setCurrency(parsed.currency)

    // If we loaded legacy settings, persist them under the new key
    if (!currentRaw && legacyRaw) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          language: parsed.language ?? 'pt',
          theme: parsed.theme ?? 'light',
          currency: parsed.currency ?? 'EUR',
        })
      )
    }
  }, [])

  // Apply theme immediately
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Persist
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, theme, currency }))
  }, [language, theme, currency])

  const value = useMemo<Settings>(
    () => ({ language, theme, currency, setLanguage, setTheme, setCurrency }),
    [language, theme, currency]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
