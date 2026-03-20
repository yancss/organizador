'use client'

import { t } from '../i18n'
import { useSettings, type AppCurrency, type AppLanguage } from '../settings-context'

export default function SettingsPanel() {
  const { language, currency, setLanguage, setCurrency } = useSettings()
  const i = t(language)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{i.settings.title}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{i.settings.subtitle}</p>
      </header>

      <section className="surface rounded-xl border border-theme">
        <div className="divide-y">
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{i.settings.language}</div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">Português, English, Español</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'pt', label: 'PT' },
                    { value: 'en', label: 'EN' },
                    { value: 'es', label: 'ES' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={"chip " + (language === opt.value ? 'chip-on' : '')}
                    onClick={() => setLanguage(opt.value as AppLanguage)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">{i.settings.currency}</div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">EUR / BRL / USD</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'EUR', label: i.settings.eur },
                    { value: 'BRL', label: i.settings.brl },
                    { value: 'USD', label: i.settings.usd },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={"chip " + (currency === opt.value ? 'chip-on' : '')}
                    onClick={() => setCurrency(opt.value as AppCurrency)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className="text-xs text-[var(--muted-foreground)]">
        As alterações são aplicadas imediatamente e ficam salvas neste dispositivo.
      </p>
    </div>
  )
}
