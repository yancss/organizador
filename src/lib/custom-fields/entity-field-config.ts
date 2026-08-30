import { prisma } from '@/lib/prisma'

import { getNativeFields, type NativeField } from './native-fields'
import type { CustomFieldEntityKey } from './registry'

export type NativeFieldView = NativeField & {
  /** Rótulo efetivo (config do workspace ou o padrão). */
  label: string
  /** Rótulo configurado explicitamente (null = usando o padrão). */
  configuredLabel: string | null
  visible: boolean
  editable: boolean
  order: number
}

/**
 * Junta os campos nativos do objeto com a config de exibição/edição do workspace
 * (`EntityFieldConfig`). Campos não configurados usam os padrões.
 */
export async function getNativeFieldViews(
  workspaceId: string,
  entity: CustomFieldEntityKey,
): Promise<{ scalars: NativeFieldView[]; relations: NativeField[] }> {
  const native = getNativeFields(entity)

  const configs = await prisma.entityFieldConfig.findMany({
    where: { workspaceId, entity },
    select: { fieldName: true, label: true, visible: true, editable: true, order: true },
  })
  const byName = new Map(configs.map((c) => [c.fieldName, c]))

  const scalars = native.scalars.map((f, idx) => {
    const cfg = byName.get(f.name)
    // Nativos começam ocultos da tela do usuário: o admin escolhe o que expor.
    return {
      ...f,
      label: cfg?.label?.trim() || f.defaultLabel,
      configuredLabel: cfg?.label?.trim() || null,
      visible: cfg ? cfg.visible : false,
      editable: cfg ? cfg.editable && f.editableEligible : false,
      order: cfg?.order ?? idx,
    }
  })

  scalars.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
  return { scalars, relations: native.relations }
}
