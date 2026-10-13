-- D1 Migration: per-direction rate limit lookups (inbound and outbound counted separately)

CREATE INDEX IF NOT EXISTS idx_emails_direction_created_at ON emails(direction, created_at);
