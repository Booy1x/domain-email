-- Additive coordination hardening: visibility-ordered polling and safe
-- cleanup/re-ingestion coordination across D1 and R2.

ALTER TABLE emails ADD COLUMN activation_seq INTEGER;
ALTER TABLE emails ADD COLUMN storage_generation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE attachments ADD COLUMN storage_generation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cleanup_outbox ADD COLUMN storage_generation INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cleanup_outbox ADD COLUMN claim_token TEXT;
ALTER TABLE cleanup_outbox ADD COLUMN claim_expires_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS email_activation_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  email_id TEXT NOT NULL,
  storage_generation INTEGER NOT NULL DEFAULT 1,
  activated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email_id, storage_generation)
);

-- Existing active rows become visible in a deterministic migration order.
INSERT OR IGNORE INTO email_activation_events (email_id, storage_generation, activated_at)
SELECT id, COALESCE(storage_generation, 1), COALESCE(created_at, CURRENT_TIMESTAMP)
FROM emails
WHERE storage_state = 'active'
ORDER BY created_at, id;

UPDATE emails
SET activation_seq = (
  SELECT seq FROM email_activation_events
  WHERE email_id = emails.id AND storage_generation = emails.storage_generation
)
WHERE storage_state = 'active' AND activation_seq IS NULL;

CREATE TABLE IF NOT EXISTS ingestion_registry (
  ingest_key TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  storage_generation INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'pending',
  claim_token TEXT,
  claim_expires_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO ingestion_registry
  (ingest_key, email_id, storage_generation, state, updated_at)
SELECT COALESCE(ingest_key, id), id, COALESCE(storage_generation, 1),
  CASE WHEN storage_state = 'active' THEN 'active' ELSE 'pending' END,
  COALESCE(created_at, CURRENT_TIMESTAMP)
FROM emails;

-- Preserve already-staged cleanup work even when email metadata is gone.
INSERT OR IGNORE INTO ingestion_registry
  (ingest_key, email_id, storage_generation, state, updated_at)
SELECT email_id, email_id, MAX(COALESCE(storage_generation, 1)),
  CASE
    WHEN MAX(CASE WHEN claim_token IS NOT NULL THEN 1 ELSE 0 END) = 1
      THEN 'cleanup_claimed'
    ELSE 'cleanup_pending'
  END,
  CURRENT_TIMESTAMP
FROM cleanup_outbox
WHERE email_id IS NOT NULL AND completed_at IS NULL
GROUP BY email_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_activation_seq
  ON emails(activation_seq, id) WHERE storage_state = 'active' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingestion_registry_cleanup
  ON ingestion_registry(state, claim_expires_at, updated_at, email_id);
CREATE INDEX IF NOT EXISTS idx_cleanup_outbox_email_pending
  ON cleanup_outbox(email_id, completed_at, next_attempt_at, id);
CREATE INDEX IF NOT EXISTS idx_cleanup_outbox_claim
  ON cleanup_outbox(claim_token, completed_at, id);
