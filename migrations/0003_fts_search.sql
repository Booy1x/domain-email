-- D1 Migration: add FTS5 virtual table for fast email search

CREATE VIRTUAL TABLE IF NOT EXISTS emails_fts USING fts5(
  subject,
  mail_from,
  rcpt_to,
  body_text,
  content='emails',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS emails_ai AFTER INSERT ON emails BEGIN
  INSERT INTO emails_fts(rowid, subject, mail_from, rcpt_to, body_text)
  VALUES (NEW.rowid, NEW.subject, NEW.mail_from, NEW.rcpt_to, NEW.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_ad AFTER DELETE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, mail_from, rcpt_to, body_text)
  VALUES('delete', OLD.rowid, OLD.subject, OLD.mail_from, OLD.rcpt_to, OLD.body_text);
END;

CREATE TRIGGER IF NOT EXISTS emails_au AFTER UPDATE ON emails BEGIN
  INSERT INTO emails_fts(emails_fts, rowid, subject, mail_from, rcpt_to, body_text)
  VALUES('delete', OLD.rowid, OLD.subject, OLD.mail_from, OLD.rcpt_to, OLD.body_text);
  INSERT INTO emails_fts(rowid, subject, mail_from, rcpt_to, body_text)
  VALUES (NEW.rowid, NEW.subject, NEW.mail_from, NEW.rcpt_to, NEW.body_text);
END;

-- Populate FTS index with existing data
INSERT OR REPLACE INTO emails_fts(rowid, subject, mail_from, rcpt_to, body_text)
SELECT rowid, subject, mail_from, rcpt_to, body_text FROM emails;
