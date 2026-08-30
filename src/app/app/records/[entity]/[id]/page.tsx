'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/app/app/api-client'
import { useSettings } from '@/app/app/settings-context'
import { EntityFieldsSection } from '@/app/app/entity-fields-section'
import { AuditHistory } from '@/app/app/audit-history'

type Labels = { pt: string; es: string; en: string }
type Resp = {
  record: { id: string; title: string; subtitle: string | null } | null
  entity: { key: string; labels: Labels }
}

// entity key -> nome do model no AuditHistory (PascalCase)
function auditType(entityKey: string) {
  return entityKey
    .toLowerCase()
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

export default function GenericRecordFieldsPage() {
  const params = useParams<{ entity: string; id: string }>()
  const router = useRouter()
  const entity = (params?.entity ?? '').toUpperCase()
  const id = params?.id ?? ''
  const { language } = useSettings()

  const q = useQuery({
    queryKey: ['record-fields-meta', entity, id],
    enabled: !!entity && !!id,
    queryFn: () => api<Resp>(`/api/entity-fields?entity=${entity}&entityId=${id}`),
  })

  const label = q.data ? (language === 'pt' ? q.data.entity.labels.pt : language === 'es' ? q.data.entity.labels.es : q.data.entity.labels.en) : entity
  const back = language === 'pt' ? 'Voltar' : language === 'es' ? 'Volver' : 'Back'

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-theme bg-[var(--surface-2)] px-5 py-5 shadow-[var(--shadow-sm)]">
        <button className="text-sm underline text-[var(--muted-foreground)]" onClick={() => router.back()}>
          {back}
        </button>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          {label}
          {q.data?.record ? ` · ${q.data.record.title}` : ''}
        </h1>
        {q.data?.record?.subtitle ? <p className="text-sm text-[var(--muted-foreground)]">{q.data.record.subtitle}</p> : null}
      </header>

      {q.isError ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
          {language === 'pt' ? 'Objeto inválido ou registro não encontrado.' : 'Invalid object or record not found.'}
        </div>
      ) : (
        <>
          <EntityFieldsSection entity={entity} entityId={id} />
          <AuditHistory entityType={auditType(entity)} entityId={id} />
        </>
      )}
    </div>
  )
}
