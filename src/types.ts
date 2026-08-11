// Shared Worker, storage, and API types.

export type StorageState = 'pending' | 'active' | 'failed';
export type EmailDirection = 'in' | 'out';

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
  deleted_at?: string | null;
  ingest_key?: string | null;
  storage_state?: StorageState;
  raw_size?: number;
  body_text_size?: number;
  body_html_size?: number;
  attachment_count?: number;
  attachment_total_size?: number;
  activation_seq?: number | null;
  storage_generation?: number;
  direction?: EmailDirection;
  message_id?: string | null;
  in_reply_to?: string | null;
  references_text?: string | null;
}

export type EmailListRow = Pick<EmailRow,
  'id' | 'domain' | 'mail_from' | 'rcpt_to' | 'subject' | 'date' |
  'is_read' | 'is_flagged' | 'created_at' | 'activation_seq'>;

export interface AttachmentRow {
  id: string;
  email_id: string;
  filename: string;
  content_type: string;
  size: number;
  r2_key: string;
  storage_state?: StorageState;
  storage_generation?: number;
  created_at?: string;
}

export interface SendEmailAddress {
  email: string;
  name?: string;
}
export interface SendEmailBuilder {
  to: string | SendEmailAddress | Array<string | SendEmailAddress>;
  from: string | SendEmailAddress;
  subject: string;
  text?: string;
  html?: string;
  cc?: string | SendEmailAddress | Array<string | SendEmailAddress>;
  bcc?: string | SendEmailAddress | Array<string | SendEmailAddress>;
  replyTo?: string | SendEmailAddress;
  headers?: Record<string, string>;
}
export interface SendEmailBinding {
  send(message: SendEmailBuilder): Promise<{ messageId: string }>;
}

export type ObjectStatus = 'available' | 'missing' | 'unknown';
export type PublicAttachment = Omit<AttachmentRow, 'r2_key' | 'storage_state'> & {
  object_status: ObjectStatus;
};

export interface Env {
  INBOX_DB: D1Database;
  INBOX_BUCKET: R2Bucket;
  CORS_ORIGIN?: string;
  APP_VERSION?: string;
  MAX_EMAILS_PER_HOUR?: string;
  MAX_RAW_BYTES?: string;
  MAX_BODY_PART_BYTES?: string;
  MAX_BODY_TOTAL_BYTES?: string;
  MAX_ATTACHMENT_COUNT?: string;
  MAX_ATTACHMENT_BYTES?: string;
  MAX_ATTACHMENTS_TOTAL_BYTES?: string;
  MAX_QUERY_LENGTH?: string;
  MAX_PAGE_SIZE?: string;
  OBJECT_CONCURRENCY?: string;
  CLEANUP_EMAILS_PER_RUN?: string;
  EMAIL?: SendEmailBinding;
  SEND_MAX_PER_HOUR?: string;
}
