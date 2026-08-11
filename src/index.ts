import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseEmail, PayloadTooLargeError, streamToBuffer } from './mime';
import { inboxPage } from './frontend/index';
import { sanitizeHtml } from './sanitize';
import { assertQueryLength, getLimits, parsePageLimit } from './limits';
import type { AttachmentRow, EmailRow, Env, PublicAttachment } from './types';
import {
  InvalidCursorError, activateIngestion, checkRateLimit, claimCleanup, cleanupStatus, completeCleanup,
  deleteEmail, failCleanup, getActivationWatermark, getAttachment, getAttachments, getDomainsWithRecipients,
  getEmail, insertSentEmail, listDeletedEmails, listEmails, listEmailsSince, listSentEmails,
  listObjectReferences, listPendingCleanup, markFlagged, markRead, reserveIngestion, restoreEmail,
  stageIngestion, stagePurgeDeleted,
} from './db';

const textEncoder = new TextEncoder();
const D1_SAFE_TEXT_VALUE_BYTES = 1024 * 1024;
const D1_SAFE_EMAIL_TEXT_BYTES = 1536 * 1024;
const D1_EMAIL_NON_TEXT_RESERVE_BYTES = 4096;

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}

function fitsD1TextBudget(values: string[], totalLimit = D1_SAFE_EMAIL_TEXT_BYTES): boolean {
  let total = 0;
  for (const value of values) {
    const size = byteLength(value);
    if (size > D1_SAFE_TEXT_VALUE_BYTES) return false;
    total += size;
    if (total > totalLimit) return false;
  }
  return true;
}

async function sha256Hex(parts: Array<string | Uint8Array>): Promise<string> {
  const encoded = parts.map(part => typeof part === 'string' ? textEncoder.encode(part) : part);
  const total = encoded.reduce((sum, part) => sum + part.length, 0);
  const input = new Uint8Array(total);
  let offset = 0;
  for (const part of encoded) { input.set(part, offset); offset += part.length; }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function mapWithConcurrency<T>(items: T[], concurrency: number, operation: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      await operation(items[index], index);
    }
  });
  await Promise.all(workers);
}

export interface PublicEmailDetail {
  id: string;
  domain: string;
  mail_from: string;
  rcpt_to: string;
  subject: string;
  body_text: string;
  body_html: string;
  date: string;
  is_read: number;
  is_flagged: number;
  is_spam: number;
  created_at: string;
  attachment_count: number;
  attachment_total_size: number;
  direction: string;
}

export function sanitizeEmailRow(email: EmailRow): PublicEmailDetail {
  let bodyHtml = '';
  if (email.body_html && byteLength(email.body_html) <= 2 * 1024 * 1024) {
    try {
      bodyHtml = sanitizeHtml(email.body_html);
    } catch {
      // Never return attacker-controlled HTML when sanitization fails.
      bodyHtml = '';
    }
  }
  let date = email.date || '';
  if (date && Number.isNaN(new Date(date).getTime())) date = email.created_at || new Date(0).toISOString();
  return {
    id: email.id,
    domain: email.domain,
    mail_from: email.mail_from || '',
    rcpt_to: email.rcpt_to || '',
    subject: email.subject || '',
    body_text: email.body_text || '',
    body_html: bodyHtml,
    date,
    is_read: email.is_read,
    is_flagged: email.is_flagged,
    is_spam: email.is_spam,
    created_at: email.created_at,
    attachment_count: email.attachment_count || 0,
    attachment_total_size: email.attachment_total_size || 0,
    direction: email.direction || 'in',
  };
}

function publicAttachment(row: AttachmentRow): PublicAttachment {
  return {
    id: row.id,
    email_id: row.email_id,
    filename: row.filename,
    content_type: row.content_type,
    size: row.size,
    created_at: row.created_at,
    object_status: 'unknown',
  };
}

