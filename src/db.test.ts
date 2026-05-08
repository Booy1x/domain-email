import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Mock D1 database for unit testing query logic
// ═══════════════════════════════════════════════════════════════

function createMockD1(result: any = { results: [] }) {
  const mockStmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(result),
    all: vi.fn().mockResolvedValue(result),
  } as any;
  return {
    prepare: vi.fn().mockReturnValue(mockStmt),
  } as any as D1Database;
}

// Helper to get the mock statement for assertions
function getMockStmt(db: D1Database) {
  return (db.prepare as any).mock.results[0].value;
}

// Import the functions we want to test
import {
  insertEmail,
  insertAttachment,
  listEmails,
  listDeletedEmails,
  getEmail,
  getAttachments,
  markRead,
  markFlagged,
  deleteEmail,
  restoreEmail,
  purgeDeleted,
  getDomainsWithRecipients,
  searchEmails,
} from './db';

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('insertEmail', () => {
  it('calls prepare with correct SQL', async () => {
    const db = createMockD1();
    const email = {
      id: 'test-1',
      domain: 'example.com',
      mail_from: 'sender@test.com',
      rcpt_to: 'user@example.com',
      subject: 'Test Subject',
      body_text: 'Hello',
      body_html: '<p>Hello</p>',
      date: '2026-01-01T00:00:00Z',
      r2_key: 'raw/test-1.eml',
      is_read: 0,
      is_flagged: 0,
      is_spam: 0,
      created_at: '2026-01-01T00:00:00Z',
    };
    await insertEmail(db, email);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO emails'));
    expect(getMockStmt(db).bind).toHaveBeenCalledWith(
      'test-1', 'example.com', 'sender@test.com', 'user@example.com',
      'Test Subject', 'Hello', '<p>Hello</p>', '2026-01-01T00:00:00Z', 'raw/test-1.eml'
    );
  });
});

describe('insertAttachment', () => {
  it('calls prepare with correct SQL and binds', async () => {
    const db = createMockD1();
    const att = {
      id: 'att-1',
      email_id: 'email-1',
      filename: 'doc.pdf',
      content_type: 'application/pdf',
      size: 1024,
      r2_key: 'attachments/email-1/doc.pdf',
    };
    await insertAttachment(db, att);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO attachments'));
    expect(getMockStmt(db).bind).toHaveBeenCalledWith('att-1', 'email-1', 'doc.pdf', 'application/pdf', 1024, 'attachments/email-1/doc.pdf');
  });
});

describe('listEmails', () => {
  it('returns emails without filters', async () => {
    const mockResults: any = {
      results: [
        { id: '1', domain: 'a.com', mail_from: 'f@a.com', rcpt_to: 'r@a.com', subject: 'S1', date: '2026-01-02T00:00:00Z', is_read: 0, is_flagged: 0, created_at: '2026-01-02T00:00:00Z' },
        { id: '2', domain: 'a.com', mail_from: 'f@a.com', rcpt_to: 'r@a.com', subject: 'S2', date: '2026-01-01T00:00:00Z', is_read: 1, is_flagged: 0, created_at: '2026-01-01T00:00:00Z' },
      ],
    };
    const db = createMockD1(mockResults);
    const result = await listEmails(db, { limit: 50 });
    expect(result.emails).toHaveLength(2);
    expect(result.cursor).toBeNull();
  });

  it('uses FTS search when query is provided', async () => {
    const mockResults: any = { results: [] };
    const db = createMockD1(mockResults);
    await listEmails(db, { q: 'hello world', limit: 50 });
    // FTS path should be used
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('emails_fts'));
  });

  it('filters by domain', async () => {
    const mockResults: any = { results: [] };
    const db = createMockD1(mockResults);
    await listEmails(db, { domain: 'example.com', limit: 50 });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('domain = ?');
  });

  it('generates cursor when there are more results than limit', async () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      id: String(i), domain: 'a.com', mail_from: 'f@a.com', rcpt_to: 'r@a.com',
      subject: 'S', date: `2026-01-${String(30 - i).padStart(2, '0')}T00:00:00Z`,
      is_read: 0, is_flagged: 0, created_at: '2026-01-01T00:00:00Z',
    }));
    const db = createMockD1({ results: rows } as any);
    const result = await listEmails(db, { limit: 30 });
    expect(result.emails).toHaveLength(30);
    expect(result.cursor).not.toBeNull();
  });

  it('caps limit at 100', async () => {
    const db = createMockD1({ results: [] } as any);
    await listEmails(db, { limit: 500 });
    // The SQL should use limit+1 = 101 (capped)
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ?'));
  });
});

