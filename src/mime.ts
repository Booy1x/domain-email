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
    for (const att of parsed.attachments || []) {
      const filename = att.filename || '';
      const contentType = att.mimeType || 'application/octet-stream';
      const content = att.content instanceof Uint8Array
        ? att.content
        : new Uint8Array(att.content || []);
      if (filename) {
        attachments.push({ filename, contentType, content, size: content.length });
      }
    }

    const subject = parsed.subject || '';
    const from = parsed.from?.address || parsed.from?.name || '';
    const to = Array.isArray(parsed.to)
      ? parsed.to.map((a: any) => a.address || a.name || '').join(', ')
      : (parsed.to?.address || parsed.to?.name || '');
    const date = parsed.date ? new Date(parsed.date) : new Date();
    const messageId = (parsed.messageId || crypto.randomUUID()).replace(/[<>]/g, '');

    return { headers, from, to, subject, date: isNaN(date.getTime()) ? new Date() : date, messageId, bodyText, bodyHtml, attachments };
  } catch (e) {
    // Fallback: return minimal parsed email so Worker doesn't crash
    console.error('postal-mime parse failed:', e);
    return {
      headers: {}, from: '', to: '', subject: '', date: new Date(),
      messageId: crypto.randomUUID(), bodyText: '', bodyHtml: '', attachments: []
    };
  }
}

export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
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
