import { describe, it, expect } from 'vitest';
import { streamToBuffer } from './mime';

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
