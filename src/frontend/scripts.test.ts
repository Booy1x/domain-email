import { describe, expect, it } from 'vitest';
import { drainPollingPages, scripts } from './scripts';

 describe('HTML email remote-content boundary', () => {
  it('builds the initial iframe with remote sources disabled', () => {
    expect(scripts).toContain('buildEmailSrcdoc(rawHtmlSrc, false)');
    expect(scripts).toContain("allowRemote ? ' https: http:' : ''");
    expect(scripts).toContain("img-src data: cid:");
  });

  it('only enables remote images and fonts from the explicit user button', () => {
    expect(scripts).toContain("remoteButton.addEventListener('click'");
    expect(scripts).toContain('buildEmailSrcdoc(rawHtml, true)');
    expect(scripts).toContain('可能向发件方暴露你的 IP 地址和打开时间');
    expect(scripts).toContain('media-src data:;');
    expect(scripts).not.toContain('media-src data:" + remoteSources');
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

  it('drains every activation-sequence polling page instead of truncating at ten messages', async () => {
    const pages = [
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
