import { describe, expect, it } from 'vitest';
import { inboxPage } from './index';

describe('inboxPage', () => {
  it('renders the app version in the sidebar footer', () => {
    const html = inboxPage([], 'abc1234');
    expect(html).toContain('class="app-version"');
    expect(html).toContain('vabc1234');
  });

  it('falls back to dev version when none is provided', () => {
    const html = inboxPage([]);
    expect(html).toContain('>vdev</span>');
  });

  it('escapes the version string', () => {
    const html = inboxPage([], '<script>');
    expect(html).toContain('>v&lt;script&gt;</span>');
    expect(html).not.toContain('>v<script></span>');
  });

  it('shows an empty-recipient hint for domains without recipients', () => {
    const html = inboxPage([{ domain: 'example.com', count: 0, recipients: [] }]);
    expect(html).toContain('rcpt-empty');
    expect(html).toContain('该域名暂无收件人');
  });

  it('loads fonts via link tags instead of a stylesheet-blocking @import', () => {
    const html = inboxPage([]);
    expect(html).toContain('rel="preconnect" href="https://fonts.googleapis.com"');
    expect(html).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin');
    expect(html).toContain('rel="stylesheet" href="https://fonts.googleapis.com/css2');
    expect(html).not.toContain("@import url('https://fonts.googleapis.com");
  });

  it('boots the theme before first paint and renders the toggle button', () => {
    const html = inboxPage([]);
    expect(html).toContain('function bootTheme()');
    expect(html).toContain('localStorage.getItem');
    expect(html).toContain('prefers-color-scheme: dark');
    expect(html).toContain('id="btn-theme"');
    expect(html).toContain('[data-theme="dark"]');
    expect(html.indexOf('bootTheme')).toBeLessThan(html.indexOf('<style>'));
  });

  it('makes sidebar tree items keyboard-focusable', () => {
    const html = inboxPage([
      { domain: 'example.com', count: 1, recipients: [{ rcpt_user: 'alice', total: 1, unread: 0, last_date: '' }] },
    ]);
    expect(html).toContain('class="domain-tree-header" tabindex="0" role="button"');
    expect(html).toMatch(/class="rcpt-item"[^>]*tabindex="0" role="button"/);
  });

  it('nests the domain list under the inbox entry, with sent after it', () => {
    const html = inboxPage([{ domain: 'example.com', count: 0, recipients: [] }]);
    const inbox = html.indexOf('id="inbox-entry"');
    const domains = html.indexOf('<ul class="domain-list">');
    const sent = html.indexOf('id="btn-sent"');
    expect(inbox).toBeGreaterThan(-1);
    expect(inbox).toBeLessThan(domains);
    expect(domains).toBeLessThan(sent);
  });

  it('keeps the inbox expanded by default with a toggle, and sent outside the collapsible list', () => {
    const html = inboxPage([]);
    expect(html).toContain('id="inbox-entry"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('id="inbox-arrow"');
    expect(html.indexOf('id="btn-sent"')).toBeGreaterThan(html.indexOf('</ul>'));
    expect(html).toContain('class="sidebar-scroll"');
  });

  it('puts the deleted entry in the sidebar after sent and drops the toolbar trash/back buttons', () => {
    const html = inboxPage([]);
    const sent = html.indexOf('id="btn-sent"');
    const trash = html.indexOf('id="btn-trash"');
    expect(trash).toBeGreaterThan(sent);
    expect(trash).toBeLessThan(html.indexOf('class="sidebar-footer"'));
    expect(html).toContain('<span class="inbox-label">已删除</span>');
    expect(html).not.toContain('id="btn-back"');
    expect(html).not.toContain('回收站');
    expect(html.match(/id="btn-trash"/g)).toHaveLength(1);
  });

  it('places the inbox collapse arrow before the inbox icon', () => {
    const html = inboxPage([]);
    const entry = html.slice(html.indexOf('id="inbox-entry"'), html.indexOf('<ul class="domain-list">'));
    expect(entry.indexOf('id="inbox-arrow"')).toBeGreaterThan(-1);
    expect(entry.indexOf('id="inbox-arrow"')).toBeLessThan(entry.indexOf('<svg'));
    expect(entry.indexOf('<svg')).toBeLessThan(entry.indexOf('inbox-label'));
  });
});
