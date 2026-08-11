#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const root = resolve('.');
const workspace = mkdtempSync(join(tmpdir(), 'domain-email-migrations-'));
const persistence = join(workspace, 'state');
const migrations = join(workspace, 'migrations');
const config = join(workspace, 'wrangler.jsonc');
mkdirSync(migrations, { recursive: true });
writeFileSync(join(workspace, 'worker.js'), 'export default { fetch() { return new Response("ok"); } };\n');
writeFileSync(config, JSON.stringify({
  name: 'domain-inbox-migration-test',
  main: './worker.js',
  compatibility_date: '2026-05-01',
  d1_databases: [{ binding: 'INBOX_DB', database_name: 'inbox-db', database_id: 'local-test' }],
}, null, 2));

function addMigration(name: string): void {
  copyFileSync(join(root, 'migrations', name), join(migrations, basename(name)));
}
function wrangler(args: string[]): string {
  return execFileSync('npx', ['wrangler', ...args, '--config', config, '--local', '--persist-to', persistence], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024,
  });
}
function query(sql: string): Array<Record<string, unknown>> {
  const output = wrangler(['d1', 'execute', 'inbox-db', '--command', sql, '--json']);
  const start = output.indexOf('[');
  if (start < 0) throw new Error('Wrangler did not return JSON');
  return (JSON.parse(output.slice(start)) as Array<{ results?: Array<Record<string, unknown>> }>)[0]?.results || [];
}
function apply(): void {
  wrangler(['d1', 'migrations', 'apply', 'inbox-db']);
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

try {
  for (const name of ['0001_create_tables.sql', '0002_add_deleted_at.sql', '0003_fts_search.sql', '0004_rate_limit_index.sql']) addMigration(name);
  apply();
  query(`INSERT INTO emails
    (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key, created_at)
    VALUES ('legacy-active', 'example.com', 'redacted', 'redacted', 'legacy', '', '',
      '2025-01-01T00:00:00.000Z', 'raw/legacy-active.eml', '2025-01-01T00:00:00.000Z')`);

  addMigration('0005_hardening_storage.sql');
  apply();
  query(`INSERT INTO cleanup_outbox (id, object_key, object_kind, email_id)
    VALUES ('legacy-cleanup', 'raw/deleted.eml', 'raw', 'deleted')`);

  addMigration('0006_activation_cleanup_coordination.sql');
  apply();

  addMigration('0007_reply_threading.sql');
  apply();

  const columns = query('PRAGMA table_info(emails)');
  const names = new Set(columns.map(column => String(column.name)));
  for (const required of [
    'deleted_at', 'ingest_key', 'storage_state', 'raw_size', 'attachment_count',
    'attachment_total_size', 'activation_seq', 'storage_generation',
    'direction', 'message_id', 'in_reply_to', 'references_text',
  ]) assert(names.has(required), `missing migrated emails column: ${required}`);

  const tables = query("SELECT name FROM sqlite_master WHERE type='table'");
  for (const required of ['cleanup_outbox', 'ingestion_registry', 'email_activation_events']) {
    assert(tables.some(table => table.name === required), `${required} table missing`);
  }
  const indexes = query("SELECT name FROM sqlite_master WHERE type='index'");
  for (const required of [
    'idx_emails_active_date_id', 'idx_emails_deleted_cursor',
    'idx_emails_activation_seq', 'idx_ingestion_registry_cleanup',
    'idx_emails_direction_date',
  ]) assert(indexes.some(index => index.name === required), `missing keyset/coordination index: ${required}`);

  const legacyDir = query("SELECT direction FROM emails WHERE id = 'legacy-active'")[0];
  assert(legacyDir?.direction === 'in', 'legacy email missing default inbound direction');
  query(`INSERT INTO emails
    (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key,
     created_at, direction, message_id, in_reply_to, references_text)
    VALUES ('sent-1', 'example.com', 'me@example.com', 'them@example.net', 'Re: hi', 'hi', '',
      '2026-01-01', NULL, '2026-01-01T00:00:00.000Z', 'out', '<m@example.com>', 'orig', '<a>')`);
  const sentRow = query("SELECT direction, message_id FROM emails WHERE id = 'sent-1'")[0];
  assert(sentRow?.direction === 'out' && sentRow?.message_id === '<m@example.com>',
    'sent reply threading metadata not persisted');

  const legacy = query(`SELECT e.activation_seq, e.storage_generation, r.state
    FROM emails e JOIN ingestion_registry r ON r.email_id = e.id WHERE e.id = 'legacy-active'`)[0];
  assert(Number(legacy?.activation_seq) > 0, 'legacy active email did not receive activation sequence');
  assert(legacy?.state === 'active', 'legacy active email did not receive active registry state');
  const stagedCleanup = query(`SELECT state FROM ingestion_registry WHERE email_id = 'deleted'`)[0];
  assert(stagedCleanup?.state === 'cleanup_pending', 'legacy cleanup outbox was not coordinated');

  // Reproduce the former late-activation gap: slow is created first, fast becomes
  // visible first, then slow must still sort after the observed activation cursor.
  query(`INSERT INTO ingestion_registry (ingest_key, email_id, state) VALUES
      ('slow', 'slow', 'pending'), ('fast', 'fast', 'pending');
    INSERT INTO emails
      (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key,
       created_at, ingest_key, storage_state, storage_generation)
    VALUES
      ('slow', 'example.com', 'redacted', 'redacted', 'slow', '', '', '2025-01-01',
       'raw/slow.eml', '2025-01-01T00:00:00.000Z', 'slow', 'pending', 1),
      ('fast', 'example.com', 'redacted', 'redacted', 'fast', '', '', '2026-01-01',
       'raw/fast.eml', '2026-01-01T00:00:00.000Z', 'fast', 'pending', 1);
    INSERT INTO email_activation_events (email_id, storage_generation) VALUES ('fast', 1);
    UPDATE emails SET storage_state = 'active', activation_seq =
      (SELECT seq FROM email_activation_events WHERE email_id = 'fast' AND storage_generation = 1)
      WHERE id = 'fast';`);
  const watermark = Number(query("SELECT activation_seq FROM emails WHERE id = 'fast'")[0]?.activation_seq);
  query(`INSERT INTO email_activation_events (email_id, storage_generation) VALUES ('slow', 1);
    UPDATE emails SET storage_state = 'active', activation_seq =
      (SELECT seq FROM email_activation_events WHERE email_id = 'slow' AND storage_generation = 1)
      WHERE id = 'slow';`);
  const late = query(`SELECT id FROM emails WHERE storage_state = 'active'
    AND (activation_seq > ${watermark} OR (activation_seq = ${watermark} AND id > 'fast'))
    ORDER BY activation_seq, id`);
  assert(late.length === 1 && late[0].id === 'slow', 'late activation fell behind polling cursor');

  // Claimed cleanup blocks ingestion. Pending cleanup is cancellable; completed
  // cleanup advances generation before deterministic new keys are selected.
  query(`INSERT INTO ingestion_registry
    (ingest_key, email_id, storage_generation, state, claim_token, claim_expires_at)
    VALUES ('race', 'race', 1, 'cleanup_claimed', 'owner', datetime('now', '+5 minutes'))`);
  query(`UPDATE ingestion_registry SET
      storage_generation = storage_generation + CASE WHEN state = 'cleaned' THEN 1 ELSE 0 END,
      state = 'pending' WHERE ingest_key = 'race' AND state IN ('cleanup_pending', 'cleaned')`);
  assert(query("SELECT state FROM ingestion_registry WHERE ingest_key = 'race'")[0]?.state === 'cleanup_claimed',
    'claimed cleanup was incorrectly cancelled by ingestion');
  query("UPDATE ingestion_registry SET state = 'cleaned', claim_token = NULL WHERE ingest_key = 'race'");
  query(`UPDATE ingestion_registry SET
      storage_generation = storage_generation + CASE WHEN state = 'cleaned' THEN 1 ELSE 0 END,
      state = 'pending' WHERE ingest_key = 'race' AND state IN ('cleanup_pending', 'cleaned')`);
  const generation = query("SELECT state, storage_generation FROM ingestion_registry WHERE ingest_key = 'race'")[0];
  assert(generation?.state === 'pending' && Number(generation.storage_generation) === 2,
    're-ingestion did not advance generation after claimed cleanup');

  console.log('All migrations and old-data/activation/cleanup behaviors passed in an isolated local D1 database.');
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
