#!/usr/bin/env tsx

/**
 * Read-only production D1 backup. This script never mutates D1 or R2.
 * Usage: npx tsx scripts/backup-prod.ts [--output=path]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DB_NAME = 'inbox-db';
const outputArg = process.argv.find(arg => arg.startsWith('--output='));
const backupFile = resolve(outputArg?.slice('--output='.length) || 'raw/prod-backup.json');

function query(sql: string): unknown[] {
  const output = execFileSync('npx', [
    'wrangler', 'd1', 'execute', DB_NAME, '--remote', '--command', sql, '--json',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
  const parsed = JSON.parse(output) as Array<{ results?: unknown[] }>;
  return parsed[0]?.results || [];
}

function main(): void {
  console.log('Creating read-only production metadata backup (no delete or write operations)...');
  const backup = {
    format: 3,
    database: DB_NAME,
    timestamp: new Date().toISOString(),
    emails: query('SELECT * FROM emails ORDER BY created_at, id'),
    attachments: query('SELECT * FROM attachments ORDER BY created_at, id'),
    cleanup_outbox: query('SELECT * FROM cleanup_outbox ORDER BY created_at, id'),
    ingestion_registry: query('SELECT * FROM ingestion_registry ORDER BY ingest_key'),
    email_activation_events: query('SELECT * FROM email_activation_events ORDER BY seq'),
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
