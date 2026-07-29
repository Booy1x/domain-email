import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activateIngestion, checkRateLimit, claimCleanup, deleteEmail, encodeCursor, getAttachment,
  insertAttachment, insertEmail, listDeletedEmails, listEmails, listEmailsSince,
  reserveIngestion, restoreEmail, searchEmails, stageIngestion, stagePurgeDeleted,
} from './db';
import type { AttachmentRow, EmailRow } from './types';

function createMockD1(result: unknown = { results: [] }) {
  const statements: any[] = [];
  const db = {
    prepare: vi.fn((sql: string) => {
      const statement: any = {
        sql,
        bind: vi.fn().mockReturnThis(),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(result),
        all: vi.fn().mockResolvedValue(result),
      };
      statements.push(statement);
      return statement;
    }),
    batch: vi.fn().mockResolvedValue([]),
    _statements: statements,
  } as any;
  return db as D1Database & { _statements: any[] };
}

const email: EmailRow = {
  id: 'email-id', domain: 'example.com', mail_from: 'sender@example.net', rcpt_to: 'user@example.com',
  subject: 'subject', body_text: 'text', body_html: '<p>text</p>', date: '2026-01-01T00:00:00.000Z',
  r2_key: 'raw/email-id.eml', is_read: 0, is_flagged: 0, is_spam: 0,
  created_at: '2026-01-01T00:00:00.000Z', ingest_key: 'ingest', storage_state: 'pending',
  raw_size: 10, body_text_size: 4, body_html_size: 11, attachment_count: 1, attachment_total_size: 3,
  activation_seq: null, storage_generation: 1,
};
const attachment: AttachmentRow = {
  id: 'attachment-id', email_id: email.id, filename: 'file.txt', content_type: 'text/plain',
  size: 3, r2_key: 'attachments/attachment-id', storage_state: 'pending', storage_generation: 1,
};

beforeEach(() => vi.restoreAllMocks());

describe('ingestion persistence', () => {
  it('inserts all storage metadata for an email', async () => {
    const db = createMockD1();
    await insertEmail(db, email);
    expect((db.prepare as any).mock.calls[0][0]).toContain('attachment_total_size');
    expect(db._statements[0].bind).toHaveBeenCalledWith(
      email.id, email.domain, email.mail_from, email.rcpt_to, email.subject, email.body_text,
      email.body_html, email.date, email.r2_key, 0, 0, 0, email.created_at, email.ingest_key,
      'pending', 10, 4, 11, 1, 3, null, 1,
    );
  });

  it('stores attachments under stable metadata and state', async () => {
    const db = createMockD1();
    await insertAttachment(db, attachment);
    expect(db._statements[0].bind).toHaveBeenCalledWith(
      attachment.id, attachment.email_id, attachment.filename, attachment.content_type,
      attachment.size, attachment.r2_key, 'pending', 1,
    );
  });

  it('stages email and attachments atomically before object writes', async () => {
    const db = createMockD1();
    await stageIngestion(db, email, [attachment]);
    expect(db.batch).toHaveBeenCalledOnce();
    expect((db.batch as any).mock.calls[0][0]).toHaveLength(2);
    expect(db._statements[0].sql).toContain("storage_state = 'pending'");
  });

  it('publishes an activation event before making the generation active', async () => {
    const db = createMockD1();
    await activateIngestion(db, 'ingest', email.id, 1);
    expect(db.batch).toHaveBeenCalledOnce();
    expect(db._statements).toHaveLength(4);
    expect(db._statements[0].sql).toContain('email_activation_events');
    expect(db._statements[1].sql).toContain('UPDATE attachments');
    expect(db._statements[2].sql).toContain('activation_seq');
    expect(db._statements[3].sql).toContain("state = 'active'");
  });

  it('reserves generation atomically and only cancels unclaimed cleanup', async () => {
    const db = createMockD1({ state: 'pending', storage_generation: 2 });
    const result = await reserveIngestion(db, 'ingest', email.id);
    expect(result).toEqual({ state: 'pending', storage_generation: 2 });
    expect(db.batch).toHaveBeenCalledOnce();
    expect(db._statements[1].sql).toContain("state IN ('cleanup_pending', 'cleaned')");
    expect(db._statements[1].sql).not.toContain('cleanup_claimed');
    expect(db._statements[2].sql).toContain('DELETE FROM cleanup_outbox');
  });
});

