'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import LoginForm, { type LoginFormLabels } from './login-form'

type Lang = 'pt-BR' | 'en' | 'es'
type Theme = 'light' | 'dark'

const STORAGE_LANG = 'guardian.lang'
const STORAGE_THEME = 'guardian.theme'

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

export default function LoginClient() {
  const [lang, setLang] = useState<Lang>('pt-BR')
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedLang = (localStorage.getItem(STORAGE_LANG) as Lang | null) ?? 'pt-BR'
    const rawTheme = localStorage.getItem(STORAGE_THEME)

    // migração: versões antigas tinham "system"; agora removemos essa opção
    const savedTheme: Theme = rawTheme === 'dark' ? 'dark' : 'light'

    setLang(savedLang)
    setTheme(savedTheme)
    applyTheme(savedTheme)
  }, [])

  function onChangeTheme(next: Theme) {
    setTheme(next)
    localStorage.setItem(STORAGE_THEME, next)
    applyTheme(next)
  }

  function onChangeLang(next: Lang) {
    setLang(next)
    localStorage.setItem(STORAGE_LANG, next)
  }

  const t = useMemo(() => {
    const dict = {
      'pt-BR': {
        title: 'Guardian',
        subtitle: 'Entre com email e senha.',
        noAccount: 'Não tem conta?',
        createUser: 'Criar usuário',
        forgotPassword: 'Esqueci a senha',
        labels: {
          email: 'Email',
          password: 'Senha',
          submit: 'Entrar',
          submitting: 'Entrando…',
          invalid: 'Email ou senha inválidos.',
        } satisfies LoginFormLabels,
        theme: 'Tema',
        lang: 'Idioma',
        themeLight: 'Claro',
        themeDark: 'Escuro',
      },
      en: {
        title: 'Guardian',
        subtitle: 'Sign in with email and password.',
        noAccount: "Don't have an account?",
        createUser: 'Create user',
        forgotPassword: 'Forgot password',
        labels: {
          email: 'Email',
          password: 'Password',
          submit: 'Sign in',
          submitting: 'Signing in…',
          invalid: 'Invalid email or password.',
        } satisfies LoginFormLabels,
        theme: 'Theme',
        lang: 'Language',
        themeLight: 'Light',
        themeDark: 'Dark',
      },
      es: {
        title: 'Guardian',
        subtitle: 'Inicia sesión con correo y contraseña.',
        noAccount: '¿No tienes cuenta?',
        createUser: 'Crear usuario',
        forgotPassword: 'Olvidé mi contraseña',
        labels: {
          email: 'Correo',
          password: 'Contraseña',
          submit: 'Entrar',
          submitting: 'Entrando…',
          invalid: 'Correo o contraseña inválidos.',
        } satisfies LoginFormLabels,
        theme: 'Tema',
        lang: 'Idioma',
        themeLight: 'Claro',
        themeDark: 'Oscuro',
      },
    } as const

    return dict[lang]
  }, [lang])

  const pillBase =
    'inline-flex items-center gap-1.5 rounded-full border border-theme px-3 py-1.5 text-xs font-medium transition-colors'
  const pillActive = 'bg-[var(--primary)] text-[var(--primary-foreground)]'
  const pillIdle = 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--muted)]'

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="surface relative w-full max-w-md rounded-2xl border border-theme p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur">
      {children}
    </div>
  )

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background com cara de app (gradiente + blobs) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 10% 10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%), radial-gradient(900px 500px at 90% 20%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%), radial-gradient(900px 600px at 30% 90%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 60%)',
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.02))]" />

      {/* Controles no canto superior direito (fora do card) */}
      <div className="fixed right-5 top-5 z-20">
        <div className="surface-2 rounded-2xl border border-theme p-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">{t.lang}</span>
            <div className="flex gap-1">
              {(
                [
                  { key: 'pt-BR', label: 'PT' },
                  { key: 'en', label: 'EN' },
                  { key: 'es', label: 'ES' },
                ] as const
              ).map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => onChangeLang(x.key)}
                  className={`${pillBase} ${lang === x.key ? pillActive : pillIdle}`}
                  aria-pressed={lang === x.key}
                >
                  <span className="opacity-80">🌐</span>
                  {x.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">{t.theme}</span>
            <div className="flex gap-1">
              {(
                [
                  { key: 'light', label: t.themeLight, icon: '☀️' },
                  { key: 'dark', label: t.themeDark, icon: '🌙' },
                ] as const
              ).map((x) => (
                <button
                  key={x.key}
                  type="button"
                  onClick={() => onChangeTheme(x.key)}
                  className={`${pillBase} ${theme === x.key ? pillActive : pillIdle}`}
                  aria-pressed={theme === x.key}
                >
                  <span className="opacity-80">{x.icon}</span>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-14">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2">
          {/* Lado esquerdo: branding */}
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
                <span className="font-brand text-lg font-semibold">G</span>
              </div>
              <div>
                <div className="font-brand text-2xl font-semibold tracking-tight">{t.title}</div>
              </div>
            </div>

            <div className="mt-8 space-y-3 text-sm text-[var(--muted-foreground)]">
              <p className="max-w-md">Organize e gestione seus pedidos, tarefas e finanças.</p>
              <div className="flex flex-wrap gap-2">
                {['Pedidos', 'Compras', 'Vendas', 'Finanças', 'Clientes', 'Estoque'].map((x) => (
                  <span
                    key={x}
                    className="rounded-full border border-theme bg-[var(--surface)] px-3 py-1 text-xs text-[var(--foreground)]"
                  >
                    {x}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card do login */}
          <div className="mx-auto w-full max-w-md">
            <Card>
              <div>
                <h1 className="font-brand text-2xl font-semibold tracking-tight">{t.title}</h1>
              </div>

              <div className="mt-5">
                <LoginForm labels={t.labels} />
              </div>

              <div className="mt-5 flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted-foreground)]">
                  <span>{t.noAccount}</span>
                  <Link className="underline" href="/register">
                    {t.createUser}
                  </Link>
                </div>

                <div className="text-right">
                  <div className="text-xs text-[var(--muted-foreground)]">
                    <Link className="underline" href="/forgot-password">
                      {t.forgotPassword}
                    </Link>
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">v0.1</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
