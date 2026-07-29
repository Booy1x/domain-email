import type { AttachmentRow, EmailListRow, EmailRow } from './types';

const EMAIL_FIELDS = `
  id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key,
  is_read, is_flagged, is_spam, created_at, deleted_at, ingest_key,
  storage_state, raw_size, body_text_size, body_html_size,
  attachment_count, attachment_total_size, activation_seq, storage_generation
`;

interface KeysetCursor {
  k: 'date' | 'deleted' | 'activation' | 'object';
  v: string;
  i: string;
}

export class InvalidCursorError extends Error {
  constructor() {
    super('invalid_cursor');
  }
}

export function encodeCursor(cursor: KeysetCursor): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cursor));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeCursor(raw: string, kind: KeysetCursor['k']): KeysetCursor {
  if (!raw || raw.length > 512) throw new InvalidCursorError();
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - raw.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const value = JSON.parse(new TextDecoder().decode(bytes)) as Partial<KeysetCursor>;
    if (value.k !== kind || typeof value.v !== 'string' || typeof value.i !== 'string' || !value.v || !value.i) {
      throw new InvalidCursorError();
    }
    return value as KeysetCursor;
  } catch (error) {
    if (error instanceof InvalidCursorError) throw error;
    throw new InvalidCursorError();
  }
}

