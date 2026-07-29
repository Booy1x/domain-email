#!/usr/bin/env tsx

/**
 * Read-only production D1 backup. This script never mutates D1 or R2.
 * It supports both the pre-hardening schema and the complete format-3 schema.
 * Usage: npx tsx scripts/backup-prod.ts [--output=path]
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DB_NAME = 'inbox-db';
const COORDINATION_TABLES = ['cleanup_outbox', 'ingestion_registry', 'email_activation_events'] as const;
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const backupFile = resolve(outputArg?.slice('--output='.length) || 'raw/prod-backup.json');
type Row = Record<string, unknown>;

function query(sql: string): Row[] {
  const output = execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME, '--remote', '--command', sql, '--json',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const parsed = JSON.parse(output) as Array<{ results?: Row[] }>;
  return parsed[0]?.results || [];
}

function normalizeLegacy(emails: Row[], attachments: Row[]) {
  const stats = new Map<string, { count: number; size: number }>();
  const normalizedAttachments = attachments.map(row => {
    const emailId = String(row.email_id);
    const current = stats.get(emailId) || { count: 0, size: 0 };
    current.count++;
    current.size += Number(row.size || 0);
    stats.set(emailId, current);
    return { ...row, storage_state: 'active', storage_generation: 1 };
  });
  const normalizedEmails = emails.map((row, index) => {
    const id = String(row.id);
    const bodyText = String(row.body_text || '');
    const bodyHtml = String(row.body_html || '');
    const attachment = stats.get(id) || { count: 0, size: 0 };
    return {
      ...row,
      ingest_key: id,
      storage_state: 'active',
      raw_size: 0,
      body_text_size: Buffer.byteLength(bodyText, 'utf8'),
      body_html_size: Buffer.byteLength(bodyHtml, 'utf8'),
      attachment_count: attachment.count,
      attachment_total_size: attachment.size,
      activation_seq: index + 1,
      storage_generation: 1,
    };
  });
  return {
    emails: normalizedEmails,
    attachments: normalizedAttachments,
    cleanup_outbox: [] as Row[],
    ingestion_registry: normalizedEmails.map(row => ({
      ingest_key: row.ingest_key,
      email_id: row.id,
      storage_generation: 1,
      state: 'active',
      claim_token: null,
      claim_expires_at: null,
      updated_at: row.created_at,
    })),
    email_activation_events: normalizedEmails.map(row => ({
      seq: row.activation_seq,
      email_id: row.id,
      storage_generation: 1,
      activated_at: row.created_at,
    })),
  };
}

function main(): void {
  console.log('Creating read-only production metadata backup (no delete or write operations)...');
  const existing = new Set(query(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('cleanup_outbox','ingestion_registry','email_activation_events') ORDER BY name",
  ).map(row => String(row.name)));
  if (existing.size !== 0 && existing.size !== COORDINATION_TABLES.length) {
    throw new Error('Refusing backup from a partially migrated coordination schema');
  }

  const emails = query('SELECT * FROM emails ORDER BY created_at, id');
  const attachments = query('SELECT * FROM attachments ORDER BY created_at, id');
  const data = existing.size === COORDINATION_TABLES.length
    ? {
        emails,
        attachments,
        cleanup_outbox: query('SELECT * FROM cleanup_outbox ORDER BY created_at, id'),
        ingestion_registry: query('SELECT * FROM ingestion_registry ORDER BY ingest_key'),
        email_activation_events: query('SELECT * FROM email_activation_events ORDER BY seq'),
      }
    : normalizeLegacy(emails, attachments);
  const backup = {
    format: 3,
    database: DB_NAME,
    timestamp: new Date().toISOString(),
    ...data,
  };

  mkdirSync(dirname(backupFile), { recursive: true, mode: 0o700 });
  const temporary = `${backupFile}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporary, JSON.stringify(backup, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    renameSync(temporary, backupFile);
  } catch (error) {
    try { unlinkSync(temporary); } catch {}
    throw error;
  }
  console.log(`Backup written to ${backupFile}. Production data was not modified.`);
}

main();
