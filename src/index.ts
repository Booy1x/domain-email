import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { parseEmail, streamToBuffer } from './mime';
import { inboxPage } from './frontend';
import type { Env, EmailRow, AttachmentRow } from './types';
import {
  insertEmail, insertAttachment, listEmails, listDeletedEmails, getEmail,
  getAttachments, markRead, markFlagged, deleteEmail, restoreEmail, purgeDeleted,
  getDomains, getDomainsWithRecipients, searchEmails
} from './db';

// ============================================================
// HTML Sanitizer — strip XSS vectors before sending to client
// ============================================================
// Removes: scripts, event handlers, javascript: URIs, data: URIs,
//          expression(), -moz-binding, and other known attack vectors.
// Runs server-side so even if client-side sanitization is bypassed,
// the malicious content never reaches the browser.

const ALLOWED_TAGS = new Set([
  'a','abbr','address','area','article','aside','audio',
  'b','bdi','bdo','blockquote','br','button','canvas','caption','cite','code','col','colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl','dt',
  'em','embed',
  'fieldset','figcaption','figure','footer','form',
  'h1','h2','h3','h4','h5','h6','head','header','hgroup','hr',
  'i','iframe','img','input','ins',
  'kbd','label','legend','li','link',
  'main','map','mark','menu','meta','meter',
  'nav','noscript',
  'ol','optgroup','option','output',
  'p','param','picture','pre','progress',
  'q',
  'rp','rt','ruby',
  's','samp','section','select','slot','small','source','span','strong','sub','summary','sup','svg',
  'table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track',
  'u','ul',
  'var','video',
  'wbr'
]);

const ALLOWED_ATTRS = new Set([
  'abbr','accept','accept-charset','accesskey','action','align','allow','allowfullscreen','alt','as','async','autocapitalize','autocomplete','autoplay',
  'background','bgcolor','border',
  'capture','charset','checked','cite','class','color','cols','colspan','content','contenteditable','controls','coords','crossorigin',
  'data','data-*','datetime','decoding','default','defer','dir','dirname','disabled','download','draggable','dropzone','enctype',
  'for','form','formaction','formenctype','formmethod','formnovalidate','formtarget','frameborder',
  'headers','height','hidden','high','href','hreflang','http-equiv','id','importance','integrity','inputmode','ismap','itemprop','kind',
  'label','lang','list','loading','loop','low',
  'manifest','max','maxlength','media','method','min','minlength','multiple','muted',
  'name','nomodule','novalidate',
  'open','optimum',
  'pattern','ping','placeholder','playsinline','poster','preload',
  'readonly','referrerpolicy','rel','required','reversed','rows','rowspan',
  'sandbox','scope','scoped','selected','shape','size','sizes','slot','span','spellcheck','src','srcdoc','srclang','srcset','start','step','style','summary','tabindex','target','title','translate','type',
  'usemap','value',
  'width','wrap'
]);

// Event handler attributes to strip (on*)
const EVENT_ATTR_RE = /^on[a-z]+$/i;
// Dangerous URI schemes
const DANGEROUS_URI_RE = /^\s*(javascript|data|vbscript|mhtml):/i;
// CSS expression() and -moz-binding
const DANGEROUS_CSS_RE = /(expression\s*\()|(moz-binding\s*:)/i;

function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Phase 1: Remove dangerous elements entirely (script, object, embed, etc.)
  // Use regex for coarse removal — these must be stripped even if malformed
  let cleaned = html
    // Remove <script>…</script> including content
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    // Remove <noscript>
    .replace(/<noscript[\s>][\s\S]*?<\/noscript>/gi, '')
    // Remove <object>…</object>
    .replace(/<object[\s>][\s\S]*?<\/object>/gi, '')
    // Remove <embed> (any form, with or without attributes)
    .replace(/<embed[^>]*>/gi, '')
    // Remove <applet>
    .replace(/<applet[\s>][\s\S]*?<\/applet>/gi, '')
    // Remove <form> (prevent phishing forms inside emails)
    .replace(/<form[\s>][\s\S]*?<\/form>/gi, '')
    // Remove <link> (can leak data via href)
    .replace(/<link[^>]*>/gi, '')
    // Remove <meta> (can do redirects)
    .replace(/<meta[^>]*>/gi, '')
    // Remove <base> (can hijack relative URLs)
    .replace(/<base[^>]*>/gi, '')
    // Remove <head> entirely
    .replace(/<head[\s>][\s\S]*?<\/head>/gi, '')
    // Remove closing tags for dangerous/structural elements
    .replace(/<\/(iframe|body|html|noscript|object|applet|form|embed|link|meta|base|script)\s*>/gi, '')
    // Remove XML/CDATA sections
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    // Remove comments (can contain conditional IE exploits)
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove <?xml ...?> processing instructions
    .replace(/<\?xml[\s\S]*?\?>/gi, '');

  // Phase 2: Parse and clean attributes using a simple state machine
  // This handles: event handlers, dangerous URIs, dangerous CSS
  cleaned = cleanAttributes(cleaned);

  return cleaned;
}

