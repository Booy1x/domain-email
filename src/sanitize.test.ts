import { describe, it, expect } from 'vitest';

import { sanitizeHtml as sanitize, escapeHtml } from './sanitize';

describe('sanitizeHtml — XSS Protection', () => {
  // ── Script injection ──
  it('removes <script> tags with content', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('');
  });

  it('removes multiple script tags', () => {
    expect(sanitize('<script>alert(1)</script><p>safe</p><script>alert(2)</script>')).toBe('<p>safe</p>');
  });

  it('removes script tags with attributes', () => {
    expect(sanitize('<script type="text/javascript">alert(1)</script>')).toBe('');
  });

  it('removes script tags across multiple lines', () => {
    const input = '<script>\nvar x = document.cookie;\nalert(x);\n</script>';
    expect(sanitize(input)).toBe('');
  });

  // ── Event handlers ──
  it('strips onclick attributes', () => {
    expect(sanitize('<p onclick="alert(1)">click</p>')).toBe('<p>click</p>');
  });

  it('strips onmouseover attributes', () => {
    expect(sanitize('<div onmouseover="alert(1)">hover</div>')).toBe('<div>hover</div>');
  });

  it('strips onerror on img tags', () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
  });

  it('strips onload on body tags', () => {
    expect(sanitize('<body onload="alert(1)">content</body>')).toBe('content');
  });

  // ── javascript: URI ──
  it('removes javascript: in href', () => {
    expect(sanitize('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>');
  });

  it('removes javascript: in src', () => {
    expect(sanitize('<img src="javascript:alert(1)">')).toBe('<img>');
  });

  it('removes encoded javascript: URI', () => {
    expect(sanitize('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>');
  });

  // ── data: URI ──
  it('removes data: URIs in href', () => {
    expect(sanitize('<a href="data:text/html,<script>alert(1)</script>">click</a>')).toBe('<a>click</a>');
  });

  // ── Dangerous elements ──
  it('removes <noscript> tags', () => {
    expect(sanitize('<noscript>enable js</noscript>')).toBe('');
  });

  it('removes <object> tags', () => {
    expect(sanitize('<object data="malicious.swf"></object>')).toBe('');
  });

  it('removes <embed> tags', () => {
    expect(sanitize('<embed src="malicious.swf">')).toBe('');
  });

  it('removes <applet> tags', () => {
    expect(sanitize('<applet code="malicious.class"></applet>')).toBe('');
  });

  it('removes <form> tags', () => {
    expect(sanitize('<form action="evil.com"><input name="password"></form>')).toBe('');
  });

  it('removes <link> tags', () => {
    expect(sanitize('<link rel="stylesheet" href="evil.css">')).toBe('');
  });

  it('removes <meta> tags', () => {
    expect(sanitize('<meta http-equiv="refresh" content="0;url=evil.com">')).toBe('');
  });

  it('removes <base> tags', () => {
    expect(sanitize('<base href="https://evil.com/">')).toBe('');
  });

  it('removes <head> sections', () => {
    expect(sanitize('<head><style>body{display:none}</style></head><p>hi</p>')).toBe('<p>hi</p>');
  });

  it('removes iframes', () => {
    expect(sanitize('<iframe src="https://evil.com"></iframe>')).toBe('');
  });

  // ── Comments & CDATA ──
  it('removes HTML comments', () => {
    expect(sanitize('<!-- comment --><p>hi</p>')).toBe('<p>hi</p>');
  });

  it('removes CDATA sections', () => {
    expect(sanitize('<![CDATA[ some data ]]><p>hi</p>')).toBe('<p>hi</p>');
  });

  it('removes XML processing instructions', () => {
    expect(sanitize('<?xml version="1.0"?><p>hi</p>')).toBe('<p>hi</p>');
  });

  // ── CSS-based attacks ──
  it('removes style with expression()', () => {
    expect(sanitize('<div style="width: expression(alert(1))">x</div>')).toBe('<div>x</div>');
  });

  it('removes style with -moz-binding', () => {
    expect(sanitize('<div style="-moz-binding: url(evil.xml)">x</div>')).toBe('<div>x</div>');
  });

  it('removes position:fixed in style (overlay attack)', () => {
    expect(sanitize('<div style="position:fixed;top:0;left:0">x</div>')).toBe('<div>x</div>');
  });

  // ── Safe content preserved ──
  it('preserves safe HTML tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    expect(sanitize(input)).toBe(input);
  });

  it('preserves safe href attributes', () => {
    const input = '<a href="https://example.com">link</a>';
    expect(sanitize(input)).toBe(input);
  });

  it('preserves safe src attributes', () => {
    const input = '<img src="https://example.com/img.png">';
    expect(sanitize(input)).toBe(input);
  });

  it('preserves class and id attributes', () => {
    const input = '<div class="container" id="main">content</div>';
    expect(sanitize(input)).toBe(input);
  });

  it('preserves safe style attributes', () => {
    const input = '<p style="color: red;">red text</p>';
    expect(sanitize(input)).toBe(input);
  });

  it('preserves tables', () => {
    const input = '<table><tr><td>cell</td></tr></table>';
    expect(sanitize(input)).toBe(input);
  });

  // ── Edge cases ──
  it('returns empty string for empty input', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles null/undefined gracefully', () => {
    expect(sanitize(null as any)).toBe('');
    expect(sanitize(undefined as any)).toBe('');
  });

  it('handles plain text without HTML', () => {
    expect(sanitize('just plain text')).toBe('just plain text');
  });

  it('strips xmlns:xlink namespace attacks', () => {
    expect(sanitize('<svg><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="evil.svg#x"></use></svg>'))
      .not.toContain('xmlns:xlink');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});
