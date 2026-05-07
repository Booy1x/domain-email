-- D1 Migration: add soft delete support

ALTER TABLE emails ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_emails_deleted_at ON emails(deleted_at);
