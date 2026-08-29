import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import {
  DEFAULT_SALES_QUOTE_SETTINGS,
  SALES_QUOTE_SETTINGS_KEY,
  coerceSalesQuoteSettings,
} from '@/lib/sales/sales-quote-settings'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: wsId, key: SALES_QUOTE_SETTINGS_KEY } },
    select: { value: true, updatedAt: true },
  })

  const settings = coerceSalesQuoteSettings(row?.value)
  const d = DEFAULT_SALES_QUOTE_SETTINGS
  const isCustom =
    row != null &&
    (settings.defaultValidityDays !== d.defaultValidityDays ||
      settings.allowApproveFromDraft !== d.allowApproveFromDraft ||
      settings.convertedOrderStatus !== d.convertedOrderStatus ||
      settings.autoExpire !== d.autoExpire ||
      settings.reminderDaysBefore !== d.reminderDaysBefore)

  return Response.json({
    settings,
    defaults: DEFAULT_SALES_QUOTE_SETTINGS,
    isCustom,
    updatedAt: row?.updatedAt ?? null,
  })
}

const PatchSchema = z
  .object({
    defaultValidityDays: z.coerce.number().int().min(0).max(3650),
    allowApproveFromDraft: z.coerce.boolean(),
    convertedOrderStatus: z.enum(['DRAFT', 'CONFIRMED']),
    autoExpire: z.coerce.boolean(),
    reminderDaysBefore: z.coerce.number().int().min(0).max(365),
  })
  .partial()

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const before = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: wsId, key: SALES_QUOTE_SETTINGS_KEY } },
    select: { value: true },
  })

  // Sempre grava o objeto completo (merge do atual com o que veio no PATCH).
  const nextValue = coerceSalesQuoteSettings({ ...coerceSalesQuoteSettings(before?.value), ...parsed.data })

  await prisma.workspaceSetting.upsert({
    where: { workspaceId_key: { workspaceId: wsId, key: SALES_QUOTE_SETTINGS_KEY } },
    update: { value: nextValue, updatedById: auth.user.id },
    create: { workspaceId: wsId, key: SALES_QUOTE_SETTINGS_KEY, value: nextValue, updatedById: auth.user.id },
    select: { key: true },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'WorkspaceSetting',
      entityId: SALES_QUOTE_SETTINGS_KEY,
      summary: 'UPDATE sales quote settings',
      changes: {
        create: [
          {
            field: 'sales.quote',
            from: (before?.value as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            to: nextValue as Prisma.InputJsonValue,
          },
        ],
      },
    },
    select: { id: true },
  })

  return Response.json({ ok: true, settings: coerceSalesQuoteSettings(nextValue) })
}
