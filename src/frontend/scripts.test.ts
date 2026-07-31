import { describe, expect, it } from 'vitest';
import { drainPollingPages, scripts, buildEmailSrcdoc, esc, formatBytes, compareActivation } from './scripts';

describe('HTML email remote-content boundary', () => {
  it('builds the initial iframe with remote sources disabled', () => {
    const srcdoc = buildEmailSrcdoc('<p>hi</p>', false);
    expect(srcdoc).toContain("default-src 'none'");
    expect(srcdoc).toContain('img-src data: cid:;');
    expect(srcdoc).not.toContain('img-src data: cid: https:');
    expect(srcdoc).not.toContain('font-src data: https:');
    expect(srcdoc).toContain("media-src data:;");
    expect(scripts).toContain('buildEmailSrcdoc(rawHtmlSrc, false)');
  });

  it('only enables remote images and fonts from the explicit user button', () => {
    expect(scripts).toContain("remoteButton.addEventListener('click'");
    expect(scripts).toContain('buildEmailSrcdoc(rawHtml, true)');
    expect(scripts).toContain('可能向发件方暴露你的 IP 地址和打开时间');
  });

  it('allows http(s) images and fonts when allowRemote is true, but never media', () => {
    const srcdoc = buildEmailSrcdoc('<p>hi</p>', true);
    expect(srcdoc).toContain('img-src data: cid: https: http:');
    expect(srcdoc).toContain('font-src data: https: http:');
    expect(srcdoc).toContain('media-src data:;');
    expect(srcdoc).not.toContain('media-src data: https:');
  });

  it('escapes untrusted text', () => {
    expect(esc('<script>alert(1)</script>&"\'')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#39;');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });

  it('orders by activation sequence', () => {
    expect(compareActivation({ activation_seq: 1 }, { activation_seq: 2 })).toBe(-1);
    expect(compareActivation({ activation_seq: 2 }, { activation_seq: 1 })).toBe(1);
    expect(compareActivation({ activation_seq: 1, id: 'a' }, { activation_seq: 1, id: 'b' })).toBe(-1);
    expect(compareActivation({ activation_seq: 1, id: 'b' }, { activation_seq: 1, id: 'a' })).toBe(1);
  });

  it('downloads available attachments by id and disables unavailable objects', () => {
    expect(scripts).toContain("encodeURIComponent(att.id)");
    expect(scripts).not.toContain("encodeURIComponent(att.r2_key)");
    expect(scripts).toContain("status !== 'available'");
    expect(scripts).toContain('历史文件缺失');
    expect(scripts).toContain('存储状态未知');
    expect(scripts).toContain('attachment-unavailable');
  });

  it('always renders body_text as escaped plain text', () => {
    expect(scripts).not.toContain('isHtmlText');
    expect(scripts).toContain("esc(email.body_text)");
  });

  it('keeps inbox entry and domain expansion state decoupled from selection', () => {
    expect(scripts).toContain("getElementById('inbox-entry')");
    expect(scripts).toContain('function setDomainOpen(domain)');
    expect(scripts).toContain('function activateSidebar(domain, rcpt)');
    expect(scripts).toContain('state.openDomain = domain;');
    expect(scripts).toContain("inboxEntry.classList.toggle('active', !domain)");
  });

  it('drains every activation-sequence polling page instead of truncating at ten messages', async () => {    const pages = [
      { emails: Array.from({ length: 100 }, (_, i) => i), cursor: 'page-2' },
      { emails: Array.from({ length: 100 }, (_, i) => i + 100), cursor: 'page-3' },
      { emails: Array.from({ length: 37 }, (_, i) => i + 200), cursor: null },
    ];
    const seen: Array<string | null> = [];
    const drained = await drainPollingPages(async cursor => {
      seen.push(cursor);
      return pages[seen.length - 1];
    });
    expect(drained).toHaveLength(237);
    expect(drained[236]).toBe(236);
    expect(seen).toEqual([null, 'page-2', 'page-3']);
    expect(scripts).toContain("fetch('/api/emails/since?initial=1')");
    expect(scripts.indexOf("fetch('/api/emails/since?initial=1')"))
      .toBeLessThan(scripts.indexOf("lastSeen = { seq: Number(watermark.seq || 0), id: watermark.id || '' };\n    initRoute();"));
    expect(scripts).toContain("&seq=' + encodeURIComponent(lastSeen.seq)");
    expect(scripts).not.toContain('&ts=');
  });
});
