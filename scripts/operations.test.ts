import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporary: string[] = [];
afterEach(() => {
  while (temporary.length) rmSync(temporary.pop()!, { recursive: true, force: true });
});

function sandbox(schema: 'modern' | 'legacy' = 'modern'): { directory: string; log: string; capture: string } {
  const directory = mkdtempSync(join(tmpdir(), 'domain-email-ops-test-'));
  temporary.push(directory);
  const log = join(directory, 'npx.log');
  const capture = join(directory, 'restore.sql');
  const fake = join(directory, 'npx');
  const schemaRows = schema === 'modern'
    ? '[{"name":"cleanup_outbox"},{"name":"email_activation_events"},{"name":"ingestion_registry"}]'
    : '[]';
  const emailRows = schema === 'modern'
    ? '[{"id":"email-id","domain":"example.com","mail_from":"redacted","rcpt_to":"redacted","subject":"s","body_text":"b","body_html":"","date":"2026-01-01","r2_key":"raw/email-id.g2.eml","is_read":1,"is_flagged":0,"is_spam":0,"created_at":"2026-01-01","deleted_at":"2026-01-02","ingest_key":"email-id","storage_state":"active","raw_size":1,"body_text_size":1,"body_html_size":0,"attachment_count":0,"attachment_total_size":0,"activation_seq":9,"storage_generation":2}]'
    : '[{"id":"legacy-id","domain":"example.com","mail_from":"redacted","rcpt_to":"redacted","subject":"legacy","body_text":"正文","body_html":"","date":"2025-01-01","r2_key":"raw/legacy.eml","is_read":0,"is_flagged":0,"is_spam":0,"created_at":"2025-01-01","deleted_at":null}]';
  const attachmentRows = schema === 'modern'
    ? '[]'
    : '[{"id":"legacy-att","email_id":"legacy-id","filename":"a.txt","content_type":"text/plain","size":3,"r2_key":"attachments/legacy-att","created_at":"2025-01-01"}]';
  writeFileSync(fake, `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_NPX_LOG"
previous=''
for argument in "$@"; do
  if [ "$previous" = '--file' ]; then cp "$argument" "$FAKE_RESTORE_CAPTURE"; fi
  previous="$argument"
done
case "$*" in
  *"FROM sqlite_schema"*) printf '%s' '[{"results":${schemaRows}}]' ;;
  *"SELECT * FROM emails"*) printf '%s' '[{"results":${emailRows}}]' ;;
  *"SELECT * FROM attachments"*) printf '%s' '[{"results":${attachmentRows}}]' ;;
  *"SELECT * FROM cleanup_outbox"*) printf '%s' '[{"results":[{"id":"outbox-id","object_key":"raw/old-email.eml","object_kind":"raw","email_id":"old-email","attempts":1,"next_attempt_at":"2026-01-01","last_error":"delete_failed","created_at":"2026-01-01","completed_at":"2026-01-02","storage_generation":1,"claim_token":null,"claim_expires_at":null}]}]' ;;
  *"SELECT * FROM ingestion_registry"*) printf '%s' '[{"results":[{"ingest_key":"email-id","email_id":"email-id","storage_generation":2,"state":"active","claim_token":null,"claim_expires_at":null,"updated_at":"2026-01-01"}]}]' ;;
  *"SELECT * FROM email_activation_events"*) printf '%s' '[{"results":[{"seq":9,"email_id":"email-id","storage_generation":2,"activated_at":"2026-01-01"}]}]' ;;
  *"SELECT COUNT(*)"*) printf '%s' '[{"results":[{"total":1,"deleted":1}]}]' ;;
  *) printf '%s' '[]' ;;
esac
`, { mode: 0o700 });
  chmodSync(fake, 0o700);
  return { directory, log, capture };
}