export function insertEmail(db: D1Database, email: EmailRow): Promise<D1Result> {
  return db.prepare(
    `INSERT INTO emails (
      id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key,
      is_read, is_flagged, is_spam, created_at, ingest_key, storage_state,
      raw_size, body_text_size, body_html_size, attachment_count, attachment_total_size,
      activation_seq, storage_generation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    email.id, email.domain, email.mail_from, email.rcpt_to, email.subject,
    email.body_text, email.body_html, email.date, email.r2_key,
    email.is_read, email.is_flagged, email.is_spam, email.created_at,
    email.ingest_key ?? null, email.storage_state ?? 'active', email.raw_size ?? 0,
    email.body_text_size ?? 0, email.body_html_size ?? 0,
    email.attachment_count ?? 0, email.attachment_total_size ?? 0,
    email.activation_seq ?? null, email.storage_generation ?? 1,
  ).run();
}

export function insertAttachment(db: D1Database, att: AttachmentRow): Promise<D1Result> {
  return db.prepare(
    `INSERT INTO attachments (id, email_id, filename, content_type, size, r2_key, storage_state, storage_generation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    att.id, att.email_id, att.filename, att.content_type, att.size, att.r2_key,
    att.storage_state ?? 'active', att.storage_generation ?? 1,
  ).run();
}

export type IngestionReservation = {
  state: 'pending' | 'active' | 'cleanup_pending' | 'cleanup_claimed' | 'cleaned';
  storage_generation: number;
};

/** Reserve one generation before choosing R2 keys. */
export async function reserveIngestion(db: D1Database, ingestKey: string, emailId: string): Promise<IngestionReservation> {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO ingestion_registry
      (ingest_key, email_id, storage_generation, state)
      VALUES (?, ?, 1, 'pending')`).bind(ingestKey, emailId),
    db.prepare(`UPDATE ingestion_registry SET
      storage_generation = storage_generation + CASE WHEN state = 'cleaned' THEN 1 ELSE 0 END,
      state = 'pending', claim_token = NULL, claim_expires_at = NULL,
      updated_at = CURRENT_TIMESTAMP
      WHERE ingest_key = ? AND state IN ('cleanup_pending', 'cleaned')`).bind(ingestKey),
    db.prepare(`DELETE FROM cleanup_outbox
      WHERE email_id = ? AND EXISTS (
        SELECT 1 FROM ingestion_registry r
        WHERE r.ingest_key = ? AND r.state = 'pending'
      )`).bind(emailId, ingestKey),
  ]);
  const row = await db.prepare(`SELECT state, storage_generation FROM ingestion_registry
    WHERE ingest_key = ? AND email_id = ?`).bind(ingestKey, emailId).first<IngestionReservation>();
  if (!row) throw new Error('ingestion_reservation_failed');
  return row;
}

export async function stageIngestion(db: D1Database, email: EmailRow, attachments: AttachmentRow[]): Promise<void> {
  const generation = email.storage_generation ?? 1;
  const ingestKey = email.ingest_key ?? email.id;
  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT INTO emails (
      id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key,
      is_read, is_flagged, is_spam, created_at, ingest_key, storage_state,
      raw_size, body_text_size, body_html_size, attachment_count, attachment_total_size,
      activation_seq, storage_generation
    ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL, ?
    WHERE EXISTS (SELECT 1 FROM ingestion_registry
      WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain, mail_from = excluded.mail_from, rcpt_to = excluded.rcpt_to,
      subject = excluded.subject, body_text = excluded.body_text, body_html = excluded.body_html,
      date = excluded.date, r2_key = excluded.r2_key, created_at = excluded.created_at,
      ingest_key = excluded.ingest_key, storage_state = 'pending', activation_seq = NULL,
      storage_generation = excluded.storage_generation, raw_size = excluded.raw_size,
      body_text_size = excluded.body_text_size, body_html_size = excluded.body_html_size,
      attachment_count = excluded.attachment_count, attachment_total_size = excluded.attachment_total_size
    WHERE emails.storage_state <> 'active' OR emails.storage_generation <> excluded.storage_generation`).bind(
      email.id, email.domain, email.mail_from, email.rcpt_to, email.subject,
      email.body_text, email.body_html, email.date, email.r2_key, email.created_at,
      ingestKey, email.raw_size ?? 0, email.body_text_size ?? 0,
      email.body_html_size ?? 0, email.attachment_count ?? attachments.length,
      email.attachment_total_size ?? 0, generation, ingestKey, generation,
    ),
  ];
  for (const att of attachments) {
    statements.push(db.prepare(`INSERT INTO attachments
      (id, email_id, filename, content_type, size, r2_key, storage_state, storage_generation)
      SELECT ?, ?, ?, ?, ?, ?, 'pending', ?
      WHERE EXISTS (SELECT 1 FROM ingestion_registry
        WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?)
      ON CONFLICT(id) DO UPDATE SET
        email_id = excluded.email_id, filename = excluded.filename,
        content_type = excluded.content_type, size = excluded.size,
        r2_key = excluded.r2_key, storage_state = 'pending',
        storage_generation = excluded.storage_generation
      WHERE attachments.storage_state <> 'active'
        OR attachments.storage_generation <> excluded.storage_generation`).bind(
        att.id, att.email_id, att.filename, att.content_type, att.size, att.r2_key,
        generation, ingestKey, generation,
      ));
  }
  await db.batch(statements);
}

