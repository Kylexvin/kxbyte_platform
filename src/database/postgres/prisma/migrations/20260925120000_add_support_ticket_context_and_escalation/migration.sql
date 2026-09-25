-- SupportTicket: add generic context, assignment, escalation, and
-- resolution columns. All nullable. No data migration required.

ALTER TABLE "support_tickets"
  ADD COLUMN "contextId"      TEXT,
  ADD COLUMN "contextType"    TEXT,
  ADD COLUMN "assigneeId"     TEXT,
  ADD COLUMN "escalatedAt"    TIMESTAMP(3),
  ADD COLUMN "escalatedById"  TEXT,
  ADD COLUMN "escalatedToId"  TEXT,
  ADD COLUMN "escalatedToType" TEXT,
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "resolvedById"   TEXT;

-- FK for assignee (nullable, SET NULL on user delete)
ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for common scoped queries
CREATE INDEX "support_tickets_assigneeId_idx"  ON "support_tickets"("assigneeId");
CREATE INDEX "support_tickets_contextId_idx"   ON "support_tickets"("contextId");
CREATE INDEX "support_tickets_contextType_idx" ON "support_tickets"("contextType");