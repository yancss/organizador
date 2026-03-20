import React from 'react'
import '@testing-library/jest-dom/vitest'

import { vi } from 'vitest'

vi.mock('next/navigation', async () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }
})

vi.mock('sonner', () => {
  return {
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      message: vi.fn(),
    },
  }
})

vi.mock('react-international-phone', () => {
  return {
    PhoneInput: (props: any) => {
      return React.createElement('input', {
        'data-testid': 'phone-input',
        value: props.value ?? '',
        onChange: (e: any) => props.onChange?.(e.target.value, { country: { iso2: 'pt' } }),
      })
    },
  }
})

// Some screens call window.confirm
Object.defineProperty(window, 'confirm', {
  value: vi.fn(() => true),
  writable: true,
})

// JSDOM doesn't implement ResizeObserver by default.
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// Attach polyfill to window in tests
Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserver,
  writable: true,
})