export async function activateIngestion(db: D1Database, ingestKey: string, emailId: string, generation: number): Promise<void> {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO email_activation_events
      (email_id, storage_generation) SELECT ?, ?
      WHERE EXISTS (SELECT 1 FROM ingestion_registry
        WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?)`)
      .bind(emailId, generation, ingestKey, generation),
    db.prepare(`UPDATE attachments SET storage_state = 'active'
      WHERE email_id = ? AND storage_generation = ?
        AND EXISTS (SELECT 1 FROM ingestion_registry
          WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?)`)
      .bind(emailId, generation, ingestKey, generation),
    db.prepare(`UPDATE emails SET storage_state = 'active', activation_seq = (
        SELECT seq FROM email_activation_events
        WHERE email_id = ? AND storage_generation = ?
      ) WHERE id = ? AND storage_generation = ?
        AND EXISTS (SELECT 1 FROM ingestion_registry
          WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?)`)
      .bind(emailId, generation, emailId, generation, ingestKey, generation),
    db.prepare(`UPDATE ingestion_registry SET state = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE ingest_key = ? AND state = 'pending' AND storage_generation = ?`)
      .bind(ingestKey, generation),
  ]);
}

export async function isIngestionActive(db: D1Database, ingestKey: string): Promise<boolean> {
  const row = await db.prepare(`SELECT state FROM ingestion_registry WHERE ingest_key = ?`)
    .bind(ingestKey).first<{ state: string }>();
  return row?.state === 'active';
}

export interface ListEmailsOptions {
  domain?: string;
  q?: string;
  cursor?: string;
  limit: number;
  rcptUser?: string;
}

interface PageResult {
  emails: EmailListRow[];
  cursor: string | null;
}

function page(rows: EmailListRow[], limit: number, kind: 'date'): PageResult {
  const hasMore = rows.length > limit;
  const emails = hasMore ? rows.slice(0, limit) : rows;
  const last = emails[emails.length - 1];
  return { emails, cursor: hasMore && last ? encodeCursor({ k: kind, v: last.date, i: last.id }) : null };
}

export async function searchEmails(db: D1Database, opts: ListEmailsOptions): Promise<PageResult> {
  const limit = opts.limit;
  const params: unknown[] = [];
  const ftsQuery = (opts.q || '').trim().split(/\s+/).filter(Boolean)
    .map(term => `"${term.replace(/"/g, '""')}"*`).join(' AND ');
  const conditions = [`emails_fts MATCH ?`, `e.deleted_at IS NULL`, `e.storage_state = 'active'`];
  params.push(ftsQuery);

  if (opts.domain) { conditions.push('e.domain = ?'); params.push(opts.domain); }
  if (opts.rcptUser) {
    conditions.push("SUBSTR(e.rcpt_to, 1, INSTR(e.rcpt_to, '@') - 1) = ?");
    params.push(opts.rcptUser);
  }
  if (opts.cursor) {
    const cursor = decodeCursor(opts.cursor, 'date');
    conditions.push('(e.date < ? OR (e.date = ? AND e.id < ?))');
    params.push(cursor.v, cursor.v, cursor.i);
  }
  params.push(limit + 1);
  const result = await db.prepare(`
    SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date,
           e.is_read, e.is_flagged, e.created_at, e.activation_seq
    FROM emails_fts f JOIN emails e ON e.rowid = f.rowid
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.date DESC, e.id DESC LIMIT ?`).bind(...params).all<EmailListRow>();
  return page(result.results || [], limit, 'date');
}

export async function listEmails(db: D1Database, opts: ListEmailsOptions): Promise<PageResult> {
  if (opts.q?.trim()) return searchEmails(db, opts);
  const conditions = [`deleted_at IS NULL`, `storage_state = 'active'`];
  const params: unknown[] = [];
  if (opts.domain) { conditions.push('domain = ?'); params.push(opts.domain); }
  if (opts.rcptUser) {
    conditions.push("SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) = ?");
    params.push(opts.rcptUser);
  }
  if (opts.cursor) {
    const cursor = decodeCursor(opts.cursor, 'date');
    conditions.push('(date < ? OR (date = ? AND id < ?))');
    params.push(cursor.v, cursor.v, cursor.i);
  }
  params.push(opts.limit + 1);
  const result = await db.prepare(`SELECT id, domain, mail_from, rcpt_to, subject, date,
    is_read, is_flagged, created_at, activation_seq FROM emails WHERE ${conditions.join(' AND ')}
    ORDER BY date DESC, id DESC LIMIT ?`).bind(...params).all<EmailListRow>();
  return page(result.results || [], opts.limit, 'date');
}

export function getEmail(db: D1Database, id: string): Promise<EmailRow | null> {
  return db.prepare(`SELECT ${EMAIL_FIELDS} FROM emails
    WHERE id = ? AND deleted_at IS NULL AND storage_state = 'active'`).bind(id).first<EmailRow>();
}

export function getAttachments(db: D1Database, emailId: string): Promise<D1Result<AttachmentRow>> {
  return db.prepare(`SELECT a.id, a.email_id, a.filename, a.content_type, a.size, a.r2_key, a.created_at, a.storage_state, a.storage_generation
    FROM attachments a JOIN emails e ON e.id = a.email_id
    WHERE a.email_id = ? AND a.storage_state = 'active' AND e.storage_state = 'active'
      AND a.storage_generation = e.storage_generation AND e.deleted_at IS NULL
    ORDER BY a.created_at, a.id`).bind(emailId).all<AttachmentRow>();
}

