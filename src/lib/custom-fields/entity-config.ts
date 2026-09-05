import { prisma } from '@/lib/prisma'

import { getCustomFieldEntity } from './registry'

export type EntityDisplay = {
  /** Rótulo efetivo no idioma pedido (override do workspace ou o padrão do registry). */
  label: string
  /** Rótulo configurado explicitamente (null = usando o padrão). */
  configuredLabel: string | null
  description: string | null
}

function registryLabel(entity: string, language: string): string {
  const def = getCustomFieldEntity(entity)
  if (!def) return entity
  return language === 'pt' ? def.labels.pt : language === 'es' ? def.labels.es : def.labels.en
}

/** Config de exibição de um objeto (nome + descrição) mesclada com o padrão do registry. */
export async function getEntityDisplay(workspaceId: string, entity: string, language = 'pt'): Promise<EntityDisplay> {
  const cfg = await prisma.entityConfig.findUnique({
    where: { workspaceId_entity: { workspaceId, entity } },
    select: { label: true, description: true },
  })
  const configuredLabel = cfg?.label?.trim() || null
  return {
    label: configuredLabel ?? registryLabel(entity, language),
    configuredLabel,
    description: cfg?.description?.trim() || null,
  }
}

/** Mapa entity -> config, para listagens. */
export async function getEntityDisplayMap(workspaceId: string): Promise<Map<string, { label: string | null; description: string | null }>> {
  const rows = await prisma.entityConfig.findMany({
    where: { workspaceId },
    select: { entity: true, label: true, description: true },
  })
  return new Map(rows.map((r) => [r.entity, { label: r.label?.trim() || null, description: r.description?.trim() || null }]))
}
