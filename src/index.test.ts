import { describe, expect, it, vi } from 'vitest';
import { app, handleEmail, mapWithConcurrency, processCleanup, sanitizeEmailRow } from './index';
import type { AttachmentRow, EmailRow, Env } from './types';

const id = 'aaaaaaaaaaaaaaaa';
const email: EmailRow = {
  id, domain: 'example.com', mail_from: '<sender@example.net>', rcpt_to: 'user@example.com',
  subject: '<subject>', body_text: '<plain>', body_html: '<p>safe</p><script>bad()</script>',
  date: '2026-01-01T00:00:00.000Z', r2_key: `raw/${id}.eml`, is_read: 0,
  is_flagged: 0, is_spam: 0, created_at: '2026-01-01T00:00:00.000Z', storage_state: 'active',
  attachment_count: 1, attachment_total_size: 3,
};
const attachment: AttachmentRow = {
  id: 'bbbbbbbbbbbbbbbb', email_id: id, filename: 'report\r\nX-Evil: yes.pdf',
  content_type: 'application/pdf', size: 3, r2_key: 'attachments/internal-secret', storage_state: 'active',
};

function objectBody(content = 'abc'): R2ObjectBody {
  const bytes = new TextEncoder().encode(content);
  return {
    body: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }),
    arrayBuffer: async () => bytes.buffer,
    text: async () => content,
    json: async () => JSON.parse(content),
    blob: async () => new Blob([bytes]),
    writeHttpMetadata(headers: Headers) { headers.set('Content-Type', 'application/pdf'); },
    key: 'key', version: 'v', size: bytes.length, etag: 'e', httpEtag: '"e"', uploaded: new Date(),
    checksums: {}, storageClass: 'Standard', customMetadata: {}, httpMetadata: {}, range: undefined,
  } as unknown as R2ObjectBody;
}

function apiEnv(options: { first?: unknown; all?: unknown[]; object?: R2ObjectBody | null } = {}): Env {
  const statement = {
    bind: vi.fn().mockReturnThis(), run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(options.first ?? null),
    all: vi.fn().mockResolvedValue({ results: options.all || [] }),
  } as any;
  return {
    INBOX_DB: { prepare: vi.fn().mockReturnValue(statement), batch: vi.fn().mockResolvedValue([]) } as any,
    INBOX_BUCKET: {
      get: vi.fn().mockResolvedValue(options.object === undefined ? objectBody() : options.object),
      put: vi.fn(), delete: vi.fn(), head: vi.fn(), list: vi.fn(), createMultipartUpload: vi.fn(), resumeMultipartUpload: vi.fn(),
    } as any,
  };
}

function emailMessage(rawText: string, reject = vi.fn()): ForwardableEmailMessage {
  const raw = new TextEncoder().encode(rawText);
  return {
    rawSize: raw.length,
    raw: new ReadableStream({ start(controller) { controller.enqueue(raw); controller.close(); } }),
    to: 'user@example.com', from: 'sender@example.net', headers: new Headers(), setReject: reject,
  } as unknown as ForwardableEmailMessage;
}

function multipartWithAttachments(sizes: number[]): string {
  const parts = sizes.map((size, index) => [
    '--boundary',
    'Content-Type: application/octet-stream',
    `Content-Disposition: attachment; filename="file-${index}.bin"`,
    'Content-Transfer-Encoding: base64',
    '',
    btoa(String.fromCharCode(...new Uint8Array(size).fill(index + 1))),
  ].join('\r\n'));
  return [
    'From: sender@example.net', 'To: user@example.com', 'Subject: limits',
    'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="boundary"', '',
    '--boundary', 'Content-Type: text/plain', '', 'body', ...parts, '--boundary--', '',
  ].join('\r\n');
}

