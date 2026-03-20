'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { t } from './i18n'
import { useSettings } from './settings-context'
import { toastCreated, toastFailedToSave } from './toast'
import { api } from './api-client'

type Task = {
  id: string
  title: string
  status: 'TODO' | 'DOING' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  scheduledStartAt: string | null
  dueAt: string | null
}

// (moved to api-client.ts)


export default function TaskBoard() {
  const qc = useQueryClient()
  const { language } = useSettings()
  const i = t(language)
  const [title, setTitle] = useState('')

  const tasksQ = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api<{ tasks: Task[] }>('/api/tasks'),
  })

  const createM = useMutation({
    mutationFn: () =>
      api<{ task: Task }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }),
    onSuccess: async () => {
      toastCreated(i, 'task')
      setTitle('')
      await qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: any) => {
      toastFailedToSave(i, String(e?.message ?? ''))
    },
  })

  const events = useMemo(() => {
    const tasks = tasksQ.data?.tasks ?? []
    return tasks
      .filter((t) => t.scheduledStartAt || t.dueAt)
      .map((t) => ({
        id: t.id,
        title: t.title,
        start: t.scheduledStartAt ?? t.dueAt ?? undefined,
        end: undefined,
      }))
  }, [tasksQ.data])

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-4">
        <h1 className="text-lg font-semibold">Tarefas</h1>

        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            createM.mutate()
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nova tarefa…"
            className="w-full rounded-md border px-3 py-2"
          />
          <button
            className="btn btn-primary"
            disabled={!title.trim() || createM.isPending}
            type="submit"
          >
            Adicionar
          </button>
        </form>

        <div className="mt-4">
          {tasksQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : tasksQ.isError ? (
            <p className="text-sm text-red-600">Erro: {String(tasksQ.error)}</p>
          ) : (
            <ul className="space-y-2">
              {(tasksQ.data?.tasks ?? []).map((t) => (
                <li key={t.id} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.status} • {t.priority}
                        {t.dueAt ? ` • vence ${new Date(t.dueAt).toLocaleString()}` : ''}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-lg font-semibold">Calendário</h2>
        <div className="mt-3">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            height={650}
            events={events}
          />
        </div>
      </section>
    </div>
  )
}