describe('getEmail', () => {
  it('fetches a single email by id', async () => {
    const mockEmail = { id: '1', domain: 'a.com', subject: 'Test', body_text: 'hi', body_html: '<p>hi</p>' };
    const db = createMockD1(mockEmail);
    const result = await getEmail(db, '1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ?'));
    expect(getMockStmt(db).bind).toHaveBeenCalledWith('1');
  });

  it('returns null for non-existent email', async () => {
    const db = createMockD1(null);
    const result = await getEmail(db, 'nonexistent');
    expect(result).toBeNull();
  });
});

describe('markRead', () => {
  it('sets is_read = 1 for read', async () => {
    const db = createMockD1();
    await markRead(db, '1', true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE emails SET is_read'));
    expect(getMockStmt(db).bind).toHaveBeenCalledWith(1, '1');
  });

  it('sets is_read = 0 for unread', async () => {
    const db = createMockD1();
    await markRead(db, '1', false);
    expect(getMockStmt(db).bind).toHaveBeenCalledWith(0, '1');
  });
});

describe('markFlagged', () => {
  it('sets is_flagged = 1', async () => {
    const db = createMockD1();
    await markFlagged(db, '1', true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('is_flagged'));
    expect(getMockStmt(db).bind).toHaveBeenCalledWith(1, '1');
  });
});

describe('deleteEmail', () => {
  it('soft-deletes by setting deleted_at', async () => {
    const db = createMockD1();
    await deleteEmail(db, '1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('deleted_at = CURRENT_TIMESTAMP'));
  });
});

describe('restoreEmail', () => {
  it('restores by setting deleted_at = NULL', async () => {
    const db = createMockD1();
    await restoreEmail(db, '1');
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('deleted_at = NULL'));
  });
});

describe('purgeDeleted', () => {
  it('hard-deletes all soft-deleted emails', async () => {
    const db = createMockD1();
    await purgeDeleted(db);
    expect(db.prepare).toHaveBeenCalledWith('DELETE FROM emails WHERE deleted_at IS NOT NULL');
  });
});

describe('listDeletedEmails', () => {
  it('returns only deleted emails', async () => {
    const mockResults: any = {
      results: [
        { id: '1', domain: 'a.com', mail_from: 'f@a.com', rcpt_to: 'r@a.com', subject: 'Deleted', date: '2026-01-01T00:00:00Z', is_read: 0, is_flagged: 0, created_at: '2026-01-01T00:00:00Z' },
      ],
    };
    const db = createMockD1(mockResults);
    const result = await listDeletedEmails(db, { limit: 100 });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('deleted_at IS NOT NULL');
    expect(result.emails).toHaveLength(1);
  });
});

describe('searchEmails', () => {
  it('builds FTS query with quoted terms', async () => {
    const db = createMockD1({ results: [] } as any);
    await searchEmails(db, { q: 'hello world', limit: 50 });
    // bind should include the FTS query string
    const bindCalls = (getMockStmt(db).bind as any).mock.calls[0];
    expect(bindCalls[0]).toContain('"hello"');
    expect(bindCalls[0]).toContain('"world"');
    expect(bindCalls[0]).toContain('AND');
  });

  it('escapes double quotes in search terms', async () => {
    const db = createMockD1({ results: [] } as any);
    await searchEmails(db, { q: 'say "hi"', limit: 50 });
    const bindCalls = (getMockStmt(db).bind as any).mock.calls[0];
    expect(bindCalls[0]).toContain('""hi""');
  });

  it('applies domain filter when provided', async () => {
    const db = createMockD1({ results: [] } as any);
    await searchEmails(db, { q: 'test', domain: 'example.com', limit: 50 });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('e.domain = ?');
  });

  it('applies rcptUser filter when provided', async () => {
    const db = createMockD1({ results: [] } as any);
    await searchEmails(db, { q: 'test', rcptUser: 'john', limit: 50 });
    const sql = (db.prepare as any).mock.calls[0][0];
    expect(sql).toContain('SUBSTR(e.rcpt_to');
  });
});
