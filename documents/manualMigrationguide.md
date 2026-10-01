Schema Migration Playbook
Save this somewhere. Every schema change follows the same 5 steps. No exceptions.

Step 1 — Edit schema.prisma and validate
Modify src/database/postgres/prisma/schema.prisma:

Add the new model

Add any new relations on existing models (e.g. User needs a back-relation)

Use explicit @relation("Name") when a model has two or more relations to the same target

Validate:

bash
npx prisma generate
If it succeeds: client regenerated, schema is valid. Move to Step 2.

If it fails: fix the reported error (usually a missing back-relation, an ambiguous relation, or a typo). Don't proceed with a broken schema.

Step 2 — Create the migration folder
Pick a timestamp that sorts after your newest migration in src/database/postgres/prisma/migrations/. Format is YYYYMMDDHHMMSS_description.

Check the newest first:

bash
dir src\database\postgres\prisma\migrations
Then create:

text
src/database/postgres/prisma/migrations/<timestamp>_<snake_case_description>/migration.sql
Example: if the newest is 20260925120000_add_support_ticket_context_and_escalation, and today is Sep 26, use 20260926030000_add_support_guides.

The folder name and the migration_name you'll use in Step 5 must match exactly.

Step 3 — Write the migration SQL
The SQL must match what Prisma expects from the schema. Not "what would work" — what Prisma would generate.

Rules:

Table names come from @@map("...") or default to model name if no map. Check both.

Nullable columns → TEXT (or appropriate type) without NOT NULL

Non-nullable columns without defaults → TEXT NOT NULL

Non-nullable with defaults → TEXT NOT NULL DEFAULT ...

DateTime → TIMESTAMP(3)

Boolean → BOOLEAN

Indexes from @@index([...]) → CREATE INDEX "<table>_<col>_idx" ON "<table>"("<col>");

Unique fields (@unique) → CREATE UNIQUE INDEX or ADD CONSTRAINT ... UNIQUE

Foreign keys → ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... REFERENCES ...

updatedAt never has a DB-level default. Prisma writes it in code.

Be careful with ON DELETE. Prisma's default is Restrict (which emits ON DELETE RESTRICT). If the schema says onDelete: Cascade or onDelete: SetNull, match it.

Use CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, and DO $$ ... IF NOT EXISTS ... $$ guards around FKs and constraints so re-running is safe.

Step 4 — Write the apply script
Create scripts/apply-<description>.js. Example structure:

js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();

  // 1. CREATE TABLE / ALTER TABLE statements
  // 2. Index statements
  // 3. FK constraints (wrapped in DO $$ IF NOT EXISTS $$)

  // 4. Verify: query information_schema to confirm what changed
  const check = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = '<table>'
    ORDER BY ordinal_position
  `);
  console.log('APPLIED. Columns:');
  console.table(check.rows);
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}
Why this exists: mark-*.js only records that the migration is done in Prisma's bookkeeping. It does not run the SQL. This script actually changes the database.

The verify step at the bottom is essential — it proves the change landed. If it prints the wrong schema, you have a bug.

Step 5 — Write the mark script
Create scripts/mark-<description>.js:

js
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const c = new Client({
  connectionString: process.env.DIRECT_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await c.connect();
  await c.query(
    `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
     VALUES (
       gen_random_uuid()::text,
       'manual',
       '<timestamp>_<snake_case_description>',
       NOW(),
       NOW(),
       1
     )`
  );
  console.log('marked');
} catch (err) {
  console.error('FAIL:', err.message);
} finally {
  await c.end();
}
The migration_name must match the folder name from Step 2.

Why this exists: Prisma keeps its own record of what has been migrated. Since we hand-write migrations, we have to tell Prisma "this folder's migration has been applied." Otherwise npx prisma migrate status complains that migrations are pending, and future tooling breaks.

Step 6 — Run in order
bash
node scripts/apply-<description>.js
node scripts/mark-<description>.js
Expected output:

apply: APPLIED. Columns: + a table showing the new schema

mark: marked

If apply prints FAIL:, the SQL is wrong. Fix the migration file and the apply script, delete the mark (see below), and retry.

If mark prints FAIL: duplicate key value violates unique constraint, this migration was already marked. Safe to ignore, or delete the row first (see below).

Step 7 — Verify
bash
npx prisma migrate status
Expected: Database schema is up to date!

If it says migrations are pending, the folder name or the migration_name in the mark script doesn't match. Compare them character by character.

If it complains about drift, run:

bash
node scripts/<checksum-fix>.js   # see the earlier session for the fix script
Only needed if Prisma detects a checksum mismatch. Rare.

Cleanup commands (for when things go wrong)
Delete a mark (so you can re-run apply/mark):

sql
DELETE FROM _prisma_migrations
WHERE migration_name = '<timestamp>_<description>';
Roll back a migration (undo the schema change):

sql
DROP TABLE IF EXISTS "<table>" CASCADE;
-- or
ALTER TABLE "<table>" DROP COLUMN IF EXISTS "<column>";
Then delete the mark and the migration folder, edit the schema, and restart from Step 1.

Common failure modes
Symptom	Cause	Fix
npx prisma generate errors with "Field X already defined"	Duplicate field on a model	Delete the duplicate
generate errors with "ambiguous relation"	Two relations to the same model without @relation("Name")	Add explicit relation names on both sides
apply prints FAIL: syntax error	Bad SQL, missing comma, wrong type name	Fix the SQL, re-run apply (idempotent guards make retry safe)
mark prints "duplicate key"	Migration already marked	Ignore, or DELETE FROM _prisma_migrations WHERE migration_name = '...'
migrate status says pending	Folder name ≠ mark's migration_name	Fix the mismatch
Column exists in DB but Prisma can't see it	Prisma client not regenerated	npx prisma generate
Quick mental model
text
schema.prisma  ──▶  npx prisma generate  ──▶  Prisma client updated
                                              (knows about new fields)

migration.sql  ──▶  apply-*.js           ──▶  DB updated
                                              (has the new columns/table)

mark-*.js                                ──▶  Prisma bookkeeping updated
                                              (thinks migration is done)
All three must succeed. Generate + apply + mark. Miss any one and something is out of sync.