export function getAttachment(db: D1Database, attachmentId: string): Promise<AttachmentRow | null> {
  return db.prepare(`SELECT a.id, a.email_id, a.filename, a.content_type, a.size, a.r2_key, a.created_at, a.storage_state, a.storage_generation
    FROM attachments a JOIN emails e ON e.id = a.email_id
    WHERE a.id = ? AND a.storage_state = 'active' AND e.storage_state = 'active'
      AND a.storage_generation = e.storage_generation AND e.deleted_at IS NULL`)
    .bind(attachmentId).first<AttachmentRow>();
}

export function markRead(db: D1Database, id: string, isRead: boolean): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET is_read = ? WHERE id = ? AND deleted_at IS NULL`).bind(isRead ? 1 : 0, id).run();
}

export function markFlagged(db: D1Database, id: string, isFlagged: boolean): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET is_flagged = ? WHERE id = ? AND deleted_at IS NULL`).bind(isFlagged ? 1 : 0, id).run();
}

export function deleteEmail(db: D1Database, id: string): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).bind(id).run();
}

export function restoreEmail(db: D1Database, id: string): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL`).bind(id).run();
}

export async function stagePurgeDeleted(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO ingestion_registry
      (ingest_key, email_id, storage_generation, state)
      SELECT COALESCE(ingest_key, id), id, storage_generation, 'active'
      FROM emails WHERE deleted_at IS NOT NULL`),
    db.prepare(`UPDATE ingestion_registry SET state = 'cleanup_pending',
      claim_token = NULL, claim_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE email_id IN (SELECT id FROM emails WHERE deleted_at IS NOT NULL)
        AND state <> 'cleanup_claimed'`),
    db.prepare(`DELETE FROM cleanup_outbox
      WHERE email_id IN (SELECT id FROM emails WHERE deleted_at IS NOT NULL)
        AND completed_at IS NOT NULL`),
    db.prepare(`INSERT OR IGNORE INTO cleanup_outbox
      (id, object_key, object_kind, email_id, storage_generation)
      SELECT lower(hex(randomblob(16))), r2_key, 'raw', id, storage_generation
      FROM emails WHERE deleted_at IS NOT NULL AND r2_key IS NOT NULL`),
    db.prepare(`INSERT OR IGNORE INTO cleanup_outbox
      (id, object_key, object_kind, email_id, storage_generation)
      SELECT lower(hex(randomblob(16))), a.r2_key, 'attachment', a.email_id, a.storage_generation
      FROM attachments a JOIN emails e ON e.id = a.email_id WHERE e.deleted_at IS NOT NULL`),
    db.prepare(`DELETE FROM emails WHERE deleted_at IS NOT NULL
      AND EXISTS (SELECT 1 FROM ingestion_registry r
        WHERE r.email_id = emails.id AND r.state = 'cleanup_pending')`),
  ]);
}

export interface CleanupItem {
  id: string;
  object_key: string;
  object_kind: string;
  email_id: string;
  storage_generation: number;
  claim_token: string;
}

export interface CleanupCandidate { email_id: string }

export async function listPendingCleanup(db: D1Database, limit: number): Promise<CleanupCandidate[]> {
  const result = await db.prepare(`SELECT r.email_id
    FROM ingestion_registry r
    WHERE (
      r.state = 'cleanup_pending'
      OR (r.state = 'cleanup_claimed' AND r.claim_expires_at <= CURRENT_TIMESTAMP)
    ) AND EXISTS (
      SELECT 1 FROM cleanup_outbox o
      WHERE o.email_id = r.email_id AND o.completed_at IS NULL
        AND o.next_attempt_at <= CURRENT_TIMESTAMP
    )
    ORDER BY r.updated_at, r.email_id LIMIT ?`).bind(limit).all<CleanupCandidate>();
  return result.results || [];
}