describe('deterministic keyset pagination', () => {
  it('orders inbox by date and id and applies a compound cursor', async () => {
    const db = createMockD1({ results: [] });
    const cursor = encodeCursor({ k: 'date', v: email.date, i: email.id });
    await listEmails(db, { limit: 30, cursor });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('(date < ? OR (date = ? AND id < ?))');
    expect(sql).toContain('ORDER BY date DESC, id DESC');
    expect(db._statements[0].bind).toHaveBeenCalledWith(email.date, email.date, email.id, 31);
  });

  it('emits an opaque compound cursor when another page exists', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, index) => ({ ...email, id: `id-${index}`, date: email.date })),
    ];
    const db = createMockD1({ results: rows });
    const result = await listEmails(db, { limit: 1 });
    expect(result.emails).toHaveLength(1);
    expect(result.cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('uses the same compound ordering for FTS', async () => {
    const db = createMockD1({ results: [] });
    await searchEmails(db, { q: 'hello world', limit: 10, cursor: encodeCursor({ k: 'date', v: email.date, i: email.id }) });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('emails_fts MATCH');
    expect(sql).toContain('ORDER BY e.date DESC, e.id DESC');
    expect(db._statements[0].bind.mock.calls[0][0]).toContain('"hello"* AND "world"*');
  });

  it('uses deleted_at and id for trash pagination', async () => {
    const db = createMockD1({ results: [] });
    const deleted = '2026-02-01 00:00:00';
    await listDeletedEmails(db, { limit: 20, cursor: encodeCursor({ k: 'deleted', v: deleted, i: email.id }) });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('(deleted_at < ? OR (deleted_at = ? AND id < ?))');
    expect(sql).toContain('ORDER BY deleted_at DESC, id DESC');
  });

  it('polls ascending with activation sequence and id and returns all page capacity', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: String(index).padStart(3, '0'), mail_from: 'sender@example.net', subject: 's',
      created_at: '2026-01-01T00:00:00.000Z', activation_seq: index + 1,
    }));
    const db = createMockD1({ results: rows });
    const result = await listEmailsSince(db, { seq: 0, id: '', limit: 100 });
    expect(result.emails).toHaveLength(100);
    expect(result.cursor).not.toBeNull();
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('(activation_seq > ? OR (activation_seq = ? AND id > ?))');
    expect(sql).toContain('ORDER BY activation_seq ASC, id ASC');
  });
});

describe('deletion, restore, and cleanup outbox', () => {
  it('soft deletes and can restore without touching object storage', async () => {
    const db = createMockD1();
    await deleteEmail(db, email.id);
    await restoreEmail(db, email.id);
    expect(db._statements[0].sql).toContain('deleted_at = CURRENT_TIMESTAMP');
    expect(db._statements[1].sql).toContain('deleted_at = NULL');
  });

  it('stages generation-scoped object keys before hard-deleting metadata', async () => {
    const db = createMockD1();
    await stagePurgeDeleted(db);
    const statements = (db.batch as any).mock.calls[0][0];
    expect(statements).toHaveLength(6);
    expect(db._statements[0].sql).toContain('ingestion_registry');
    expect(db._statements[1].sql).toContain("state = 'cleanup_pending'");
    expect(db._statements[3].sql).toContain('storage_generation');
    expect(db._statements[4].sql).toContain('storage_generation');
    expect(db._statements[5].sql).toContain('DELETE FROM emails');
  });

  it('claims all cleanup objects with a lease before R2 deletion', async () => {
    const claimed = { ...attachment, object_key: attachment.r2_key, object_kind: 'attachment',
      storage_generation: 1, claim_token: 'claim' };
    const db = createMockD1({ results: [claimed] });
    const items = await claimCleanup(db, email.id, 'claim', 120);
    expect(items).toHaveLength(1);
    expect(db.batch).toHaveBeenCalledOnce();
    expect(db._statements[0].sql).toContain("state = 'cleanup_claimed'");
    expect(db._statements[0].sql).toContain('claim_expires_at');
    expect(db._statements[1].sql).toContain('claim_token = ?');
  });

  it('looks up attachment content by attachment id and active parent', async () => {
    const db = createMockD1(attachment);
    await getAttachment(db, attachment.id);
    expect((db.prepare as any).mock.calls[0][0]).toContain('a.id = ?');
    expect((db.prepare as any).mock.calls[0][0]).toContain('a.storage_generation = e.storage_generation');
    expect((db.prepare as any).mock.calls[0][0]).toContain("e.storage_state = 'active'");
  });
});

describe('rate limit fail-open behavior', () => {
  it('allows below limit and rejects at limit', async () => {
    expect(await checkRateLimit(createMockD1({ cnt: 4 }), 5)).toBe(true);
    expect(await checkRateLimit(createMockD1({ cnt: 5 }), 5)).toBe(false);
  });

  it('allows delivery if the limit query itself fails', async () => {
    const db = createMockD1();
    db._statements.length = 0;
    (db.prepare as any).mockImplementation(() => ({ first: vi.fn().mockRejectedValue(new Error('db unavailable')) }));
    expect(await checkRateLimit(db, 5)).toBe(true);
  });
});
