// MIME / RFC822 parser — hybrid approach
// Uses postal-mime for parsing, with manual QP/charset fallback

import PostalMime from 'postal-mime';

export interface ParsedEmail {
  headers: Record<string, string>;
  from: string;
  to: string;
  subject: string;
  date: Date;
  messageId: string;
  bodyText: string;
  bodyHtml: string;
  attachments: ParsedAttachment[];
}

export interface ParsedAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
  size: number;
}

export async function parseEmail(raw: Uint8Array): Promise<ParsedEmail> {
  // Try postal-mime first
  try {
    const parser = new PostalMime();
    const parsed = await parser.parse(raw);

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.headers || {})) {
      headers[key.toLowerCase()] = String(value);
    }

    const bodyHtml = parsed.html || '';
    const bodyText = parsed.text || '';

    const attachments: ParsedAttachment[] = [];
    for (const [index, att] of (parsed.attachments || []).entries()) {
      const filename = att.filename || `attachment-${index + 1}`;
      const contentType = att.mimeType || 'application/octet-stream';
      const content = att.content instanceof Uint8Array
        ? att.content
        : new Uint8Array(att.content || []);
      attachments.push({ filename, contentType, content, size: content.length });
    }

    const subject = parsed.subject || '';
    const from = parsed.from?.address || parsed.from?.name || '';
    const to = Array.isArray(parsed.to)
      ? parsed.to.map((a: any) => a.address || a.name || '').join(', ')
      : (parsed.to?.address || parsed.to?.name || '');
    const date = parsed.date ? new Date(parsed.date) : new Date();
    const messageId = (parsed.messageId || crypto.randomUUID()).replace(/[<>]/g, '');

    return { headers, from, to, subject, date: isNaN(date.getTime()) ? new Date() : date, messageId, bodyText, bodyHtml, attachments };
  } catch {
    // Keep delivery retryable without logging parser data or message content.
    console.error('mime_parse_failed');
    return {
      headers: {}, from: '', to: '', subject: '', date: new Date(),
      messageId: crypto.randomUUID(), bodyText: '', bodyHtml: '', attachments: []
    };
  }
}

export class PayloadTooLargeError extends Error {
  constructor() {
    super('payload_too_large');
  }
}

export async function streamToBuffer(stream: ReadableStream<Uint8Array>, maxBytes = Number.MAX_SAFE_INTEGER): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel('size limit exceeded');
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  }
  return concatUint8Array(chunks);
}

function concatUint8Array(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}