export async function claimCleanup(
  db: D1Database,
  emailId: string,
  claimToken: string,
  leaseSeconds = 300,
): Promise<CleanupItem[]> {
  const lease = Math.max(30, Math.min(900, Math.trunc(leaseSeconds)));
  await db.batch([
    db.prepare(`UPDATE ingestion_registry SET state = 'cleanup_claimed', claim_token = ?,
      claim_expires_at = datetime('now', '+' || ? || ' seconds'), updated_at = CURRENT_TIMESTAMP
      WHERE email_id = ? AND (
        state = 'cleanup_pending'
        OR (state = 'cleanup_claimed' AND claim_expires_at <= CURRENT_TIMESTAMP)
      )`).bind(claimToken, lease, emailId),
    db.prepare(`UPDATE cleanup_outbox SET claim_token = ?,
      claim_expires_at = datetime('now', '+' || ? || ' seconds')
      WHERE email_id = ? AND completed_at IS NULL
        AND EXISTS (SELECT 1 FROM ingestion_registry r
          WHERE r.email_id = cleanup_outbox.email_id
            AND r.state = 'cleanup_claimed' AND r.claim_token = ?)`)
      .bind(claimToken, lease, emailId, claimToken),
  ]);
  const result = await db.prepare(`SELECT id, object_key, object_kind, email_id,
      storage_generation, claim_token
    FROM cleanup_outbox WHERE email_id = ? AND completed_at IS NULL AND claim_token = ?
    ORDER BY id`).bind(emailId, claimToken).all<CleanupItem>();
  return result.results || [];
}

export async function completeCleanup(db: D1Database, emailId: string, claimToken: string): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE cleanup_outbox SET completed_at = CURRENT_TIMESTAMP,
      last_error = NULL, claim_expires_at = NULL
      WHERE email_id = ? AND completed_at IS NULL AND claim_token = ?`)
      .bind(emailId, claimToken),
    db.prepare(`UPDATE ingestion_registry SET state = 'cleaned', claim_token = NULL,
      claim_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE email_id = ? AND state = 'cleanup_claimed' AND claim_token = ?`)
      .bind(emailId, claimToken),
  ]);
}

export async function failCleanup(db: D1Database, emailId: string, claimToken: string): Promise<void> {
  await db.batch([
    db.prepare(`UPDATE cleanup_outbox SET attempts = attempts + 1,
      next_attempt_at = datetime('now', '+' || min(3600, (attempts + 1) * 60) || ' seconds'),
      last_error = 'delete_failed', claim_token = NULL, claim_expires_at = NULL
      WHERE email_id = ? AND completed_at IS NULL AND claim_token = ?`)
      .bind(emailId, claimToken),
    db.prepare(`UPDATE ingestion_registry SET state = 'cleanup_pending', claim_token = NULL,
      claim_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE email_id = ? AND state = 'cleanup_claimed' AND claim_token = ?`)
      .bind(emailId, claimToken),
  ]);
}

export async function cleanupStatus(db: D1Database): Promise<{ pending: number; failed: number; readyEmails: number }> {
  const row = await db.prepare(`SELECT
    SUM(CASE WHEN completed_at IS NULL THEN 1 ELSE 0 END) AS pending,
    SUM(CASE WHEN completed_at IS NULL AND attempts > 0 THEN 1 ELSE 0 END) AS failed,
    (SELECT COUNT(*) FROM ingestion_registry r
      WHERE (r.state = 'cleanup_pending'
        OR (r.state = 'cleanup_claimed' AND r.claim_expires_at <= CURRENT_TIMESTAMP))
      AND EXISTS (SELECT 1 FROM cleanup_outbox ready
        WHERE ready.email_id = r.email_id AND ready.completed_at IS NULL
          AND ready.next_attempt_at <= CURRENT_TIMESTAMP)) AS ready_emails
    FROM cleanup_outbox`).first<{ pending: number | null; failed: number | null; ready_emails: number | null }>();
  return {
    pending: Number(row?.pending || 0),
    failed: Number(row?.failed || 0),
    readyEmails: Number(row?.ready_emails || 0),
  };
}

export async function listDeletedEmails(db: D1Database, opts: ListEmailsOptions): Promise<PageResult> {
  const query = opts.q?.trim();
  const alias = query ? 'e.' : '';
  const conditions = [`${alias}deleted_at IS NOT NULL`, `${alias}storage_state = 'active'`];
  const params: unknown[] = [];
  if (query) {
    const ftsQuery = query.split(/\s+/).filter(Boolean)
      .map(term => `"${term.replace(/"/g, '""')}"*`).join(' AND ');
    conditions.unshift('emails_fts MATCH ?');
    params.push(ftsQuery);
  }
  if (opts.domain) { conditions.push(`${alias}domain = ?`); params.push(opts.domain); }
  if (opts.cursor) {
    const cursor = decodeCursor(opts.cursor, 'deleted');
    conditions.push(`(${alias}deleted_at < ? OR (${alias}deleted_at = ? AND ${alias}id < ?))`);
    params.push(cursor.v, cursor.v, cursor.i);
  }
  params.push(opts.limit + 1);
  const from = query ? 'emails_fts f JOIN emails e ON e.rowid = f.rowid' : 'emails';
  const result = await db.prepare(`SELECT ${alias}id, ${alias}domain, ${alias}mail_from,
    ${alias}rcpt_to, ${alias}subject, ${alias}date, ${alias}is_read, ${alias}is_flagged,
    ${alias}created_at, ${alias}deleted_at FROM ${from} WHERE ${conditions.join(' AND ')}
    ORDER BY ${alias}deleted_at DESC, ${alias}id DESC LIMIT ?`).bind(...params)
    .all<EmailListRow & { deleted_at: string }>();
  const rows = result.results || [];
  const hasMore = rows.length > opts.limit;
  const emails = hasMore ? rows.slice(0, opts.limit) : rows;
  const last = emails[emails.length - 1] as (EmailListRow & { deleted_at: string }) | undefined;
  return { emails, cursor: hasMore && last ? encodeCursor({ k: 'deleted', v: last.deleted_at, i: last.id }) : null };
}

