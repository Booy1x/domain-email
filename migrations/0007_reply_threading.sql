-- D1 Migration: outbound reply + threading metadata

ALTER TABLE emails ADD COLUMN direction TEXT NOT NULL DEFAULT 'in';
ALTER TABLE emails ADD COLUMN message_id TEXT;
ALTER TABLE emails ADD COLUMN in_reply_to TEXT;
ALTER TABLE emails ADD COLUMN references_text TEXT;

CREATE INDEX idx_emails_direction_date ON emails(direction, date DESC);