function safeDownloadName(value: string, fallback: string): { ascii: string; encoded: string } {
  const cleaned = value.replace(/[\u0000-\u001f\u007f"'\\/]/g, '_').trim().slice(0, 180) || fallback;
  const ascii = cleaned.replace(/[^\x20-\x7e]/g, '_');
  return { ascii, encoded: encodeURIComponent(cleaned) };
}

function setDownloadHeaders(headers: Headers, filename: string, contentType: string): void {
  const safe = safeDownloadName(filename, 'download');
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase();
  const safeContentType = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
    ? mediaType : 'application/octet-stream';
  headers.set('Content-Type', safeContentType);
  headers.set('Content-Disposition', `attachment; filename="${safe.ascii}"; filename*=UTF-8''${safe.encoded}`);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Pragma', 'no-cache');
}

function validOpaqueId(value: string): boolean {
  return value.length >= 8 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

export async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  const limits = getLimits(env);
  const maxPerHour = Number.parseInt(env.MAX_EMAILS_PER_HOUR || '0', 10);
  if (Number.isFinite(maxPerHour) && maxPerHour > 0 && !await checkRateLimit(env.INBOX_DB, maxPerHour)) {
    message.setReject('Mailbox rate limit exceeded');
    console.warn('email_rejected_rate_limit');
    return;
  }
  if (message.rawSize > limits.rawBytes) {
    message.setReject('Message too large');
    console.warn('email_rejected_raw_limit');
    return;
  }

  let rawBuffer: Uint8Array;
  try {
    rawBuffer = await streamToBuffer(message.raw, limits.rawBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      message.setReject('Message too large');
      console.warn('email_rejected_raw_limit');
      return;
    }
    throw error;
  }

  const recipient = (message.to || '').trim().toLowerCase();
  const ingestKey = await sha256Hex([recipient, '\0', rawBuffer]);
  const emailId = ingestKey;

  const parsed = await parseEmail(rawBuffer);
  const bodyTextSize = byteLength(parsed.bodyText || '');
  const bodyHtmlSize = byteLength(parsed.bodyHtml || '');
  const attachmentTotalSize = parsed.attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  if (bodyTextSize > limits.bodyPartBytes || bodyHtmlSize > limits.bodyPartBytes
      || bodyTextSize + bodyHtmlSize > limits.bodyTotalBytes) {
    message.setReject('Message body too large');
    console.warn('email_rejected_body_limit');
    return;
  }
  const metadataValues = [
    emailId, recipient, parsed.from || '', message.to || '', parsed.subject || '',
    parsed.bodyText || '', parsed.bodyHtml || '',
  ];
  if (!fitsD1TextBudget(metadataValues, D1_SAFE_EMAIL_TEXT_BYTES - D1_EMAIL_NON_TEXT_RESERVE_BYTES)
      || parsed.attachments.some(attachment => !fitsD1TextBudget([
        attachment.filename || 'attachment', attachment.contentType || 'application/octet-stream',
      ]))) {
    message.setReject('Message metadata too large');
    console.warn('email_rejected_metadata_limit');
    return;
  }
  if (parsed.attachments.length > limits.attachmentCount) {
    message.setReject('Too many attachments');
    console.warn('email_rejected_attachment_count');
    return;
  }
  if (parsed.attachments.some(attachment => attachment.size > limits.attachmentBytes)) {
    message.setReject('Attachment too large');
    console.warn('email_rejected_attachment_limit');
    return;
  }
  if (attachmentTotalSize > limits.attachmentsTotalBytes) {
    message.setReject('Attachments too large');
    console.warn('email_rejected_attachment_total_limit');
    return;
  }

  const reservation = await reserveIngestion(env.INBOX_DB, ingestKey, emailId);
  if (reservation.state === 'active') return;
  if (reservation.state !== 'pending') {
    console.warn('email_ingest_deferred_cleanup', { email_id: emailId });
    throw new Error('email_cleanup_in_progress');
  }
  const generation = reservation.storage_generation;
  const rawKey = generation === 1 ? `raw/${emailId}.eml` : `raw/${emailId}.g${generation}.eml`;
  const createdAt = new Date().toISOString();
  const domain = recipient.includes('@') ? recipient.slice(recipient.lastIndexOf('@') + 1) : 'unknown';
  const emailDate = parsed.date && !Number.isNaN(parsed.date.getTime()) ? parsed.date.toISOString() : createdAt;
  const attachmentRows: AttachmentRow[] = [];
  for (let index = 0; index < parsed.attachments.length; index++) {
    const attachment = parsed.attachments[index];
    const attachmentId = await sha256Hex([emailId, ':', String(index)]);
    attachmentRows.push({
      id: attachmentId,
      email_id: emailId,
      filename: attachment.filename || 'attachment',
      content_type: attachment.contentType || 'application/octet-stream',
      size: attachment.size,
      r2_key: generation === 1
        ? `attachments/${attachmentId}`
        : `attachments/${attachmentId}.g${generation}`,
      storage_state: 'pending',
      storage_generation: generation,
    });
  }
  const emailRow: EmailRow = {
    id: emailId,
    domain,
    mail_from: parsed.from || '',
    rcpt_to: message.to || '',
    subject: parsed.subject || '',
    body_text: parsed.bodyText || '',
    body_html: parsed.bodyHtml || '',
    date: emailDate,
    r2_key: rawKey,
    is_read: 0,
    is_flagged: 0,
    is_spam: 0,
    created_at: createdAt,
    ingest_key: ingestKey,
    storage_state: 'pending',
    message_id: parsed.messageId,
    raw_size: rawBuffer.length,
    body_text_size: bodyTextSize,
    body_html_size: bodyHtmlSize,
    attachment_count: attachmentRows.length,
    attachment_total_size: attachmentTotalSize,
    storage_generation: generation,
  };

  await stageIngestion(env.INBOX_DB, emailRow, attachmentRows);
  try {
    await env.INBOX_BUCKET.put(rawKey, rawBuffer, { httpMetadata: { contentType: 'message/rfc822' } });
    await mapWithConcurrency(parsed.attachments, limits.objectConcurrency, async (attachment, index) => {
      const row = attachmentRows[index];
      await env.INBOX_BUCKET.put(row.r2_key, attachment.content, {
        httpMetadata: { contentType: row.content_type },
      });
    });
    await activateIngestion(env.INBOX_DB, ingestKey, emailId, generation);
    console.log('email_ingest_complete', { email_id: emailId });
  } catch {
    console.error('email_ingest_partial_failure', { email_id: emailId });
    throw new Error('email_ingest_incomplete');
  }
}

export interface CleanupProgress {
  processed: { emails: number; objects: number };
  failed: { emails: number; objects: number };
  pending: { objects: number; readyEmails: number };
  canContinue: boolean;
}

export async function processCleanup(env: Env): Promise<CleanupProgress> {
  const limits = getLimits(env);
  const candidates = await listPendingCleanup(env.INBOX_DB, limits.cleanupEmailsPerRun);
  let processedEmails = 0;
  let processedObjects = 0;
  let failedEmails = 0;
  let failedObjects = 0;
  for (const candidate of candidates) {
    const claimToken = crypto.randomUUID();
    const items = await claimCleanup(env.INBOX_DB, candidate.email_id, claimToken);
    if (!items.length) continue;
    let claimFailed = false;
    await mapWithConcurrency(items, limits.objectConcurrency, async item => {
      try {
        await env.INBOX_BUCKET.delete(item.object_key);
        processedObjects++;
      } catch {
        claimFailed = true;
        failedObjects++;
        console.error('cleanup_object_failed', { outbox_id: item.id });
      }
    });
    if (claimFailed) {
      failedEmails++;
      await failCleanup(env.INBOX_DB, candidate.email_id, claimToken);
    } else {
      processedEmails++;
      await completeCleanup(env.INBOX_DB, candidate.email_id, claimToken);
    }
  }
  const status = await cleanupStatus(env.INBOX_DB);
  return {
    processed: { emails: processedEmails, objects: processedObjects },
    failed: { emails: failedEmails, objects: failedObjects },
    pending: { objects: status.pending, readyEmails: status.readyEmails },
    canContinue: status.readyEmails > 0,
  };
}

export const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  const origin = c.env.CORS_ORIGIN || 'https://mail.525458.xyz';
  return cors({ origin, credentials: true })(c, next);
});