export interface RecipientGroup { rcpt_user: string; total: number; unread: number; last_date: string }
export interface DomainWithRecipients { domain: string; count: number; recipients: RecipientGroup[] }

export async function listRecipientGroups(db: D1Database, domain?: string): Promise<{ recipients: RecipientGroup[] }> {
  const params: unknown[] = [];
  let filter = `deleted_at IS NULL AND storage_state = 'active'`;
  if (domain) { filter += ' AND domain = ?'; params.push(domain); }
  const result = await db.prepare(`SELECT SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) AS rcpt_user,
    COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
    MAX(date) AS last_date FROM emails WHERE ${filter} GROUP BY rcpt_user ORDER BY last_date DESC`)
    .bind(...params).all<RecipientGroup>();
  return { recipients: result.results || [] };
}

export async function getDomainsWithRecipients(db: D1Database): Promise<{ domains: DomainWithRecipients[] }> {
  const domainsResult = await db.prepare(`SELECT domain, COUNT(*) AS count FROM emails
    WHERE deleted_at IS NULL AND storage_state = 'active' GROUP BY domain ORDER BY domain`)
    .all<{ domain: string; count: number }>();
  const domains = domainsResult.results || [];
  if (!domains.length) return { domains: [] };
  const recipientsResult = await db.prepare(`SELECT domain,
    SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) AS rcpt_user,
    COUNT(*) AS total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
    MAX(date) AS last_date FROM emails WHERE deleted_at IS NULL AND storage_state = 'active'
    GROUP BY domain, rcpt_user ORDER BY domain, last_date DESC`).all<{ domain: string } & RecipientGroup>();
  const byDomain = new Map<string, RecipientGroup[]>();
  for (const row of recipientsResult.results || []) {
    const { domain, ...group } = row;
    const current = byDomain.get(domain) || []; current.push(group); byDomain.set(domain, current);
  }
  return { domains: domains.map(row => ({ ...row, recipients: byDomain.get(row.domain) || [] })) };
}