function runScript(script: string, args: string[], box: ReturnType<typeof sandbox>) {
  const tsxCli = resolve('node_modules/tsx/dist/cli.mjs');
  return spawnSync(process.execPath, [tsxCli, script, ...args], {
    cwd: resolve('.'),
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${box.directory}:${process.env.PATH || ''}`,
      FAKE_NPX_LOG: box.log,
      FAKE_RESTORE_CAPTURE: box.capture,
    },
  });
}

function completeBackup(bodyText = 'b') {
  return {
    format: 3,
    database: 'inbox-db',
    timestamp: '2026-01-01T00:00:00.000Z',
    emails: [{
      id: 'email-id', domain: 'example.com', mail_from: 'redacted', rcpt_to: 'redacted',
      subject: 's', body_text: bodyText, body_html: '', date: '2026-01-01', r2_key: 'raw/email-id.g2.eml',
      is_read: 1, is_flagged: 0, is_spam: 0, created_at: '2026-01-01', deleted_at: '2026-01-02',
      ingest_key: 'email-id', storage_state: 'active', raw_size: bodyText.length,
      body_text_size: Buffer.byteLength(bodyText), body_html_size: 0, attachment_count: 0,
      attachment_total_size: 0, activation_seq: 9, storage_generation: 2,
    }],
    attachments: [],
    cleanup_outbox: [{
      id: 'outbox-id', object_key: 'raw/old-email.eml', object_kind: 'raw', email_id: 'old-email',
      attempts: 1, next_attempt_at: '2026-01-01', last_error: 'delete_failed', created_at: '2026-01-01',
      completed_at: '2026-01-02', storage_generation: 1, claim_token: null, claim_expires_at: null,
    }],
    ingestion_registry: [{
      ingest_key: 'email-id', email_id: 'email-id', storage_generation: 2, state: 'active',
      claim_token: null, claim_expires_at: null, updated_at: '2026-01-01',
    }],
    email_activation_events: [{ seq: 9, email_id: 'email-id', storage_generation: 2, activated_at: '2026-01-01' }],
  };
}

function writeBackup(box: ReturnType<typeof sandbox>, value: unknown): string {
  const path = join(box.directory, 'backup.json');
  writeFileSync(path, JSON.stringify(value));
  return path;
}

describe('production backup and restore safety', () => {
  it('backup executes only SELECT commands and atomically writes a private complete snapshot', () => {
    const box = sandbox();
    const output = join(box.directory, 'backup.json');
    const result = runScript('scripts/backup-prod.ts', [`--output=${output}`], box);
    expect(result.status, result.stderr).toBe(0);
    const commands = readFileSync(box.log, 'utf8').trim().split('\n');
    expect(commands).toHaveLength(6);
    for (const command of commands) {
      expect(command).toContain('d1 execute inbox-db --remote --command SELECT');
      expect(command).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP|PUT)\b/);
    }
    const backup = JSON.parse(readFileSync(output, 'utf8'));
    expect(backup.format).toBe(3);
    expect(backup.emails[0]).toMatchObject({ deleted_at: '2026-01-02', activation_seq: 9, storage_generation: 2 });
    expect(backup.ingestion_registry[0].state).toBe('active');
    expect(backup.email_activation_events[0].seq).toBe(9);
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });


  it('normalizes a complete pre-hardening schema into a restorable format-3 snapshot', () => {
    const box = sandbox('legacy');
    const output = join(box.directory, 'legacy-backup.json');
    const result = runScript('scripts/backup-prod.ts', [`--output=${output}`], box);
    expect(result.status, result.stderr).toBe(0);
    const commands = readFileSync(box.log, 'utf8').trim().split('\n');
    expect(commands).toHaveLength(3);
    expect(commands.every(command => command.includes('--remote --command SELECT'))).toBe(true);
    const backup = JSON.parse(readFileSync(output, 'utf8'));
    expect(backup.format).toBe(3);
    expect(backup.emails[0]).toMatchObject({
      id: 'legacy-id', ingest_key: 'legacy-id', storage_state: 'active',
      body_text_size: 6, attachment_count: 1, attachment_total_size: 3,
      activation_seq: 1, storage_generation: 1,
    });
    expect(backup.attachments[0]).toMatchObject({ storage_state: 'active', storage_generation: 1 });
    expect(backup.ingestion_registry[0]).toMatchObject({ email_id: 'legacy-id', state: 'active' });
    expect(backup.email_activation_events[0]).toMatchObject({ seq: 1, email_id: 'legacy-id' });
    expect(backup.cleanup_outbox).toEqual([]);
    expect(statSync(output).mode & 0o777).toBe(0o600);
  });
  it('restore refuses by default and confirmed SQL preserves every coordination field', () => {
    const box = sandbox();
    const refused = runScript('scripts/restore-prod.ts', [], box);
    expect(refused.status).toBe(2);
    expect(refused.stderr).toContain('Refusing destructive restore');
    expect(() => readFileSync(box.log)).toThrow();

    const backup = writeBackup(box, completeBackup());
    const result = runScript('scripts/restore-prod.ts', [
      `--input=${backup}`, '--confirm=REPLACE_PRODUCTION_MAIL_DB',
    ], box);
    expect(result.status, result.stderr).toBe(0);
    const sql = readFileSync(box.capture, 'utf8');
    expect(sql).toContain('deleted_at');
    expect(sql).toContain('activation_seq, storage_generation');
    expect(sql).toContain('claim_token, claim_expires_at');
    expect(sql).toContain('INSERT INTO ingestion_registry');
    expect(sql).toContain('INSERT INTO email_activation_events');
  });


  it('validates a backup without confirmation, temporary SQL, or Wrangler calls', () => {
    const box = sandbox();
    const backup = writeBackup(box, completeBackup());
    const result = runScript('scripts/restore-prod.ts', [`--input=${backup}`, '--validate-only'], box);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('Backup is valid: 1 emails, 0 attachments');
    expect(() => readFileSync(box.log)).toThrow();
    expect(() => readFileSync(box.capture)).toThrow();
  });
  it('rejects an incomplete backup before any Wrangler call or destructive SQL', () => {
    const box = sandbox();
    const incomplete = completeBackup() as any;
    delete incomplete.emails[0].deleted_at;
    const backup = writeBackup(box, incomplete);
    const result = runScript('scripts/restore-prod.ts', [
      `--input=${backup}`, '--confirm=REPLACE_PRODUCTION_MAIL_DB',
    ], box);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('is missing deleted_at');
    expect(() => readFileSync(box.log)).toThrow();
    expect(() => readFileSync(box.capture)).toThrow();
  });

  it('rejects attachment state or generation that disagrees with its parent before Wrangler', () => {
    const box = sandbox();
    const inconsistent = completeBackup() as any;
    inconsistent.emails[0].attachment_count = 1;
    inconsistent.emails[0].attachment_total_size = 3;
    inconsistent.attachments = [{
      id: 'attachment-id', email_id: 'email-id', filename: 'a.txt', content_type: 'text/plain',
      size: 3, r2_key: 'attachments/attachment-id', created_at: '2026-01-01',
      storage_state: 'active', storage_generation: 1,
    }];
    const backup = writeBackup(box, inconsistent);
    const result = runScript('scripts/restore-prod.ts', [
      `--input=${backup}`, '--confirm=REPLACE_PRODUCTION_MAIL_DB',
    ], box);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('generation or state disagrees');
    expect(() => readFileSync(box.log)).toThrow();
  });

  it('chunks large UTF-8 bodies so every generated SQL statement stays below the safe limit', () => {
    const box = sandbox();
    const body = '邮件正文🙂'.repeat(12_000);
    expect(Buffer.byteLength(body)).toBeGreaterThan(60_000);
    const backup = writeBackup(box, completeBackup(body));
    const result = runScript('scripts/restore-prod.ts', [
      `--input=${backup}`, '--confirm=REPLACE_PRODUCTION_MAIL_DB',
    ], box);
    expect(result.status, result.stderr).toBe(0);
    const sql = readFileSync(box.capture, 'utf8');
    expect(sql).toContain('UPDATE emails SET body_text = body_text ||');
    const statements = sql.split(/;\s*(?:\n|$)/).filter(Boolean);
    expect(Math.max(...statements.map(statement => Buffer.byteLength(statement)))).toBeLessThanOrEqual(90_000);
    expect(statements.filter(statement => statement.includes('SET body_text')).length).toBeGreaterThan(1);
  });
});

  it('keeps development helpers local and blocks manual production operations by default', () => {
    const seed = readFileSync('scripts/seed-mock-data.ts', 'utf8');
    expect(seed).toContain('--local');
    expect(seed).not.toContain('--remote');
    expect(seed).toContain('INSERT OR IGNORE INTO ingestion_registry');
    expect(seed).toContain('INSERT OR IGNORE INTO email_activation_events');

    const box = sandbox();
    const deploy = runScript('scripts/deploy.ts', [], box);
    expect(deploy.status).toBe(2);
    expect(deploy.stderr).toContain('Manual production deployment is disabled');
    expect(() => readFileSync(box.log)).toThrow();

    const domains = join(box.directory, 'domains.txt');
    writeFileSync(domains, 'example.com\n');
    const routing = spawnSync('/bin/bash', ['scripts/configure-domains.sh', domains], {
      cwd: resolve('.'), encoding: 'utf8', env: { ...process.env, PATH: box.directory },
    });
    expect(routing.status).toBe(2);
    expect(routing.stdout).toContain('Refusing to change Email Routing');
  });
