'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import esLocale from '@fullcalendar/core/locales/es'
import enGbLocale from '@fullcalendar/core/locales/en-gb'

import { t } from './i18n'
import { useSettings, type AppLanguage } from './settings-context'

type EventItem = {
  id: string
  title: string
  notes: string | null
  startAt: string | null
  endAt: string | null
  allDay: boolean
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInputValue(v: string): string | null {
  if (!v.trim()) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

type ViewMode = 'list' | 'calendar'

type Draft = {
  id?: string
  title: string
  notes: string
  startAt: string // datetime-local
  endAt: string // datetime-local
  allDay: boolean
}

function emptyDraft(): Draft {
  return { title: '', notes: '', startAt: '', endAt: '', allDay: false }
}

function calendarLocale(language: AppLanguage) {
  if (language === 'pt') return ptBrLocale
  if (language === 'es') return esLocale
  return enGbLocale
}

export default function EventBoard() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)

  const [view, setView] = useState<ViewMode>('list')
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft())

  const eventsQ = useQuery({
    queryKey: ['events'],
    queryFn: () => api<{ events: EventItem[] }>('/api/events'),
  })

  const createM = useMutation({
    mutationFn: (payload: Omit<EventItem, 'id'>) =>
      api<{ event: EventItem }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const updateM = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<EventItem, 'id'>> }) =>
      api<{ event: EventItem }>(`/api/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const deleteM = useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['events'] })
    },
  })

  const { listWithDate, listNoDate } = useMemo(() => {
    const items = eventsQ.data?.events ?? []

    const withDate = items.filter((e) => e.startAt || e.endAt)
    const noDate = items.filter((e) => !e.startAt && !e.endAt)

    withDate.sort((a, b) => {
      const ad = a.startAt ?? a.endAt ?? ''
      const bd = b.startAt ?? b.endAt ?? ''
      return ad.localeCompare(bd)
    })

    noDate.sort((a, b) => a.title.localeCompare(b.title))

    return { listWithDate: withDate, listNoDate: noDate }
  }, [eventsQ.data])

  const calendarEvents = useMemo(() => {
    const items = eventsQ.data?.events ?? []
    return items
      .filter((e) => e.startAt || e.endAt)
      .map((e) => ({
        id: e.id,
        title: e.title,
        start: e.startAt ?? e.endAt ?? undefined,
        end: e.endAt ?? undefined,
        allDay: e.allDay,
      }))
  }, [eventsQ.data])

  function openCreate() {
    setDraft(emptyDraft())
    setIsOpen(true)
  }

  function openEdit(e: EventItem) {
    setDraft({
      id: e.id,
      title: e.title,
      notes: e.notes ?? '',
      startAt: toLocalInputValue(e.startAt),
      endAt: toLocalInputValue(e.endAt),
      allDay: e.allDay,
    })
    setIsOpen(true)
  }

  async function save() {
    const title = draft.title.trim()
    if (!title) return

    const payload = {
      title,
      notes: draft.notes.trim() ? draft.notes : null,
      startAt: fromLocalInputValue(draft.startAt),
      endAt: fromLocalInputValue(draft.endAt),
      allDay: draft.allDay,
    }

    if (draft.id) {
      await updateM.mutateAsync({ id: draft.id, payload })
    } else {
      await createM.mutateAsync(payload)
    }

    setIsOpen(false)
    setDraft(emptyDraft())
  }

  async function remove() {
    if (!draft.id) return
    if (!confirm(i.modal.deleteConfirm)) return
    await deleteM.mutateAsync(draft.id)
    setIsOpen(false)
    setDraft(emptyDraft())
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{i.board.title}</h1>
          <p className="text-sm text-neutral-600">{i.board.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="surface rounded-lg border border-theme p-1">
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${view === 'list' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--text-muted)] hover:bg-[var(--muted)]'}`}
              onClick={() => setView('list')}
              type="button"
            >
              {i.board.viewList}
            </button>
            <button
              className={`rounded-md px-3 py-1.5 text-sm ${view === 'calendar' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'text-[var(--text-muted)] hover:bg-[var(--muted)]'}`}
              onClick={() => setView('calendar')}
              type="button"
            >
              {i.board.viewCalendar}
            </button>
          </div>

          <button
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90"
            onClick={openCreate}
            type="button"
          >
            {i.board.new}
          </button>
        </div>
      </header>

      {eventsQ.isLoading ? (
        <p className="text-sm text-neutral-600">Carregando…</p>
      ) : eventsQ.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Erro ao carregar: {String(eventsQ.error)}
        </div>
      ) : view === 'list' ? (
        <section className="surface rounded-xl border border-theme">
          <div className="divide-y">
            {listWithDate.length === 0 && listNoDate.length === 0 ? (
              <div className="p-6 text-sm text-neutral-700">{i.board.empty}</div>
            ) : (
              <>
                {listWithDate.length ? (
                  <ul>
                    {listWithDate.map((e) => (
                      <li key={e.id} className="p-4 hover:bg-[var(--muted)]">
                        <button type="button" onClick={() => openEdit(e)} className="w-full text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-neutral-900">{e.title}</div>
                              {e.notes ? (
                                <div className="mt-1 line-clamp-2 text-sm text-neutral-700">{e.notes}</div>
                              ) : null}
                              <div className="mt-2 text-xs text-neutral-700">
                                {e.startAt ? new Date(e.startAt).toLocaleString() : i.board.noDateSection}
                                {e.endAt ? ` → ${new Date(e.endAt).toLocaleString()}` : ''}
                              </div>
                            </div>
                            <div className="text-xs text-neutral-600">{i.board.editHint}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="border-t border-theme bg-[var(--surface-2)] px-4 py-2 text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  {i.board.noDateSection}
                </div>

                <ul>
                  {listNoDate.length === 0 ? (
                    <li className="p-4 text-sm text-neutral-700">{i.board.noDateEmpty}</li>
                  ) : (
                    listNoDate.map((e) => (
                      <li key={e.id} className="p-4 hover:bg-[var(--muted)]">
                        <button type="button" onClick={() => openEdit(e)} className="w-full text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium text-neutral-900">{e.title}</div>
                              {e.notes ? (
                                <div className="mt-1 line-clamp-2 text-sm text-neutral-700">{e.notes}</div>
                              ) : null}
                              <div className="mt-2 text-xs text-neutral-700">{i.board.noDateSection}</div>
                            </div>
                            <div className="text-xs text-neutral-600">{i.board.editHint}</div>
                          </div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="surface rounded-xl border border-theme p-3 sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            locale={calendarLocale(language)}
            buttonText={{
              today: i.calendar.today,
              month: i.calendar.month,
              week: i.calendar.week,
              day: i.calendar.day,
              list: i.calendar.list,
            }}
            initialView="dayGridMonth"
            height={700}
            events={calendarEvents}
            eventClick={(info) => {
              const found = (eventsQ.data?.events ?? []).find((e) => e.id === info.event.id)
              if (found) openEdit(found)
            }}
          />
        </section>
      )}

      {isOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="surface absolute bottom-0 left-0 right-0 mx-auto w-full max-w-2xl rounded-t-2xl border border-theme p-5 shadow-xl sm:bottom-auto sm:top-20 sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {draft.id ? i.modal.editTitle : i.modal.newTitle}
                </h2>
                <p className="text-sm text-neutral-700">{i.modal.subtitle}</p>
              </div>
              <button
                aria-label="Fechar"
                className="grid size-9 place-items-center rounded-md text-lg text-neutral-800 hover:bg-neutral-100"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.modal.titleLabel}</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder={
                    language === 'pt'
                      ? 'Ex.: Consulta, reunião, ideia…'
                      : language === 'es'
                        ? 'Ej.: Cita, reunión, idea…'
                        : 'E.g.: Appointment, meeting, idea…'
                  }
                  className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-neutral-700">{i.modal.notesLabel}</span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder={i.modal.optional}
                  className="min-h-24 w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-700">{i.modal.startLabel}</span>
                  <input
                    type="datetime-local"
                    value={draft.startAt}
                    onChange={(e) => setDraft((d) => ({ ...d, startAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-neutral-700">{i.modal.endLabel}</span>
                  <input
                    type="datetime-local"
                    value={draft.endAt}
                    onChange={(e) => setDraft((d) => ({ ...d, endAt: e.target.value }))}
                    className="w-full rounded-lg border border-theme bg-transparent px-3 py-2"
                  />
                </label>
              </div>

              <label className="mt-1 flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={draft.allDay}
                  onChange={(e) => setDraft((d) => ({ ...d, allDay: e.target.checked }))}
                />
                {i.modal.allDay}
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)] disabled:opacity-50"
                onClick={remove}
                type="button"
                disabled={!draft.id || deleteM.isPending}
              >
                {i.modal.delete}
              </button>

              <div className="flex gap-2">
                <button
                  className="rounded-lg border border-theme px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {i.modal.cancel}
                </button>
                <button
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
                  onClick={save}
                  type="button"
                  disabled={!draft.title.trim() || createM.isPending || updateM.isPending}
                >
                  {i.modal.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
