export type AppLanguage = 'pt' | 'es' | 'en'

export type EntityKey =
  | 'order'
  | 'purchaseOrder'
  | 'invite'
  | 'user'
  | 'role'
  | 'security'
  | 'generic'

function lang3(language: string): AppLanguage {
  return language === 'pt' || language === 'es' ? language : 'en'
}

function entityLabel(entity: EntityKey, language: AppLanguage) {
  const pt: Record<EntityKey, string> = {
    order: 'Pedido',
    purchaseOrder: 'Pedido de compra',
    invite: 'Convite',
    user: 'Usuário',
    role: 'Perfil',
    security: 'Segurança',
    generic: 'Registro',
  }

  const es: Record<EntityKey, string> = {
    order: 'Pedido',
    purchaseOrder: 'Pedido de compra',
    invite: 'Invitación',
    user: 'Usuario',
    role: 'Rol',
    security: 'Seguridad',
    generic: 'Registro',
  }

  const en: Record<EntityKey, string> = {
    order: 'Order',
    purchaseOrder: 'Purchase order',
    invite: 'Invite',
    user: 'User',
    role: 'Role',
    security: 'Security',
    generic: 'Record',
  }

  if (language === 'pt') return pt[entity]
  if (language === 'es') return es[entity]
  return en[entity]
}

export function msgCreated(entity: EntityKey, language: string) {
  const l = lang3(language)
  const e = entityLabel(entity, l)
  if (l === 'pt') return `${e} criado.`
  if (l === 'es') return `${e} creado.`
  return `${e} created.`
}

export function msgUpdated(entity: EntityKey, language: string) {
  const l = lang3(language)
  const e = entityLabel(entity, l)
  if (l === 'pt') return `${e} atualizado.`
  if (l === 'es') return `${e} actualizado.`
  return `${e} updated.`
}

export function msgDeleted(entity: EntityKey, language: string) {
  const l = lang3(language)
  const e = entityLabel(entity, l)
  if (l === 'pt') return `${e} excluído.`
  if (l === 'es') return `${e} eliminado.`
  return `${e} deleted.`
}

export function msgFailedToSave(language: string) {
  const l = lang3(language)
  if (l === 'pt') return 'Falha ao salvar.'
  if (l === 'es') return 'Error al guardar.'
  return 'Failed to save.'
}

export function msgFailedToDelete(language: string) {
  const l = lang3(language)
  if (l === 'pt') return 'Falha ao excluir.'
  if (l === 'es') return 'Error al eliminar.'
  return 'Failed to delete.'
}

export function msgAlreadyExistsEmail(language: string) {
  const l = lang3(language)
  if (l === 'pt') return 'Já existe um usuário com esse e-mail.'
  if (l === 'es') return 'Ya existe un usuario con ese email.'
  return 'A user with this email already exists.'
}
