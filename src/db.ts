// D1 database queries

import type { EmailRow, AttachmentRow, EmailListRow } from './types';

const EMAIL_FIELDS = `
  id, domain, mail_from, rcpt_to, subject,
  body_text, body_html, date, r2_key,
  is_read, is_flagged, is_spam, created_at
`;

export function insertEmail(db: D1Database, email: EmailRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO emails (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key, is_read, is_flagged, is_spam)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`
    )
    .bind(
      email.id,
      email.domain,
      email.mail_from,
      email.rcpt_to,
      email.subject,
      email.body_text,
      email.body_html,
      email.date,
      email.r2_key
    )
    .run();
}

export function insertAttachment(db: D1Database, att: AttachmentRow): Promise<D1Result> {
  return db
    .prepare(
      `INSERT INTO attachments (id, email_id, filename, content_type, size, r2_key)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(att.id, att.email_id, att.filename, att.content_type, att.size, att.r2_key)
    .run();
}

export interface ListEmailsOptions {
  domain?: string;
  q?: string;
  cursor?: string;
  limit: number;
  rcptUser?: string;
}

// ============================================================
// FTS5 search
// ============================================================

export async function searchEmails(
  db: D1Database,
  opts: ListEmailsOptions
): Promise<{ emails: EmailListRow[]; cursor: string | null }> {
  const limit = Math.min(opts.limit || 50, 100);
  const params: unknown[] = [];
  let query: string;

  // Build FTS query — support multi-word AND search
  // Each token is matched against all indexed columns via FTS5
  const ftsQuery = (opts.q || '').trim().split(/\s+/).filter(Boolean).map(t => `"${t.replace(/"/g, '""')}"`).join(' AND ');

  if (opts.domain && opts.rcptUser) {
    // Domain + recipient filter
    query = `
      SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date, e.is_read, e.is_flagged, e.created_at
      FROM emails_fts f
      JOIN emails e ON e.rowid = f.rowid AND e.deleted_at IS NULL
      WHERE emails_fts MATCH ?
        AND e.domain = ?
        AND SUBSTR(e.rcpt_to, 1, INSTR(e.rcpt_to, '@') - 1) = ?
      ORDER BY e.date DESC LIMIT ?`;
    params.push(ftsQuery, opts.domain, opts.rcptUser, limit + 1);
  } else if (opts.domain) {
    query = `
      SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date, e.is_read, e.is_flagged, e.created_at
      FROM emails_fts f
      JOIN emails e ON e.rowid = f.rowid AND e.deleted_at IS NULL
      WHERE emails_fts MATCH ? AND e.domain = ?
      ORDER BY e.date DESC LIMIT ?`;
    params.push(ftsQuery, opts.domain, limit + 1);
  } else if (opts.rcptUser) {
    query = `
      SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date, e.is_read, e.is_flagged, e.created_at
      FROM emails_fts f
      JOIN emails e ON e.rowid = f.rowid AND e.deleted_at IS NULL
      WHERE emails_fts MATCH ?
        AND SUBSTR(e.rcpt_to, 1, INSTR(e.rcpt_to, '@') - 1) = ?
      ORDER BY e.date DESC LIMIT ?`;
    params.push(ftsQuery, opts.rcptUser, limit + 1);
  } else {
    // Global search
    query = `
      SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date, e.is_read, e.is_flagged, e.created_at
      FROM emails_fts f
      JOIN emails e ON e.rowid = f.rowid AND e.deleted_at IS NULL
      WHERE emails_fts MATCH ?
      ORDER BY e.date DESC LIMIT ?`;
    params.push(ftsQuery, limit + 1);
  }

  // Cursor-based pagination for FTS results
  if (opts.cursor) {
    query = query.replace('ORDER BY e.date DESC LIMIT ?', 'AND e.date < ? ORDER BY e.date DESC LIMIT ?');
    params.splice(params.length - 1, 0, opts.cursor);
  }

  const result = await db.prepare(query).bind(...params).all<EmailListRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const emails = hasMore ? rows.slice(0, limit) : rows;
  const cursor = hasMore ? emails[emails.length - 1].date : null;

  return { emails, cursor };
}

export interface RecipientGroup {
  rcpt_user: string;
  total: number;
  unread: number;
  last_date: string;
}

export async function listRecipientGroups(
  db: D1Database,
  domain?: string
): Promise<{ recipients: RecipientGroup[] }> {
  let query = `
    SELECT
      SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) AS rcpt_user,
      COUNT(*) AS total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
      MAX(date) AS last_date
    FROM emails
    WHERE deleted_at IS NULL
  `;
  const params: unknown[] = [];

  if (domain) {
    query += ` AND domain = ?`;
    params.push(domain);
  }

  query += ` GROUP BY rcpt_user ORDER BY last_date DESC`;

  const result = await db.prepare(query).bind(...params).all<RecipientGroup>();
  return { recipients: result.results || [] };
}