app.get('/', async c => {
  const data = await getDomainsWithRecipients(c.env.INBOX_DB);
  c.header('Cache-Control', 'private, no-store');
  return c.html(inboxPage(data.domains, c.env.APP_VERSION));
});

app.get('/api/emails', async c => {
  const limits = getLimits(c.env);
  const q = c.req.query('q');
  assertQueryLength(q, limits.queryLength);
  const limit = parsePageLimit(c.req.query('limit'), limits.pageSize);
  return c.json(await listEmails(c.env.INBOX_DB, {
    domain: c.req.query('domain'), q, rcptUser: c.req.query('rcpt_user'),
    cursor: c.req.query('cursor'), limit,
  }));
});

app.get('/api/emails/recent', async c => {
  const limits = getLimits(c.env);
  return c.json(await listEmails(c.env.INBOX_DB, { limit: parsePageLimit(c.req.query('limit'), limits.pageSize, 5) }));
});

app.get('/api/emails/since', async c => {
  const limits = getLimits(c.env);
  if (c.req.query('initial') === '1') {
    c.header('Cache-Control', 'private, no-store');
    return c.json({ emails: [], cursor: null, watermark: await getActivationWatermark(c.env.INBOX_DB) });
  }
  const rawSeq = c.req.query('seq');
  const sequence = rawSeq === undefined ? NaN : Number(rawSeq);
  if (!c.req.query('cursor') && (!Number.isSafeInteger(sequence) || sequence < 0)) {
    return c.json({ error: 'invalid seq param' }, 400);
  }
  const result = await listEmailsSince(c.env.INBOX_DB, {
    cursor: c.req.query('cursor'), seq: sequence, id: c.req.query('id'),
    limit: parsePageLimit(c.req.query('limit'), limits.pageSize, limits.pageSize),
  });
  c.header('Cache-Control', 'private, no-store');
  return c.json(result);
});

