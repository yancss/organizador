-- CreateTable
CREATE TABLE "AuditEventChange" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "from" JSONB,
    "to" JSONB,

    CONSTRAINT "AuditEventChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEventChange_eventId_idx" ON "AuditEventChange"("eventId");

-- CreateIndex
CREATE INDEX "AuditEventChange_eventId_field_idx" ON "AuditEventChange"("eventId", "field");

-- AddForeignKey
ALTER TABLE "AuditEventChange" ADD CONSTRAINT "AuditEventChange_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AuditEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropColumn
ALTER TABLE "AuditEvent" DROP COLUMN "changes";