export async function listEmails(
  db: D1Database,
  opts: ListEmailsOptions
): Promise<{ emails: EmailListRow[]; cursor: string | null }> {
  // Use FTS5 for search queries, regular query for browsing
  if (opts.q && opts.q.trim()) {
    return searchEmails(db, opts);
  }

  const limit = Math.min(opts.limit || 50, 100);
  let query = `SELECT id, domain, mail_from, rcpt_to, subject, date, is_read, is_flagged, created_at FROM emails WHERE deleted_at IS NULL`;
  const params: unknown[] = [];

  if (opts.domain) {
    query += ` AND domain = ?`;
    params.push(opts.domain);
  }
  if (opts.rcptUser) {
    query += ` AND SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) = ?`;
    params.push(opts.rcptUser);
  }

  query += ` ORDER BY date DESC LIMIT ?`;
  params.push(limit + 1);

  // Use cursor-based pagination — cursor is the last seen date
  if (opts.cursor) {
    query = query.replace('WHERE deleted_at IS NULL', 'WHERE deleted_at IS NULL AND date < ?');
    params.unshift(opts.cursor);
  }

  const result = await db.prepare(query).bind(...params).all<EmailListRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const emails = hasMore ? rows.slice(0, limit) : rows;
  const cursor = hasMore ? emails[emails.length - 1].date : null;

  return { emails, cursor };
}

export function getEmail(db: D1Database, id: string): Promise<EmailRow | null> {
  return db.prepare(`SELECT ${EMAIL_FIELDS} FROM emails WHERE id = ? AND deleted_at IS NULL`).bind(id).first();
}

export function getAttachments(db: D1Database, emailId: string): Promise<D1Result<AttachmentRow>> {
  return db.prepare(`SELECT id, email_id, filename, content_type, size, r2_key FROM attachments WHERE email_id = ?`).bind(emailId).all<AttachmentRow>();
}

export function markRead(db: D1Database, id: string, isRead: boolean): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET is_read = ? WHERE id = ?`).bind(isRead ? 1 : 0, id).run();
}

export function markFlagged(db: D1Database, id: string, isFlagged: boolean): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET is_flagged = ? WHERE id = ?`).bind(isFlagged ? 1 : 0, id).run();
}

export function deleteEmail(db: D1Database, id: string): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`).bind(id).run();
}

export function restoreEmail(db: D1Database, id: string): Promise<D1Result> {
  return db.prepare(`UPDATE emails SET deleted_at = NULL WHERE id = ?`).bind(id).run();
}

export function purgeDeleted(db: D1Database): Promise<D1Result> {
  return db.prepare(`DELETE FROM emails WHERE deleted_at IS NOT NULL`).run();
}

export async function listDeletedEmails(
  db: D1Database,
  opts: ListEmailsOptions
): Promise<{ emails: EmailListRow[]; cursor: string | null }> {
  const limit = Math.min(opts.limit || 50, 100);
  let query = `SELECT id, domain, mail_from, rcpt_to, subject, date, is_read, is_flagged, created_at FROM emails WHERE deleted_at IS NOT NULL`;
  const params: unknown[] = [];

  if (opts.domain) {
    query += ` AND domain = ?`;
    params.push(opts.domain);
  }
  if (opts.q) {
    query += ` AND (subject LIKE ? OR mail_from LIKE ? OR rcpt_to LIKE ?)`;
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }

  query += ` ORDER BY deleted_at DESC LIMIT ?`;
  params.push(limit + 1);

  if (opts.cursor) {
    query = query.replace('WHERE deleted_at IS NOT NULL', 'WHERE deleted_at IS NOT NULL AND deleted_at < ?');
    params.unshift(opts.cursor);
  }

  const result = await db.prepare(query).bind(...params).all<EmailListRow>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const emails = hasMore ? rows.slice(0, limit) : rows;
  const cursor = hasMore ? emails[emails.length - 1].date : null;

  return { emails, cursor };
}

export interface DomainWithRecipients {
  domain: string;
  count: number;
  recipients: RecipientGroup[];
}

export async function getDomainsWithRecipients(db: D1Database): Promise<{ domains: DomainWithRecipients[] }> {
  // Single query for domain counts
  const domainsResult = await db.prepare(
    `SELECT domain, COUNT(*) as count FROM emails WHERE deleted_at IS NULL GROUP BY domain ORDER BY domain`
  ).all<{ domain: string; count: number }>();
  const domains = domainsResult.results || [];
  if (domains.length === 0) return { domains: [] };

  // Single query for all recipient groups across all domains
  const recipientsResult = await db.prepare(`
    SELECT
      domain,
      SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) AS rcpt_user,
      COUNT(*) AS total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
      MAX(date) AS last_date
    FROM emails
    WHERE deleted_at IS NULL
    GROUP BY domain, rcpt_user
    ORDER BY domain, last_date DESC
  `).all<{ domain: string } & RecipientGroup>();

  // Group recipients by domain in memory
  const recipientsByDomain = new Map<string, RecipientGroup[]>();
  for (const r of (recipientsResult.results || [])) {
    const { domain, ...group } = r;
    const list = recipientsByDomain.get(domain);
    if (list) list.push(group);
    else recipientsByDomain.set(domain, [group]);
  }

  return {
    domains: domains.map(d => ({
      domain: d.domain,
      count: d.count,
      recipients: recipientsByDomain.get(d.domain) || [],
    })),
  };
}

export function getDomains(db: D1Database): Promise<D1Result<{ domain: string; count: number }[]>> {
  return db.prepare(`SELECT domain, COUNT(*) as count FROM emails WHERE deleted_at IS NULL GROUP BY domain ORDER BY domain`).all();
}