app.get('/api/emails/deleted', async c => {
  const limits = getLimits(c.env);
  const q = c.req.query('q');
  assertQueryLength(q, limits.queryLength);
  return c.json(await listDeletedEmails(c.env.INBOX_DB, {
    domain: c.req.query('domain'), q, cursor: c.req.query('cursor'),
    limit: parsePageLimit(c.req.query('limit'), limits.pageSize),
  }));
});

app.get('/api/emails/sent', async c => {
  const limits = getLimits(c.env);
  return c.json(await listSentEmails(c.env.INBOX_DB, {
    cursor: c.req.query('cursor'),
    limit: parsePageLimit(c.req.query('limit'), limits.pageSize),
  }));
});

app.delete('/api/emails/purge', async c => {
  if (c.req.header('X-Confirm-Destructive-Action') !== 'purge-deleted') {
    return c.json({ error: 'explicit confirmation required' }, 409);
  }
  await stagePurgeDeleted(c.env.INBOX_DB);
  return c.json({ ok: true, cleanup: await processCleanup(c.env) });
});

app.post('/api/maintenance/cleanup', async c => {
  if (c.req.header('X-Confirm-Destructive-Action') !== 'process-cleanup') {
    return c.json({ error: 'explicit confirmation required' }, 409);
  }
  return c.json({ ok: true, cleanup: await processCleanup(c.env) });
});

app.get('/api/maintenance/reconcile', async c => {
  const limits = getLimits(c.env);
  const limit = parsePageLimit(c.req.query('limit'), Math.min(limits.pageSize, 100), 50);
  const page = await listObjectReferences(c.env.INBOX_DB, c.req.query('cursor'), limit);
  const missing: Array<{ id: string; kind: string }> = [];
  const errors: Array<{ id: string; kind: string }> = [];
  let present = 0;
  await mapWithConcurrency(page.items, limits.objectConcurrency, async item => {
    try {
      if (await c.env.INBOX_BUCKET.head(item.object_key)) present++;
      else missing.push({ id: item.id, kind: item.kind });
    } catch {
      errors.push({ id: item.id, kind: item.kind });
      console.error('reconcile_object_check_failed', { object_id: item.id, object_kind: item.kind });
    }
  });
  c.header('Cache-Control', 'private, no-store');
  return c.json({
    checked: page.items.length,
    present,
    missingCount: missing.length,
    errorCount: errors.length,
    missing,
    errors,
    cursor: page.cursor,
    complete: page.cursor === null,
    cleanup: await cleanupStatus(c.env.INBOX_DB),
  });
});

app.get('/api/domains', async c => c.json((await getDomainsWithRecipients(c.env.INBOX_DB)).domains));

