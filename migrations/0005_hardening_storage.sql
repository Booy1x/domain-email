-- Additive hardening: idempotent ingestion state, durable cleanup outbox,
-- reconciliation metadata, and deterministic keyset pagination indexes.
-- Existing rows remain active and compatible with the previously deployed Worker.

ALTER TABLE emails ADD COLUMN ingest_key TEXT;
ALTER TABLE emails ADD COLUMN storage_state TEXT NOT NULL DEFAULT 'active';
ALTER TABLE emails ADD COLUMN raw_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN body_text_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN body_html_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN attachment_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN attachment_total_size INTEGER NOT NULL DEFAULT 0;

ALTER TABLE attachments ADD COLUMN storage_state TEXT NOT NULL DEFAULT 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_ingest_key
  ON emails(ingest_key) WHERE ingest_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_active_date_id
  ON emails(date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emails_domain_active_date_id
  ON emails(domain, date DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emails_recipient_active_date_id
  ON emails(domain, SUBSTR(rcpt_to, 1, INSTR(rcpt_to, '@') - 1), date DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_emails_deleted_cursor
  ON emails(deleted_at DESC, id DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_created_cursor
  ON emails(created_at ASC, id ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_attachments_storage_state
  ON attachments(storage_state, email_id, id);

CREATE TABLE IF NOT EXISTS cleanup_outbox (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  object_kind TEXT NOT NULL,
  email_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cleanup_outbox_pending
  ON cleanup_outbox(completed_at, next_attempt_at, created_at, id);
