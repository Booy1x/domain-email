// Shared types

export interface EmailRow {
  id: string;
  domain: string;
  mail_from: string;
  rcpt_to: string;
  subject: string;
  body_text: string;
  body_html: string;
  date: string;
  r2_key: string | null;
  is_read: number;
  is_flagged: number;
  is_spam: number;
  created_at: string;
}

export type EmailListRow = Pick<EmailRow, 'id' | 'domain' | 'mail_from' | 'rcpt_to' | 'subject' | 'date' | 'is_read' | 'is_flagged' | 'created_at'>;

export interface AttachmentRow {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size: number;
  r2_key: string;
  created_at?: string;
}

export interface Env {
  INBOX_DB: D1Database;
  INBOX_BUCKET: R2Bucket;
  CORS_ORIGIN?: string;
}
