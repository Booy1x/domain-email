-- D1 Migration: add created_at index for rate limiting queries

CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
