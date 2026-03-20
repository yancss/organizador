'use client'

import type { ReactNode } from 'react'

import { t } from '../i18n'
import { useSettings } from '../settings-context'

export default function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  const { language } = useSettings()
  const i = t(language)

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--foreground)]">
      {children}
      {required ? (
        <span className="text-[var(--danger)]" title={i.form.requiredHint} aria-label={i.form.requiredHint}>
          {i.form.requiredMark}
        </span>
      ) : null}
    </span>
  )
}
