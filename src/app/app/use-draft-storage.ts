'use client'

import { useEffect, useState } from 'react'

export function useDraftStorage<T>(key: string, initial: () => T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial()
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return initial()
      return JSON.parse(raw) as T
    } catch {
      return initial()
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore
    }
  }, [key, value])

  function clear() {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
    setValue(initial())
  }

  return { value, setValue, clear }
}