app.get('/api/emails/:id', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email) return c.json({ error: 'not found' }, 404);
  if (!email.body_html && !email.body_text && email.r2_key) {
    let object: R2ObjectBody | null = null;
    let readFailed = false;
    try {
      object = await c.env.INBOX_BUCKET.get(email.r2_key);
    } catch {
      readFailed = true;
      console.error('storage_object_read_failed', { object_id: id, object_kind: 'raw' });
    }
    if (!object && !readFailed) {
      console.warn('storage_object_missing', { object_id: id, object_kind: 'raw' });
    } else if (object) {
      try {
        const parsed = await parseEmail(new Uint8Array(await object.arrayBuffer()));
        email.body_html = parsed.bodyHtml || '';
        email.body_text = parsed.bodyText || '';
      } catch {
        console.error('raw_reparse_failed', { email_id: id });
      }
    }
  }
  c.header('Cache-Control', 'private, max-age=300');
  return c.json(sanitizeEmailRow(email));
});

app.get('/api/emails/:id/attachments', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const result = await getAttachments(c.env.INBOX_DB, id);
  const rows = (result.results || []) as AttachmentRow[];
  const attachments = rows.map(publicAttachment);
  const limits = getLimits(c.env);
  await mapWithConcurrency(rows, limits.objectConcurrency, async (row, index) => {
    try {
      attachments[index].object_status = await c.env.INBOX_BUCKET.head(row.r2_key) ? 'available' : 'missing';
    } catch {
      console.error('storage_object_check_failed', { object_id: row.id, object_kind: 'attachment' });
    }
  });
  c.header('Cache-Control', 'private, no-store');
  return c.json(attachments);
});

app.get('/api/attachments/:id', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const attachment = await getAttachment(c.env.INBOX_DB, id);
  if (!attachment) {
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'not found' }, 404);
  }
  let object: R2ObjectBody | null;
  try {
    object = await c.env.INBOX_BUCKET.get(attachment.r2_key);
  } catch {
    console.error('storage_object_read_failed', { object_id: id, object_kind: 'attachment' });
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'storage temporarily unavailable', code: 'storage_unavailable' }, 503);
  }
  if (!object) {
    console.warn('storage_object_missing', { object_id: id, object_kind: 'attachment' });
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'attachment content unavailable', code: 'object_missing' }, 410);
  }
  const headers = new Headers();
  setDownloadHeaders(headers, attachment.filename || 'attachment', attachment.content_type);
  return c.body(object.body, { headers });
});

app.get('/api/emails/:id/raw', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email) {
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'not found' }, 404);
  }
  if (!email.r2_key) {
    console.warn('storage_object_missing', { object_id: id, object_kind: 'raw' });
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'raw email content unavailable', code: 'object_missing' }, 410);
  }
  let object: R2ObjectBody | null;
  try {
    object = await c.env.INBOX_BUCKET.get(email.r2_key);
  } catch {
    console.error('storage_object_read_failed', { object_id: id, object_kind: 'raw' });
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'storage temporarily unavailable', code: 'storage_unavailable' }, 503);
  }
  if (!object) {
    console.warn('storage_object_missing', { object_id: id, object_kind: 'raw' });
    c.header('Cache-Control', 'private, no-store');
    return c.json({ error: 'raw email content unavailable', code: 'object_missing' }, 410);
  }
  const headers = new Headers();
  setDownloadHeaders(headers, `${email.subject || 'email'}.eml`, 'message/rfc822');
  return c.body(object.body, { headers });
});

app.patch('/api/emails/:id', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const body = await c.req.json<{ is_read?: unknown; is_flagged?: unknown }>();
  if (body.is_read !== undefined && typeof body.is_read !== 'boolean') return c.json({ error: 'invalid is_read' }, 400);
  if (body.is_flagged !== undefined && typeof body.is_flagged !== 'boolean') return c.json({ error: 'invalid is_flagged' }, 400);
  if (typeof body.is_read === 'boolean') await markRead(c.env.INBOX_DB, id, body.is_read);
  if (typeof body.is_flagged === 'boolean') await markFlagged(c.env.INBOX_DB, id, body.is_flagged);
  return c.json({ ok: true });
});

app.delete('/api/emails/:id', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  await deleteEmail(c.env.INBOX_DB, id);
  return c.json({ ok: true });
});

app.post('/api/emails/:id/restore', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  await restoreEmail(c.env.INBOX_DB, id);
  return c.json({ ok: true });
});

function cleanAddress(value: string): string {
  return (value || '').replace(/[<>]/g, '').trim();
}

