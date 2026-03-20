import { toast } from 'sonner'

import type { I18n } from './i18n'

export { toast }

export function toastSuccess(message: string) {
  toast.success(message)
}

export function toastError(message: string) {
  toast.error(message)
}

export type ToastEntity = keyof I18n['toast']['entities']

// Back-compat alias (older code used toast... and also imported toast itself)
// No-op: kept intentionally.

function fmt(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
}

export function toastCreated(i: I18n, entity: ToastEntity) {
  toast.success(fmt(i.toast.created, { entity: i.toast.entities[entity] }))
}

export function toastUpdated(i: I18n, entity: ToastEntity) {
  toast.success(fmt(i.toast.updated, { entity: i.toast.entities[entity] }))
}

export function toastDeleted(i: I18n, entity: ToastEntity) {
  toast.success(fmt(i.toast.deleted, { entity: i.toast.entities[entity] }))
}

export function toastFailedToSave(i: I18n, details?: string) {
  toast.error(i.toast.failedToSave + (details ? ` ${details}` : ''))
}

export function toastFailedToDelete(i: I18n, details?: string) {
  toast.error(i.toast.failedToDelete + (details ? ` ${details}` : ''))
}

export function toastAlreadyExistsEmail(i: I18n) {
  toast.error(i.toast.alreadyExistsEmail)
}
