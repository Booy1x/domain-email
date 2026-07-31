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
});