export function getDomains(db: D1Database): Promise<D1Result<{ domain: string; count: number }>> {
  return db.prepare(`SELECT domain, COUNT(*) AS count FROM emails
    WHERE deleted_at IS NULL AND storage_state = 'active' GROUP BY domain ORDER BY domain`).all();
}

export async function checkRateLimit(db: D1Database, maxPerHour: number): Promise<boolean> {
  if (maxPerHour <= 0) return true;
  try {
    const result = await db.prepare(`SELECT COUNT(*) AS cnt FROM emails
      WHERE cast(strftime('%s', created_at) as integer) > cast(strftime('%s', 'now', '-1 hour') as integer)`)
      .first<{ cnt: number }>();
    return !result || result.cnt < maxPerHour;
  } catch {
    console.error('rate_limit_query_failed');
    return true;
  }
}

export interface SinceRow {
  id: string;
  mail_from: string;
  subject: string;
  created_at: string;
  activation_seq: number;
}

export async function getActivationWatermark(db: D1Database): Promise<{ seq: number; id: string }> {
  const row = await db.prepare(`SELECT activation_seq AS seq, id FROM emails
    WHERE deleted_at IS NULL AND storage_state = 'active' AND activation_seq IS NOT NULL
    ORDER BY activation_seq DESC, id DESC LIMIT 1`).first<{ seq: number; id: string }>();
  return { seq: Number(row?.seq || 0), id: row?.id || '' };
}

export async function listEmailsSince(
  db: D1Database,
  options: { cursor?: string; seq?: number; id?: string; limit: number },
): Promise<{ emails: SinceRow[]; cursor: string | null }> {
  let sequence = options.seq ?? 0;
  let id = options.id || '';
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor, 'activation');
    sequence = Number(decoded.v);
    id = decoded.i;
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new InvalidCursorError();
  const result = await db.prepare(`SELECT id, mail_from, subject, created_at, activation_seq
    FROM emails
    WHERE deleted_at IS NULL AND storage_state = 'active' AND activation_seq IS NOT NULL
      AND (activation_seq > ? OR (activation_seq = ? AND id > ?))
    ORDER BY activation_seq ASC, id ASC LIMIT ?`)
    .bind(sequence, sequence, id, options.limit + 1).all<SinceRow>();
  const rows = result.results || [];
  const hasMore = rows.length > options.limit;
  const emails = hasMore ? rows.slice(0, options.limit) : rows;
  const last = emails[emails.length - 1];
  return {
    emails,
    cursor: hasMore && last
      ? encodeCursor({ k: 'activation', v: String(last.activation_seq), i: last.id })
      : null,
  };
}

export interface ObjectReference { id: string; kind: 'raw' | 'attachment'; object_key: string }
export async function listObjectReferences(db: D1Database, cursor: string | undefined, limit: number): Promise<{ items: ObjectReference[]; cursor: string | null }> {
  let after = '';
  let afterId = '';
  if (cursor) {
    const decoded = decodeCursor(cursor, 'object');
    after = decoded.v;
    afterId = decoded.i;
  }
  const result = await db.prepare(`SELECT id, kind, object_key FROM (
      SELECT id, 'raw' AS kind, r2_key AS object_key FROM emails
        WHERE storage_state = 'active' AND r2_key IS NOT NULL
      UNION ALL
      SELECT id, 'attachment' AS kind, r2_key AS object_key FROM attachments
        WHERE storage_state = 'active'
    ) WHERE object_key > ? OR (object_key = ? AND id > ?)
    ORDER BY object_key, id LIMIT ?`).bind(after, after, afterId, limit + 1).all<ObjectReference>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, cursor: hasMore && last ? encodeCursor({ k: 'object', v: last.object_key, i: last.id }) : null };
}
