declare module 'postal-mime' {
  export interface EmailAddress {
    address: string;
    name: string;
  }

  export interface Attachment {
    filename: string;
    mimeType: string;
    content: Uint8Array | ArrayBuffer;
    disposition?: string;
  }

  export interface ParsedEmail {
    headers: Record<string, any>;
    from?: EmailAddress;
    to?: EmailAddress | EmailAddress[];
    subject?: string;
    date?: string;
    messageId?: string;
    html?: string;
    text?: string;
    attachments?: Attachment[];
  }

  class PostalMime {
    parse(raw: Uint8Array | ArrayBuffer): Promise<ParsedEmail>;
  }

  const PostalMimeConstructor: typeof PostalMime & (new () => PostalMime);
  export default PostalMimeConstructor;
}
