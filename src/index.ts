import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseEmail, streamToBuffer } from './mime';
import { inboxPage } from './frontend';
import type { Env, EmailRow, AttachmentRow } from './types';
import {
  insertEmail, insertAttachment, listEmails, listDeletedEmails, getEmail,
  getAttachments, markRead, markFlagged, deleteEmail, restoreEmail, purgeDeleted,
  getDomains, getDomainsWithRecipients
} from './db';

// ============================================================
// Email handler — triggered by Cloudflare Email Routing
// ============================================================
async function handleEmail(
  message: ForwardableEmailMessage,
  env: Env,
): Promise<void> {
  // Buffer raw stream first (can only be consumed once)
  const rawBuffer = await streamToBuffer(message.raw);

  const parsed = await parseEmail(rawBuffer);

  const domain = message.to.includes('@')
    ? message.to.split('@')[1].toLowerCase()
    : 'unknown';

  const emailId = crypto.randomUUID();

  // Store raw email in R2
  const rawKey = `raw/${emailId}.eml`;
  await env.INBOX_BUCKET.put(rawKey, rawBuffer);

  // Insert email metadata into D1
  const emailRow: EmailRow = {
    id: emailId,
    domain,
    mail_from: parsed.from,
    rcpt_to: message.to,
    subject: parsed.subject,
    body_text: parsed.bodyText,
    body_html: parsed.bodyHtml,
    date: parsed.date.toISOString(),
    r2_key: rawKey,
    is_read: 0,
    is_flagged: 0,
    is_spam: 0,
    created_at: new Date().toISOString(),
  };

  await insertEmail(env.INBOX_DB, emailRow);

  // Store attachments in R2 + D1
  for (const att of parsed.attachments) {
    const attId = crypto.randomUUID();
    const attKey = `attachments/${emailId}/${att.filename}`;
    await env.INBOX_BUCKET.put(attKey, att.content, {
      httpMetadata: { contentType: att.contentType },
    });

    const attRow: AttachmentRow = {
      id: attId,
      email_id: emailId,
      filename: att.filename,
      content_type: att.contentType,
      size: att.size,
      r2_key: attKey,
    };
    await insertAttachment(env.INBOX_DB, attRow);
  }
}

// ============================================================
// HTTP handler — API + frontend
// ============================================================
const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors({ origin: '*' }));

// Frontend page
app.get('/', async (c) => {
  const data = await getDomainsWithRecipients(c.env.INBOX_DB);
  return c.html(inboxPage(data.domains));
});

// List emails
app.get('/api/emails', async (c) => {
  const domain = c.req.query('domain');
  const q = c.req.query('q');
  const rcptUser = c.req.query('rcpt_user');
  const cursor = c.req.query('cursor');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const result = await listEmails(c.env.INBOX_DB, { domain, q, rcptUser, cursor, limit });
  return c.json(result);
});

// Recent emails (global, no domain filter)
app.get('/api/emails/recent', async (c) => {
  const limit = parseInt(c.req.query('limit') || '5', 10);
  const result = await listEmails(c.env.INBOX_DB, { limit });
  return c.json(result);
});

// List domains with recipients
app.get('/api/domains', async (c) => {
  const data = await getDomainsWithRecipients(c.env.INBOX_DB);
  return c.json(data.domains);
});

// Get email detail
app.get('/api/emails/:id', async (c) => {
  const id = c.req.param('id');
  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email) return c.json({ error: 'not found' }, 404);
  return c.json(email);
});

// Get email attachments
app.get('/api/emails/:id/attachments', async (c) => {
  const id = c.req.param('id');
  const result = await getAttachments(c.env.INBOX_DB, id);
  const attRows = (result.results || []) as AttachmentRow[];
  return c.json(attRows);
});

// Get attachment content from R2
app.get('/api/attachments/:key', async (c) => {
  const key = c.req.param('key');
  const obj = await c.env.INBOX_BUCKET.get(key);
  if (!obj) return c.json({ error: 'not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');
  return c.body(obj.body, { headers });
});

// Download raw email
app.get('/api/emails/:id/raw', async (c) => {
  const id = c.req.param('id');
  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email || !email.r2_key) return c.json({ error: 'not found' }, 404);
  const obj = await c.env.INBOX_BUCKET.get(email.r2_key);
  if (!obj) return c.json({ error: 'raw email not found' }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `attachment; filename="${email.subject || 'email'}.eml"`);
  return c.body(obj.body, { headers });
});

// Mark read/flagged
app.patch('/api/emails/:id', async (c) => {
  const id = c.req.param('id');
  const body: { is_read?: boolean; is_flagged?: boolean } = await c.req.json();
  if (body.is_read !== undefined) await markRead(c.env.INBOX_DB, id, body.is_read);
  if (body.is_flagged !== undefined) await markFlagged(c.env.INBOX_DB, id, body.is_flagged);
  return c.json({ ok: true });
});

// Delete email (soft delete)
app.delete('/api/emails/:id', async (c) => {
  const id = c.req.param('id');
  const email = await getEmail(c.env.INBOX_DB, id);
  if (!email) return c.json({ error: 'not found' }, 404);
  await deleteEmail(c.env.INBOX_DB, id);
  return c.json({ ok: true });
});

// Restore email
app.post('/api/emails/:id/restore', async (c) => {
  const id = c.req.param('id');
  await restoreEmail(c.env.INBOX_DB, id);
  return c.json({ ok: true });
});

// List deleted emails
app.get('/api/emails/deleted', async (c) => {
  const result = await listDeletedEmails(c.env.INBOX_DB, { limit: 100 });
  return c.json(result);
});

// Permanently delete all soft-deleted emails
app.delete('/api/emails/purge', async (c) => {
  await purgeDeleted(c.env.INBOX_DB);
  return c.json({ ok: true });
});


// ============================================================
// Worker entry
// ============================================================
export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    await handleEmail(message, env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },
};