describe('safe API representation', () => {
  it('keeps raw metadata fields and sanitizes only HTML at the rendering boundary', () => {
    const result = sanitizeEmailRow(email);
    expect(result.mail_from).toBe('<sender@example.net>');
    expect(result.subject).toBe('<subject>');
    expect(result.body_text).toBe('<plain>');
    expect(result.body_html).toBe('<p>safe</p>');
    expect(result).not.toHaveProperty('r2_key');
  });

  it('returns empty HTML instead of oversized unsanitized content', () => {
    const result = sanitizeEmailRow({ ...email, body_html: `<p>${'x'.repeat(2 * 1024 * 1024 + 1)}</p>` });
    expect(result.body_html).toBe('');
  });

  it('returns empty HTML when the sanitizer throws on malformed encoding', () => {
    const result = sanitizeEmailRow({ ...email, body_html: '<a href="%E0%A4%A">unsafe fallback</a>' });
    expect(result.body_html).toBe('');
  });

  it('does not return r2_key from attachment metadata API', async () => {
    const response = await app.fetch(new Request(`https://mail.example/api/emails/${id}/attachments`), apiEnv({ all: [attachment] }));
    expect(response.status).toBe(200);
    const data = await response.json() as Array<Record<string, unknown>>;
    expect(data[0].id).toBe(attachment.id);
    expect(data[0]).not.toHaveProperty('r2_key');
    expect(JSON.stringify(data)).not.toContain('internal-secret');
  });

  it('downloads attachments by stable id with forced private no-store headers', async () => {
    const response = await app.fetch(new Request(`https://mail.example/api/attachments/${attachment.id}`), apiEnv({ first: attachment }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('Content-Disposition')).not.toContain('\r');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('uses the same security headers for raw email downloads', async () => {
    const response = await app.fetch(new Request(`https://mail.example/api/emails/${id}/raw`), apiEnv({ first: email }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('message/rfc822');
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('requires an explicit destructive confirmation for purge', async () => {
    const env = apiEnv();
    const response = await app.fetch(new Request('https://mail.example/api/emails/purge', { method: 'DELETE' }), env);
    expect(response.status).toBe(409);
    expect(env.INBOX_DB.batch).not.toHaveBeenCalled();
  });

  it('rejects excessive query and invalid page limits before querying D1', async () => {
    const env = apiEnv();
    const queryResponse = await app.fetch(new Request(`https://mail.example/api/emails?q=${'x'.repeat(201)}`), env);
    const limitResponse = await app.fetch(new Request('https://mail.example/api/emails?limit=0'), env);
    expect(queryResponse.status).toBe(400);
    expect(limitResponse.status).toBe(400);
  });
  it('initializes polling from the current activation watermark', async () => {
    const response = await app.fetch(
      new Request('https://mail.example/api/emails/since?initial=1'),
      apiEnv({ first: { seq: 42, id: 'watermark-id' } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ emails: [], cursor: null, watermark: { seq: 42, id: 'watermark-id' } });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('rejects polling without an activation sequence or cursor', async () => {
    const env = apiEnv();
    const response = await app.fetch(new Request('https://mail.example/api/emails/since'), env);
    expect(response.status).toBe(400);
    expect(env.INBOX_DB.prepare).not.toHaveBeenCalled();
  });
});

describe('bounded and retryable ingestion', () => {
  it('rejects raw mail over the configured limit before D1 or R2 I/O', async () => {
    const env = apiEnv() as Env;
    env.MAX_RAW_BYTES = '1024';
    const reject = vi.fn();
    const message = {
      rawSize: 2048, raw: new ReadableStream(), to: 'user@example.com', from: 'sender@example.net',
      headers: new Headers(), setReject: reject,
    } as unknown as ForwardableEmailMessage;
    await handleEmail(message, env);
    expect(reject).toHaveBeenCalledWith('Message too large');
    expect(env.INBOX_DB.prepare).not.toHaveBeenCalled();
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it('leaves D1 pending and does not activate after an R2 partial failure', async () => {
    const raw = new TextEncoder().encode('From: sender@example.net\r\nTo: user@example.com\r\nSubject: Test\r\n\r\nHello');
    const statement = {
      bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue({ state: 'pending', storage_generation: 1 }),
      run: vi.fn().mockResolvedValue({ success: true }), all: vi.fn().mockResolvedValue({ results: [] }),
    } as any;
    const batch = vi.fn().mockResolvedValue([]);
    const env = {
      INBOX_DB: { prepare: vi.fn().mockReturnValue(statement), batch } as any,
      INBOX_BUCKET: { put: vi.fn().mockRejectedValue(new Error('R2 unavailable')) } as any,
    } as Env;
    const message = {
      rawSize: raw.length,
      raw: new ReadableStream({ start(controller) { controller.enqueue(raw); controller.close(); } }),
      to: 'user@example.com', from: 'sender@example.net', headers: new Headers(), setReject: vi.fn(),
    } as unknown as ForwardableEmailMessage;
    await expect(handleEmail(message, env)).rejects.toThrow('email_ingest_incomplete');
    expect(batch).toHaveBeenCalledTimes(2);
  });


  it('releases the whole cleanup claim for retry after any R2 object failure', async () => {
    const sqlSeen: string[] = [];
    const prepare = vi.fn((sql: string) => {
      sqlSeen.push(sql);
      const statement: any = {
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue({ pending: 2, failed: 2 }),
        all: vi.fn().mockImplementation(async () => {
          if (sql.includes('SELECT r.email_id')) return { results: [{ email_id: id }] };
          if (sql.includes('SELECT id, object_key')) return { results: [
            { id: 'raw-item', object_key: 'raw/key', object_kind: 'raw', email_id: id, storage_generation: 1, claim_token: 'claim' },
            { id: 'attachment-item', object_key: 'attachments/key', object_kind: 'attachment', email_id: id, storage_generation: 1, claim_token: 'claim' },
          ] };
          return { results: [] };
        }),
      };
      return statement;
    });
    const batch = vi.fn().mockResolvedValue([]);
    const bucketDelete = vi.fn(async (key: string) => {
      if (key === 'attachments/key') throw new Error('R2 unavailable');
    });
    const env = {
      INBOX_DB: { prepare, batch } as any,
      INBOX_BUCKET: { delete: bucketDelete } as any,
    } as Env;
    const result = await processCleanup(env);
    expect(result).toEqual({
      processed: { emails: 0, objects: 1 },
      failed: { emails: 1, objects: 1 },
      pending: { objects: 2, readyEmails: 0 },
      canContinue: false,
    });
    expect(bucketDelete).toHaveBeenCalledTimes(2);
    expect(sqlSeen.some(sql => sql.includes("state = 'cleanup_claimed'"))).toBe(true);
    expect(sqlSeen.some(sql => sql.includes("state = 'cleanup_pending'"))).toBe(true);
    expect(sqlSeen.some(sql => sql.includes("state = 'cleaned'"))).toBe(false);
  });
  it('processes at most the configured single email while safely deleting 25 attachments plus raw', async () => {
    const objects = Array.from({ length: 26 }, (_, index) => ({
      id: `item-${index}`,
      object_key: index === 0 ? 'raw/key' : `attachments/key-${index}`,
      object_kind: index === 0 ? 'raw' : 'attachment',
      email_id: id,
      storage_generation: 1,
      claim_token: 'claim',
    }));
    const prepare = vi.fn((sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue({ pending: 0, failed: 0, ready_emails: 0 }),
      all: vi.fn().mockResolvedValue(sql.includes('SELECT r.email_id')
        ? { results: [{ email_id: id }] }
        : sql.includes('SELECT id, object_key') ? { results: objects } : { results: [] }),
    }));
    const bucketDelete = vi.fn().mockResolvedValue(undefined);
    const env = {
      INBOX_DB: { prepare, batch: vi.fn().mockResolvedValue([]) } as any,
      INBOX_BUCKET: { delete: bucketDelete } as any,
      CLEANUP_EMAILS_PER_RUN: '1',
    } as Env;
    const result = await processCleanup(env);
    expect(bucketDelete).toHaveBeenCalledTimes(26);
    expect(result.processed).toEqual({ emails: 1, objects: 26 });
    const candidateStatement = prepare.mock.results[0].value;
    expect(candidateStatement.bind).toHaveBeenCalledWith(1);
  });

  it('rejects two individually valid body parts when their UTF-8 total exceeds the row-safe budget', async () => {
    const env = apiEnv();
    env.MAX_BODY_PART_BYTES = '1024';
    env.MAX_BODY_TOTAL_BYTES = '1200';
    const reject = vi.fn();
    const raw = [
      'From: sender@example.net', 'To: user@example.com', 'Subject: total body limit',
      'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="alt"', '',
      '--alt', 'Content-Type: text/plain; charset=utf-8', '', 'x'.repeat(700),
      '--alt', 'Content-Type: text/html; charset=utf-8', '', `<p>${'y'.repeat(700)}</p>`,
      '--alt--', '',
    ].join('\r\n');
    await handleEmail(emailMessage(raw, reject), env);
    expect(reject).toHaveBeenCalledWith('Message body too large');
    expect(env.INBOX_DB.prepare).not.toHaveBeenCalled();
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it.each([
    ['text/plain', 'x'.repeat(1025)],
    ['text/html', `<p>${'x'.repeat(1025)}</p>`],
  ])('rejects oversized %s body before reservation or R2 writes', async (contentType, body) => {
    const env = apiEnv();
    env.MAX_BODY_PART_BYTES = '1024';
    env.MAX_BODY_TOTAL_BYTES = '2048';
    const reject = vi.fn();
    await handleEmail(emailMessage([
      'From: sender@example.net', 'To: user@example.com', 'Subject: body limit',
      `Content-Type: ${contentType}; charset=utf-8`, '', body,
    ].join('\r\n'), reject), env);
    expect(reject).toHaveBeenCalledWith('Message body too large');
    expect(env.INBOX_DB.prepare).not.toHaveBeenCalled();
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it('rejects attachment count over the configured limit', async () => {
    const env = apiEnv();
    env.MAX_ATTACHMENT_COUNT = '0';
    const reject = vi.fn();
    await handleEmail(emailMessage(multipartWithAttachments([1]), reject), env);
    expect(reject).toHaveBeenCalledWith('Too many attachments');
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it('rejects one attachment over the configured byte limit', async () => {
    const env = apiEnv();
    env.MAX_ATTACHMENT_BYTES = '1024';
    const reject = vi.fn();
    await handleEmail(emailMessage(multipartWithAttachments([1025]), reject), env);
    expect(reject).toHaveBeenCalledWith('Attachment too large');
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it('rejects aggregate attachments over the configured total limit', async () => {
    const env = apiEnv();
    env.MAX_ATTACHMENTS_TOTAL_BYTES = '1024';
    const reject = vi.fn();
    await handleEmail(emailMessage(multipartWithAttachments([600, 600]), reject), env);
    expect(reject).toHaveBeenCalledWith('Attachments too large');
    expect(env.INBOX_BUCKET.put).not.toHaveBeenCalled();
  });

  it('never exceeds configured object concurrency', async () => {
    let active = 0;
    let maximum = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, index) => index), 3, async () => {
      active++; maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
    });
    expect(maximum).toBeLessThanOrEqual(3);
  });
});
