import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

import { prisma } from '@/lib/prisma'
import { buildOrdersCsvExport, buildOrdersPdfExport, fetchOrdersForExport } from '@/lib/orders-export'

export type ExportJobKindInput = 'csv' | 'pdf'

function getExportJobsBatchSize() {
  const raw = Number(process.env.EXPORT_JOB_BATCH_SIZE ?? 5)
  if (!Number.isFinite(raw) || raw <= 0) return 5
  return Math.min(20, Math.floor(raw))
}

function getExportJobsRetentionHours() {
  const raw = Number(process.env.EXPORT_JOB_RETENTION_HOURS ?? 24)
  if (!Number.isFinite(raw) || raw <= 0) return 24
  return Math.min(24 * 14, Math.floor(raw))
}

function exportsRoot() {
  return path.join(process.cwd(), 'state', 'export-jobs')
}

async function ensureExportsRoot() {
  await mkdir(exportsRoot(), { recursive: true })
}

function kindToPrisma(kind: ExportJobKindInput) {
  return kind === 'csv' ? 'SALES_ORDERS_CSV' : 'SALES_ORDERS_PDF'
}

function downloadFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-')
}

export async function enqueueOrdersExportJob(args: {
  workspaceId: string
  userId: string
  kind: ExportJobKindInput
  params: string
  currency?: string | null
}) {
  const job = await prisma.exportJob.create({
    data: {
      workspaceId: args.workspaceId,
      requestedById: args.userId,
      kind: kindToPrisma(args.kind),
      params: args.params,
      currency: args.currency ?? null,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      createdAt: true,
    },
  })

  return job
}

async function buildExportArtifact(job: {
  id: string
  workspaceId: string
  requestedById: string | null
  kind: 'SALES_ORDERS_CSV' | 'SALES_ORDERS_PDF'
  params: string | null
  currency: string | null
}) {
  const searchParams = new URLSearchParams(job.params ?? '')
  const data = await fetchOrdersForExport({
    workspaceId: job.workspaceId,
    userId: job.requestedById ?? '',
    params: searchParams,
  })

  if (job.kind === 'SALES_ORDERS_CSV') {
    return buildOrdersCsvExport(data.orders, data.truncated, data.maxRows)
  }

  return buildOrdersPdfExport(data.orders, data.truncated, data.maxRows, searchParams, job.currency)
}

export async function processExportJobs() {
  const now = new Date()
  const staleLockCutoff = new Date(now.getTime() - 1000 * 60 * 5)
  const jobs = await prisma.exportJob.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      availableAt: { lte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    take: getExportJobsBatchSize(),
  })

  await ensureExportsRoot()

  const result = {
    scanned: jobs.length,
    claimed: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  }

  for (const job of jobs) {
    const claim = await prisma.exportJob.updateMany({
      where: {
        id: job.id,
        status: job.status,
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleLockCutoff } }],
      },
      data: {
        status: 'PROCESSING',
        lockedAt: now,
        error: null,
      },
    })

    if (claim.count === 0) {
      result.skipped += 1
      continue
    }

    result.claimed += 1

    try {
      const artifact = await buildExportArtifact(job)
      const storageKey = `${job.id}-${crypto.randomBytes(8).toString('hex')}`
      const storagePath = path.join(exportsRoot(), storageKey)
      const bytes = typeof artifact.content === 'string' ? Buffer.from(artifact.content, 'utf-8') : artifact.content

      await writeFile(storagePath, bytes)

      await prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          lockedAt: null,
          completedAt: new Date(),
          fileName: downloadFileName(artifact.fileName),
          contentType: artifact.contentType,
          storageKey,
          rowCount: artifact.rowCount,
          truncated: artifact.truncated,
        },
        select: { id: true },
      })

      result.completed += 1
    } catch (err) {
      await prisma.exportJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lockedAt: null,
          completedAt: new Date(),
          error: String((err as any)?.message ?? err ?? 'UNKNOWN_ERROR').slice(0, 2000),
        },
        select: { id: true },
      })

      result.failed += 1
    }
  }

  return result
}

export async function readExportArtifact(storageKey: string) {
  const storagePath = path.join(exportsRoot(), storageKey)
  return readFile(storagePath)
}

export async function cleanupExpiredExportJobs() {
  const cutoff = new Date(Date.now() - getExportJobsRetentionHours() * 60 * 60 * 1000)
  const expired = await prisma.exportJob.findMany({
    where: {
      status: 'DONE',
      completedAt: { lt: cutoff },
      storageKey: { not: null },
    },
    select: { id: true, storageKey: true },
    take: 100,
  })

  let deletedFiles = 0
  for (const job of expired) {
    if (!job.storageKey) continue
    try {
      await unlink(path.join(exportsRoot(), job.storageKey))
      deletedFiles += 1
    } catch {}
  }

  const del = await prisma.exportJob.deleteMany({
    where: {
      id: { in: expired.map((job) => job.id) },
    },
  })

  return { deletedJobs: del.count, deletedFiles }
}
