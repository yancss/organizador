'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import RegisterForm, { type RegisterFormLabels } from './register-form'

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

export default function RegisterClient() {
  const [lang, setLang] = useState<Lang>('pt-BR')
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedLang = (localStorage.getItem(STORAGE_LANG) as Lang | null) ?? 'pt-BR'
    const rawTheme = localStorage.getItem(STORAGE_THEME)
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
        headline: 'Criar usuário',
        subline: 'Crie um usuário com email e senha para entrar.',
        already: 'Já tem conta?',
        login: 'Entrar',
        labels: {
          name: 'Nome',
          email: 'Email',
          birthDate: 'Data de nascimento (opcional)',
          password: 'Senha',
          password2: 'Confirmar senha',
          submit: 'Criar usuário',
          submitting: 'Criando…',
          passwordMismatch: 'As senhas não conferem.',
          success: 'Usuário criado. Você já pode entrar.',
        } satisfies RegisterFormLabels,
        theme: 'Tema',
        lang: 'Idioma',
        themeLight: 'Claro',
        themeDark: 'Escuro',
      },
      en: {
        title: 'Guardian',
        headline: 'Create user',
        subline: 'Create an account with email and password.',
        already: 'Already have an account?',
        login: 'Sign in',
        labels: {
          name: 'Name',
          email: 'Email',
          birthDate: 'Birth date (optional)',
          password: 'Password',
          password2: 'Confirm password',
          submit: 'Create user',
          submitting: 'Creating…',
          passwordMismatch: 'Passwords do not match.',
          success: 'User created. You can sign in now.',
        } satisfies RegisterFormLabels,
        theme: 'Theme',
        lang: 'Language',
        themeLight: 'Light',
        themeDark: 'Dark',
      },
      es: {
        title: 'Guardian',
        headline: 'Crear usuario',
        subline: 'Crea una cuenta con correo y contraseña.',
        already: '¿Ya tienes cuenta?',
        login: 'Entrar',
        labels: {
          name: 'Nombre',
          email: 'Correo',
          birthDate: 'Fecha de nacimiento (opcional)',
          password: 'Contraseña',
          password2: 'Confirmar contraseña',
          submit: 'Crear usuario',
          submitting: 'Creando…',
          passwordMismatch: 'Las contraseñas no coinciden.',
          success: 'Usuario creado. Ya puedes entrar.',
        } satisfies RegisterFormLabels,
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
          {/* Lado esquerdo: logo + texto */}
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
              <p className="max-w-md">{t.subline}</p>
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

          {/* Card do cadastro */}
          <div className="mx-auto w-full max-w-md">
            <Card>
              <div>
                <h1 className="font-brand text-2xl font-semibold tracking-tight">{t.headline}</h1>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{t.subline}</p>
              </div>

              <div className="mt-5">
                <RegisterForm labels={t.labels} />
              </div>

              <div className="mt-5 text-xs text-[var(--muted-foreground)]">
                {t.already}{' '}
                <Link className="underline" href="/login">
                  {t.login}
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