function cleanAttributes(html: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < html.length) {
    // Find next tag opening
    const tagStart = html.indexOf('<', i);
    if (tagStart === -1) {
      result.push(html.slice(i));
      break;
    }

    // Push content before tag
    if (tagStart > i) {
      result.push(html.slice(i, tagStart));
    }

    // Find tag end
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) {
      result.push(html.slice(tagStart));
      break;
    }

    const fullTag = html.slice(tagStart, tagEnd + 1);

    // Skip comments (should be removed already, but safety check)
    if (fullTag.startsWith('<!--')) {
      result.push(fullTag);
      i = tagEnd + 1;
      continue;
    }

    // Skip closing tags and self-closing markers
    if (fullTag.startsWith('</') || fullTag.startsWith('<!')) {
      result.push(fullTag);
      i = tagEnd + 1;
      continue;
    }

    // Process opening tag — clean attributes
    const cleaned = processTag(fullTag);
    result.push(cleaned);
    i = tagEnd + 1;
  }

  return result.join('');
}

function processTag(tag: string): string {
  // Extract tag name and attributes section
  const match = tag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)\s*([^>]*?)(\/?)>$/);
  if (!match) return tag; // malformed, pass through

  const tagName = match[1].toLowerCase();
  const attrsStr = match[2];
  const selfClose = match[3];

  // If tag not in allowed list, strip it but keep content
  if (!ALLOWED_TAGS.has(tagName)) {
    return ''; // Remove tag, content stays
  }

  // Special handling for allowed tags with extra restrictions
  if (tagName === 'iframe' || tagName === 'body' || tagName === 'html') {
    return ''; // Never allow structural document tags inside email content
  }

  if (tagName === 'svg') {
    // Allow SVG but remove <script> inside will be handled by Phase 1 recursion
    // For now, strip event handlers from SVG elements
  }

  // Parse and clean attributes
  const cleanAttrs = cleanTagAttributes(attrsStr, tagName);

  return `<${tagName}${cleanAttrs}${selfClose}>`;
}

function cleanTagAttributes(attrsStr: string, _tagName: string): string {
  if (!attrsStr.trim()) return '';

  // Parse attributes — handle quoted and unquoted values
  const attrs: Array<{ name: string; value: string }> = [];
  let i = 0;
  const s = attrsStr;

  while (i < s.length) {
    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;

    // Read attribute name
    const nameStart = i;
    while (i < s.length && !/[\s=]/.test(s[i])) i++;
    const name = s.slice(nameStart, i).toLowerCase().trim();
    if (!name) { i++; continue; }

    // Skip whitespace
    while (i < s.length && /\s/.test(s[i])) i++;

    if (i < s.length && s[i] === '=') {
      i++; // skip =
      // Skip whitespace
      while (i < s.length && /\s/.test(s[i])) i++;

      let value: string;
      if (i < s.length && (s[i] === '"' || s[i] === "'")) {
        const quote = s[i];
        i++;
        const valStart = i;
        while (i < s.length && s[i] !== quote) i++;
        value = s.slice(valStart, i);
        if (i < s.length) i++; // skip closing quote
      } else {
        const valStart = i;
        while (i < s.length && !/\s/.test(s[i])) i++;
        value = s.slice(valStart, i);
      }
      attrs.push({ name, value });
    } else {
      // Boolean attribute
      attrs.push({ name, value: '' });
    }
  }

  // Filter and clean attributes
  const kept: string[] = [];
  for (const { name, value } of attrs) {
    // Skip event handlers
    if (EVENT_ATTR_RE.test(name)) continue;

    // Skip data-* attributes that contain script-like content
    if (name.startsWith('data-')) {
      // Allow safe data attributes
      if (DANGEROUS_URI_RE.test(value)) continue;
    }

    // Skip style attributes with dangerous content
    if (name === 'style') {
      if (DANGEROUS_CSS_RE.test(value)) continue;
      // Additional: remove position:fixed (overlay attacks)
      if (/position\s*:\s*fixed/i.test(value)) continue;
      kept.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }

    // Check href and src for dangerous URIs
    if (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') {
      if (DANGEROUS_URI_RE.test(value)) continue;
      // For href, also block if it looks like an encoded javascript:
      if (DANGEROUS_URI_RE.test(decodeURIComponent(value))) continue;
      kept.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }

    // General URI attributes
    if (value && DANGEROUS_URI_RE.test(value)) continue;

    // Skip xmlns:xlink and other namespace-based attacks
    if (name.includes(':')) continue;

    // Allowed attribute
    kept.push(value ? `${name}="${escapeAttr(value)}"` : name);
  }

  return kept.length > 0 ? ' ' + kept.join(' ') : '';
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sanitizeEmailRow(email: EmailRow): EmailRow {
  return {
    ...email,
    body_html: sanitizeHtml(email.body_html),
    // Also sanitize text fields that might contain HTML-like content used for XSS
    subject: escapeHtml(email.subject),
    mail_from: escapeHtml(email.mail_from),
    rcpt_to: escapeHtml(email.rcpt_to),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

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

// Emails since a given timestamp (for polling new emails)
app.get('/api/emails/since', async (c) => {
  const ts = c.req.query('ts');
  if (!ts) return c.json({ error: 'missing ts param' }, 400);
  const result = await c.env.INBOX_DB
    .prepare('SELECT id, mail_from, subject, created_at FROM emails WHERE created_at > ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10')
    .bind(ts)
    .all<{ id: string; mail_from: string; subject: string; created_at: string }>();
  return c.json({ emails: result.results || [] });
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
  return c.json(sanitizeEmailRow(email));
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