app.post('/api/emails/:id/reply', async c => {
  const id = c.req.param('id');
  if (!validOpaqueId(id)) return c.json({ error: 'invalid id' }, 400);
  const body = await c.req.json<{ text?: unknown; subject?: unknown }>();
  if (typeof body.text !== 'string' || !body.text.trim()) {
    return c.json({ error: 'reply text is required' }, 400);
  }
  const text = body.text.trim();
  if (byteLength(text) > D1_SAFE_EMAIL_TEXT_BYTES) {
    return c.json({ error: 'reply text too long' }, 400);
  }
  const providedSubject = typeof body.subject === 'string' && body.subject.trim()
    ? body.subject.trim()
    : '';

  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email) return c.json({ error: 'not found' }, 404);
  if (email.direction === 'out') return c.json({ error: 'cannot reply to a sent email' }, 400);
  const from = cleanAddress(email.rcpt_to);
  const to = cleanAddress(email.mail_from);
  if (!from.includes('@')) return c.json({ error: 'original has no reply-to address' }, 400);
  if (!to.includes('@')) return c.json({ error: 'original has no sender address' }, 400);

  const maxPerHour = Number.parseInt(c.env.SEND_MAX_PER_HOUR || '0', 10);
  if (Number.isFinite(maxPerHour) && maxPerHour > 0 && !await checkRateLimit(c.env.INBOX_DB, maxPerHour)) {
    return c.json({ error: '发送频率超限，请稍后再试', code: 'send_rate_limited' }, 429);
  }
  if (!c.env.EMAIL) return c.json({ error: 'sending is not configured', code: 'send_unavailable' }, 501);

  const headers: Record<string, string> = {};
  if (email.message_id) {
    const originalId = `<${email.message_id}>`;
    headers['In-Reply-To'] = originalId;
    headers.References = email.references_text ? `${email.references_text} ${originalId}` : originalId;
  }
  const subject = providedSubject || `Re: ${email.subject || ''}`;

  try {
    await c.env.EMAIL.send({
      to,
      from,
      subject,
      text,
      headers: Object.keys(headers).length ? headers : undefined,
    });
  } catch (error) {
    const code = (error as { code?: string }).code || '';
    console.error('email_send_failed', { code, email_id: id });
    if (code === 'E_SENDER_NOT_VERIFIED' || code === 'E_SENDER_DOMAIN_NOT_AVAILABLE') {
      return c.json({ error: '发信域名未配置或未验证', code }, 400);
    }
    if (code === 'E_RATE_LIMIT_EXCEEDED' || code === 'E_DAILY_LIMIT_EXCEEDED') {
      return c.json({ error: '今日发送额度已用完，请稍后再试', code }, 429);
    }
    if (code === 'E_CONTENT_TOO_LARGE' || code === 'E_TOO_MANY_RECIPIENTS' || code === 'E_TOO_MANY_ATTACHMENTS') {
      return c.json({ error: '邮件内容超出限制', code }, 400);
    }
    return c.json({ error: '发送失败，请稍后再试', code: code || 'send_failed' }, 500);
  }

  const createdAt = new Date().toISOString();
  const fromDomain = from.includes('@') ? from.slice(from.lastIndexOf('@') + 1) : 'unknown';
  const sentId = crypto.randomUUID();
  const sentRow: EmailRow = {
    id: sentId,
    domain: fromDomain,
    mail_from: from,
    rcpt_to: to,
    subject,
    body_text: text,
    body_html: '',
    date: createdAt,
    r2_key: null,
    is_read: 1,
    is_flagged: 0,
    is_spam: 0,
    created_at: createdAt,
    ingest_key: null,
    storage_state: 'active',
    message_id: `<${crypto.randomUUID()}@${fromDomain}>`,
    raw_size: byteLength(text),
    body_text_size: byteLength(text),
    body_html_size: 0,
    attachment_count: 0,
    attachment_total_size: 0,
    activation_seq: null,
    storage_generation: 1,
    direction: 'out',
    in_reply_to: email.message_id ?? null,
    references_text: headers.References || null,
  };
  await insertSentEmail(c.env.INBOX_DB, sentRow);
  return c.json({ ok: true, id: sentId });
});

app.onError((error, c) => {
  if (error instanceof InvalidCursorError || ['invalid_limit', 'query_too_long'].includes(error.message)) {
    return c.json({ error: error.message }, 400);
  }
  console.error('http_request_failed');
  return c.json({ error: 'internal error' }, 500);
});

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env);
  },
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
} satisfies ExportedHandler<Env>;
