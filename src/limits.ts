import type { Env } from './types';

export const DEFAULT_LIMITS = Object.freeze({
  rawBytes: 25 * 1024 * 1024,
  bodyPartBytes: 512 * 1024,
  bodyTotalBytes: 768 * 1024,
  attachmentCount: 25,
  attachmentBytes: 10 * 1024 * 1024,
  attachmentsTotalBytes: 20 * 1024 * 1024,
  queryLength: 200,
  pageSize: 100,
  objectConcurrency: 4,
  cleanupEmailsPerRun: 1,
});

function bounded(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

export function getLimits(env: Env) {
  return {
    rawBytes: bounded(env.MAX_RAW_BYTES, DEFAULT_LIMITS.rawBytes, 1024, 50 * 1024 * 1024),
    bodyPartBytes: bounded(env.MAX_BODY_PART_BYTES, DEFAULT_LIMITS.bodyPartBytes, 1024, 1024 * 1024),
    bodyTotalBytes: bounded(env.MAX_BODY_TOTAL_BYTES, DEFAULT_LIMITS.bodyTotalBytes, 1024, 1536 * 1024),
    attachmentCount: bounded(env.MAX_ATTACHMENT_COUNT, DEFAULT_LIMITS.attachmentCount, 0, 100),
    attachmentBytes: bounded(env.MAX_ATTACHMENT_BYTES, DEFAULT_LIMITS.attachmentBytes, 1024, 25 * 1024 * 1024),
    attachmentsTotalBytes: bounded(env.MAX_ATTACHMENTS_TOTAL_BYTES, DEFAULT_LIMITS.attachmentsTotalBytes, 1024, 50 * 1024 * 1024),
    queryLength: bounded(env.MAX_QUERY_LENGTH, DEFAULT_LIMITS.queryLength, 1, 1000),
    pageSize: bounded(env.MAX_PAGE_SIZE, DEFAULT_LIMITS.pageSize, 1, 250),
    objectConcurrency: bounded(env.OBJECT_CONCURRENCY, DEFAULT_LIMITS.objectConcurrency, 1, 16),
    cleanupEmailsPerRun: bounded(env.CLEANUP_EMAILS_PER_RUN, DEFAULT_LIMITS.cleanupEmailsPerRun, 1, 5),
  };
}

export function parsePageLimit(raw: string | undefined, maximum: number, fallback = 50): number {
  if (!raw) return Math.min(fallback, maximum);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('invalid_limit');
  return Math.min(value, maximum);
}

export function assertQueryLength(query: string | undefined, maximum: number): void {
  if (query !== undefined && query.length > maximum) throw new Error('query_too_long');
}
