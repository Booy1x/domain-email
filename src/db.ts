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

  // Build FTS query — support multi-word AND search
  const ftsQuery = (opts.q || '').trim().split(/\s+/).filter(Boolean).map(t => `"${t.replace(/"/g, '""')}"*`).join(' AND ');

  const conditions: string[] = ['emails_fts MATCH ?'];
  params.push(ftsQuery);

  if (opts.domain) {
    conditions.push('e.domain = ?');
    params.push(opts.domain);
  }
  if (opts.rcptUser) {
    conditions.push("SUBSTR(e.rcpt_to, 1, INSTR(e.rcpt_to, '@') - 1) = ?");
    params.push(opts.rcptUser);
  }
  if (opts.cursor) {
    conditions.push('e.date < ?');
    params.push(opts.cursor);
  }

  const where = conditions.join(' AND ');
  const query = `
    SELECT e.id, e.domain, e.mail_from, e.rcpt_to, e.subject, e.date, e.is_read, e.is_flagged, e.created_at
    FROM emails_fts f
    JOIN emails e ON e.rowid = f.rowid AND e.deleted_at IS NULL
    WHERE ${where}
    ORDER BY e.date DESC LIMIT ?`;
  params.push(limit + 1);

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
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (opts.domain) {
    conditions.push('domain = ?');
    params.push(opts.domain);
  }
  if (opts.rcptUser) {
    conditions.push("SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1) = ?");
    params.push(opts.rcptUser);
  }
  if (opts.cursor) {
    conditions.push('date < ?');
    params.push(opts.cursor);
  }

  params.push(limit + 1);
  const query = `SELECT id, domain, mail_from, rcpt_to, subject, date, is_read, is_flagged, created_at FROM emails WHERE ${conditions.join(' AND ')} ORDER BY date DESC LIMIT ?`;

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

export async function purgeDeleted(db: D1Database): Promise<{ emailKeys: string[]; attachmentKeys: string[] }> {
  const [emailsResult, attachmentsResult] = await Promise.all([
    db.prepare(`SELECT r2_key FROM emails WHERE deleted_at IS NOT NULL AND r2_key IS NOT NULL`).all<{ r2_key: string }>(),
    db.prepare(`SELECT a.r2_key FROM attachments a JOIN emails e ON a.email_id = e.id WHERE e.deleted_at IS NOT NULL`).all<{ r2_key: string }>(),
  ]);
  await db.prepare(`DELETE FROM emails WHERE deleted_at IS NOT NULL`).run();
  return {
    emailKeys: (emailsResult.results || []).map(r => r.r2_key),
    attachmentKeys: (attachmentsResult.results || []).map(r => r.r2_key),
  };
}

export async function listDeletedEmails(
  db: D1Database,
  opts: ListEmailsOptions
): Promise<{ emails: EmailListRow[]; cursor: string | null }> {
  const limit = Math.min(opts.limit || 50, 100);
  const conditions: string[] = ['deleted_at IS NOT NULL'];
  const params: unknown[] = [];

  if (opts.domain) {
    conditions.push('domain = ?');
    params.push(opts.domain);
  }
  if (opts.q) {
    conditions.push('(subject LIKE ? OR mail_from LIKE ? OR rcpt_to LIKE ?)');
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  if (opts.cursor) {
    conditions.push('deleted_at < ?');
    params.push(opts.cursor);
  }

  params.push(limit + 1);
  const query = `SELECT id, domain, mail_from, rcpt_to, subject, date, is_read, is_flagged, created_at, deleted_at FROM emails WHERE ${conditions.join(' AND ')} ORDER BY deleted_at DESC LIMIT ?`;

  const result = await db.prepare(query).bind(...params).all<EmailListRow & { deleted_at: string }>();
  const rows = result.results || [];
  const hasMore = rows.length > limit;
  const emails = hasMore ? rows.slice(0, limit) : rows;
  const cursor = hasMore ? emails[emails.length - 1].deleted_at : null;

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

export function getDomains(db: D1Database): Promise<D1Result<{ domain: string; count: number }>> {
  return db.prepare(`SELECT domain, COUNT(*) as count FROM emails WHERE deleted_at IS NULL GROUP BY domain ORDER BY domain`).all();
}

export async function checkSenderRateLimit(
  db: D1Database,
  senderDomain: string,
  windowMinutes: number,
  maxEmails: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const result = await db
    .prepare(`SELECT COUNT(*) as cnt FROM emails WHERE mail_from LIKE ? AND created_at > ?`)
    .bind(`%@${senderDomain}`, since)
    .first<{ cnt: number }>();
  return (result?.cnt || 0) >= maxEmails;
}

export async function checkRateLimit(db: D1Database, maxPerHour: number): Promise<boolean> {
  if (maxPerHour <= 0) return true;
  try {
    const result = await db.prepare(
      `SELECT COUNT(*) as cnt FROM emails WHERE cast(strftime('%s', created_at) as integer) > cast(strftime('%s', 'now', '-1 hour') as integer)`
    ).first<{ cnt: number }>();
    return !result || result.cnt < maxPerHour;
  } catch (e) {
    console.error('checkRateLimit failed, allowing email:', e);
    return true;
  }
}

export async function listEmailsSince(
  db: D1Database,
  ts: string
): Promise<{ id: string; mail_from: string; subject: string; created_at: string }[]> {
  const result = await db
    .prepare('SELECT id, mail_from, subject, created_at FROM emails WHERE created_at > ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10')
    .bind(ts)
    .all<{ id: string; mail_from: string; subject: string; created_at: string }>();
  return result.results || [];
}
