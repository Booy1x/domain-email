-- D1 Migration: initial schema for domain inbox

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  mail_from TEXT NOT NULL,
  rcpt_to TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  date TIMESTAMP NOT NULL,
  r2_key TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_flagged INTEGER NOT NULL DEFAULT 0,
  is_spam INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emails_domain ON emails(domain);
CREATE INDEX idx_emails_date ON emails(date DESC);
CREATE INDEX idx_emails_subject ON emails(subject);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  filename TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE
);

CREATE INDEX idx_attachments_email ON attachments(email_id);
