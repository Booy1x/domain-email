#!/usr/bin/env tsx

/**
 * Destructive production D1 restore. R2 objects are never deleted or overwritten.
 * Requires: --confirm=REPLACE_PRODUCTION_MAIL_DB
 * Optional: --input=raw/prod-backup.json
 *
 * The complete backup is validated before Wrangler is invoked. Large text values
 * are restored in UTF-8-safe chunks so every SQL statement remains comfortably
 * below D1's statement-size limit.
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const DB_NAME = 'inbox-db';
const BACKUP_FORMAT = 3;
const CONFIRMATION = 'REPLACE_PRODUCTION_MAIL_DB';
const MAX_SQL_STATEMENT_BYTES = 90_000;
const INLINE_TEXT_BYTES = 2_048;
const TEXT_CHUNK_BYTES = 24_000;
const confirmArg = process.argv.find(arg => arg.startsWith('--confirm='))?.slice('--confirm='.length);
const inputArg = process.argv.find(arg => arg.startsWith('--input='))?.slice('--input='.length);
const backupFile = resolve(inputArg || 'raw/prod-backup.json');

const EMAIL_COLUMNS = [
  'id', 'domain', 'mail_from', 'rcpt_to', 'subject', 'body_text', 'body_html', 'date', 'r2_key',
  'is_read', 'is_flagged', 'is_spam', 'created_at', 'deleted_at', 'ingest_key', 'storage_state',
  'raw_size', 'body_text_size', 'body_html_size', 'attachment_count', 'attachment_total_size',
  'activation_seq', 'storage_generation',
] as const;
const ATTACHMENT_COLUMNS = [
  'id', 'email_id', 'filename', 'content_type', 'size', 'r2_key', 'created_at', 'storage_state',
  'storage_generation',
] as const;
const OUTBOX_COLUMNS = [
  'id', 'object_key', 'object_kind', 'email_id', 'attempts', 'next_attempt_at', 'last_error',
  'created_at', 'completed_at', 'storage_generation', 'claim_token', 'claim_expires_at',
] as const;
const REGISTRY_COLUMNS = [
  'ingest_key', 'email_id', 'storage_generation', 'state', 'claim_token', 'claim_expires_at', 'updated_at',
] as const;
const ACTIVATION_COLUMNS = ['seq', 'email_id', 'storage_generation', 'activated_at'] as const;

const EMAIL_INTEGER_COLUMNS = new Set([
  'is_read', 'is_flagged', 'is_spam', 'raw_size', 'body_text_size', 'body_html_size',
  'attachment_count', 'attachment_total_size', 'activation_seq', 'storage_generation',
]);
const ATTACHMENT_INTEGER_COLUMNS = new Set(['size', 'storage_generation']);
const OUTBOX_INTEGER_COLUMNS = new Set(['attempts', 'storage_generation']);
const REGISTRY_INTEGER_COLUMNS = new Set(['storage_generation']);
const ACTIVATION_INTEGER_COLUMNS = new Set(['seq', 'storage_generation']);

interface RecordValue { [key: string]: string | number | null }
interface Backup {
  format: number;
  database: string;
  timestamp: string;
  emails: RecordValue[];
  attachments: RecordValue[];
  cleanup_outbox: RecordValue[];
  ingestion_registry: RecordValue[];
  email_activation_events: RecordValue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRows(
  table: string,
  value: unknown,
  columns: readonly string[],
  integerColumns: Set<string>,
  keyColumn: string,
): RecordValue[] {
  if (!Array.isArray(value)) throw new Error(`invalid backup: ${table} must be an array`);
  const keys = new Set<string>();
  return value.map((candidate, index) => {
    if (!isRecord(candidate)) throw new Error(`invalid backup: ${table}[${index}] must be an object`);
    for (const column of columns) {
      if (!Object.prototype.hasOwnProperty.call(candidate, column)) {
        throw new Error(`invalid backup: ${table}[${index}] is missing ${column}`);
      }
      const field = candidate[column];
      if (field !== null && typeof field !== 'string' && typeof field !== 'number') {
        throw new Error(`invalid backup: ${table}[${index}].${column} has an invalid type`);
      }
      if (integerColumns.has(column) && field !== null && (!Number.isSafeInteger(field) || Number(field) < 0)) {
        throw new Error(`invalid backup: ${table}[${index}].${column} must be a non-negative integer or null`);
      }
      if (!integerColumns.has(column) && field !== null && typeof field !== 'string') {
        throw new Error(`invalid backup: ${table}[${index}].${column} must be text or null`);
      }
    }
    const key = candidate[keyColumn];
    if ((typeof key !== 'string' && typeof key !== 'number') || String(key).length === 0 || String(key).length > 1024) {
      throw new Error(`invalid backup: ${table}[${index}].${keyColumn} is invalid`);
    }
    const normalizedKey = String(key);
    if (keys.has(normalizedKey)) throw new Error(`invalid backup: duplicate ${table}.${keyColumn} ${normalizedKey}`);
    keys.add(normalizedKey);
    return Object.fromEntries(columns.map(column => [column, candidate[column] as string | number | null]));
  });
}

function validateBackup(value: unknown): Backup {
  if (!isRecord(value)) throw new Error('invalid backup: top level must be an object');
  if (value.format !== BACKUP_FORMAT) throw new Error(`invalid backup: format must be ${BACKUP_FORMAT}`);
  if (value.database !== DB_NAME) throw new Error(`invalid backup: database must be ${DB_NAME}`);
  if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) {
    throw new Error('invalid backup: timestamp is missing or invalid');
  }

  const backup: Backup = {
    format: BACKUP_FORMAT,
    database: DB_NAME,
    timestamp: value.timestamp,
    emails: validateRows('emails', value.emails, EMAIL_COLUMNS, EMAIL_INTEGER_COLUMNS, 'id'),
    attachments: validateRows('attachments', value.attachments, ATTACHMENT_COLUMNS, ATTACHMENT_INTEGER_COLUMNS, 'id'),
    cleanup_outbox: validateRows('cleanup_outbox', value.cleanup_outbox, OUTBOX_COLUMNS, OUTBOX_INTEGER_COLUMNS, 'id'),
    ingestion_registry: validateRows('ingestion_registry', value.ingestion_registry, REGISTRY_COLUMNS, REGISTRY_INTEGER_COLUMNS, 'ingest_key'),
    email_activation_events: validateRows('email_activation_events', value.email_activation_events, ACTIVATION_COLUMNS, ACTIVATION_INTEGER_COLUMNS, 'seq'),
  };

  const emailById = new Map(backup.emails.map(row => [String(row.id), row]));
  const emailIds = new Set(emailById.keys());
  const registryByEmail = new Map(backup.ingestion_registry.map(row => [String(row.email_id), row]));
  const eventBySeq = new Map(backup.email_activation_events.map(row => [Number(row.seq), row]));
  const objectKeys = new Set<string>();
  const registryEmailIds = new Set<string>();

  for (const row of backup.ingestion_registry) {
    const emailId = String(row.email_id);
    if (registryEmailIds.has(emailId)) throw new Error(`invalid backup: duplicate ingestion_registry.email_id ${emailId}`);
    registryEmailIds.add(emailId);
    if (!['pending', 'active', 'cleanup_pending', 'cleanup_claimed', 'cleaned'].includes(String(row.state))) {
      throw new Error(`invalid backup: unsupported ingestion state ${String(row.state)}`);
    }
    if (row.state === 'cleanup_claimed'
        && (typeof row.claim_token !== 'string' || typeof row.claim_expires_at !== 'string')) {
      throw new Error(`invalid backup: claimed registry ${emailId} is missing its lease`);
    }
  }
  const eventPairs = new Set<string>();
  for (const row of backup.email_activation_events) {
    if (Number(row.seq) < 1) throw new Error('invalid backup: activation seq must be positive');
    const pair = `${String(row.email_id)}\0${Number(row.storage_generation)}`;
    if (eventPairs.has(pair)) throw new Error(`invalid backup: duplicate activation generation for ${String(row.email_id)}`);
    eventPairs.add(pair);
  }
  const attachmentStats = new Map<string, { count: number; size: number }>();
  for (const row of backup.attachments) {
    const emailId = String(row.email_id);
    if (!emailIds.has(emailId)) {
      throw new Error(`invalid backup: attachment ${String(row.id)} references a missing email`);
    }
    if (!['pending', 'active', 'failed'].includes(String(row.storage_state))) {
      throw new Error(`invalid backup: attachment ${String(row.id)} has an invalid storage state`);
    }
    const parent = emailById.get(emailId)!;
    if (row.storage_state !== parent.storage_state
        || Number(row.storage_generation) !== Number(parent.storage_generation)) {
      throw new Error(`invalid backup: attachment ${String(row.id)} generation or state disagrees with its email`);
    }
    const stats = attachmentStats.get(emailId) || { count: 0, size: 0 };
    stats.count++;
    stats.size += Number(row.size);
    attachmentStats.set(emailId, stats);
  }
  for (const row of backup.emails) {
    const emailId = String(row.id);
    if (!['pending', 'active', 'failed'].includes(String(row.storage_state))) {
      throw new Error(`invalid backup: email ${emailId} has an invalid storage state`);
    }
    for (const flag of ['is_read', 'is_flagged', 'is_spam']) {
      if (![0, 1].includes(Number(row[flag]))) throw new Error(`invalid backup: email ${emailId}.${flag} must be 0 or 1`);
    }
    const stats = attachmentStats.get(emailId) || { count: 0, size: 0 };
    if (stats.count !== Number(row.attachment_count) || stats.size !== Number(row.attachment_total_size)) {
      throw new Error(`invalid backup: email ${emailId} attachment totals disagree`);
    }
    const registry = registryByEmail.get(emailId);
    if (!registry || String(registry.ingest_key) !== String(row.ingest_key ?? row.id)
        || Number(registry.storage_generation) !== Number(row.storage_generation)) {
      throw new Error(`invalid backup: email ${emailId} has no matching ingestion registry generation`);
    }
    const expectedRegistryState = row.storage_state === 'active' ? 'active' : 'pending';
    if (registry.state !== expectedRegistryState) {
      throw new Error(`invalid backup: email ${emailId} storage and registry states disagree`);
    }
    if (row.storage_state === 'active' && row.activation_seq === null) {
      throw new Error(`invalid backup: active email ${emailId} is missing activation_seq`);
    }
    if (row.storage_state !== 'active' && row.activation_seq !== null) {
      throw new Error(`invalid backup: non-active email ${emailId} has activation_seq`);
    }
    if (row.activation_seq !== null) {
      const event = eventBySeq.get(Number(row.activation_seq));
      if (!event || String(event.email_id) !== emailId
          || Number(event.storage_generation) !== Number(row.storage_generation)) {
        throw new Error(`invalid backup: email ${emailId} has no matching activation event`);
      }
    }
  }
  for (const row of backup.cleanup_outbox) {
    const objectKey = String(row.object_key);
    if (!['raw', 'attachment'].includes(String(row.object_kind))) {
      throw new Error(`invalid backup: cleanup ${String(row.id)} has an invalid object kind`);
    }
    if (objectKeys.has(objectKey)) throw new Error(`invalid backup: duplicate cleanup object key ${objectKey}`);
    objectKeys.add(objectKey);
    if (row.completed_at === null) {
      const registry = registryByEmail.get(String(row.email_id));
      if (!registry || !['cleanup_pending', 'cleanup_claimed'].includes(String(registry.state))
          || Number(registry.storage_generation) !== Number(row.storage_generation)) {
        throw new Error(`invalid backup: pending cleanup ${String(row.id)} has no matching registry claim`);
      }
      if (registry.state === 'cleanup_claimed'
          && (typeof row.claim_token !== 'string' || row.claim_token !== registry.claim_token)) {
        throw new Error(`invalid backup: pending cleanup ${String(row.id)} has a mismatched claim token`);
      }
    }
  }
  return backup;
}

function sqlValue(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `CAST(X'${Buffer.from(value, 'utf8').toString('hex')}' AS TEXT)`;
}

function splitUtf8(value: string, maximumBytes: number): string[] {
  const chunks: string[] = [];
  let characters: string[] = [];
  let bytes = 0;
  for (const character of value) {
    const size = Buffer.byteLength(character, 'utf8');
    if (characters.length > 0 && bytes + size > maximumBytes) {
      chunks.push(characters.join(''));
      characters = [];
      bytes = 0;
    }
    characters.push(character);
    bytes += size;
  }
  if (characters.length > 0 || value.length === 0) chunks.push(characters.join(''));
  return chunks;
}

function checkedStatement(statement: string): string {
  const size = Buffer.byteLength(statement, 'utf8');
  if (size > MAX_SQL_STATEMENT_BYTES) throw new Error(`generated SQL statement exceeds safe limit: ${size} bytes`);
  return statement;
}

function insertStatements(table: string, columns: readonly string[], row: RecordValue, keyColumn: string): string[] {
  const deferred = new Map<string, string>();
  const initialValues = columns.map(column => {
    const value = row[column];
    if (typeof value === 'string' && Buffer.byteLength(value, 'utf8') > INLINE_TEXT_BYTES) {
      deferred.set(column, value);
      return sqlValue('');
    }
    return sqlValue(value);
  });
  const statements = [checkedStatement(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${initialValues.join(', ')});`,
  )];
  const key = sqlValue(row[keyColumn]);
  for (const [column, value] of deferred) {
    for (const chunk of splitUtf8(value, TEXT_CHUNK_BYTES)) {
      statements.push(checkedStatement(
        `UPDATE ${table} SET ${column} = ${column} || ${sqlValue(chunk)} WHERE ${keyColumn} = ${key};`,
      ));
    }
  }
  return statements;
}

function main(): void {
  if (confirmArg !== CONFIRMATION) {
    console.error('Refusing destructive restore. Re-run with --confirm=REPLACE_PRODUCTION_MAIL_DB after verifying account, database, backup, and rollback plan.');
    process.exit(2);
  }

  // Validation happens before creating SQL or invoking Wrangler. A truncated,
  // old, or internally inconsistent snapshot can never reach destructive SQL.
  const backup = validateBackup(JSON.parse(readFileSync(backupFile, 'utf8')));
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'domain-email-restore-'));
  chmodSync(temporaryDirectory, 0o700);
  const sqlFile = join(temporaryDirectory, 'restore.sql');
  try {
    const statements = [
      'DELETE FROM cleanup_outbox;',
      'DELETE FROM ingestion_registry;',
      'DELETE FROM email_activation_events;',
      'DELETE FROM attachments;',
      'DELETE FROM emails;',
      ...backup.emails.flatMap(row => insertStatements('emails', EMAIL_COLUMNS, row, 'id')),
      ...backup.attachments.flatMap(row => insertStatements('attachments', ATTACHMENT_COLUMNS, row, 'id')),
      ...backup.cleanup_outbox.flatMap(row => insertStatements('cleanup_outbox', OUTBOX_COLUMNS, row, 'id')),
      ...backup.ingestion_registry.flatMap(row => insertStatements('ingestion_registry', REGISTRY_COLUMNS, row, 'ingest_key')),
      ...backup.email_activation_events.flatMap(row => insertStatements('email_activation_events', ACTIVATION_COLUMNS, row, 'seq')),
      "INSERT INTO emails_fts(emails_fts) VALUES('rebuild');",
    ].map(checkedStatement);
    writeFileSync(sqlFile, statements.join('\n'), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    console.warn(`Replacing production ${DB_NAME} from ${backupFile}; R2 is unchanged.`);
    execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--file', sqlFile], {
      stdio: 'inherit',
    });
    const result = execFileSync('npx', [
      'wrangler', 'd1', 'execute', DB_NAME, '--remote', '--command',
      'SELECT COUNT(*) AS total, SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS deleted FROM emails', '--json',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
    console.log(`Restore verification: ${result}`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

main();
