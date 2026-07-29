import { describe, it, expect } from 'vitest';
import { parseEmail, streamToBuffer } from './mime';

// ═══════════════════════════════════════════════════════════════
// streamToBuffer tests
// ═══════════════════════════════════════════════════════════════

describe('streamToBuffer', () => {
  it('converts a single-chunk stream to Uint8Array', async () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result).toEqual(data);
  });

  it('converts a multi-chunk stream to a single Uint8Array', async () => {
    const chunk1 = new Uint8Array([72, 101]); // "He"
    const chunk2 = new Uint8Array([108, 108]); // "ll"
    const chunk3 = new Uint8Array([111]);      // "o"
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.enqueue(chunk3);
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });

  it('handles an empty stream', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result).toEqual(new Uint8Array(0));
  });

  it('handles binary data correctly', async () => {
    const data = new Uint8Array([0, 255, 128, 64, 32]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result).toEqual(data);
    expect(result.length).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// concatUint8Array — tested indirectly via streamToBuffer
// ═══════════════════════════════════════════════════════════════

describe('concatUint8Array (via streamToBuffer)', () => {
  it('concatenates chunks in order', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([6, 7, 8, 9]),
    ];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it('handles large binary payloads', async () => {
    const size = 100_000;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) data[i] = i % 256;

    // Split into 10 chunks
    const chunkSize = 10_000;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < size; i += chunkSize) {
          controller.enqueue(data.slice(i, i + chunkSize));
        }
        controller.close();
      },
    });
    const result = await streamToBuffer(stream);
    expect(result.length).toBe(size);
    expect(result).toEqual(data);
  });
});


describe('streamToBuffer size limit', () => {
  it('throws and stops buffering when the limit is exceeded', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    });
    await expect(streamToBuffer(stream, 10)).rejects.toThrow('payload_too_large');
  });
});


describe('parseEmail attachments', () => {
  it('retains an attachment without a sender-provided filename', async () => {
    const raw = new TextEncoder().encode([
      'From: sender@example.net',
      'To: user@example.com',
      'Subject: anonymous attachment',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="boundary"',
      '',
      '--boundary',
      'Content-Type: text/plain',
      '',
      'body',
      '--boundary',
      'Content-Type: application/octet-stream',
      'Content-Disposition: attachment',
      'Content-Transfer-Encoding: base64',
      '',
      'AQID',
      '--boundary--',
      '',
    ].join('\r\n'));
    const parsed = await parseEmail(raw);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].filename).toBe('attachment-1');
    expect(parsed.attachments[0].content).toEqual(new Uint8Array([1, 2, 3]));
  });
});
