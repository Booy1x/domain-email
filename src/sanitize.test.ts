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

  it('removes <head> wrapper but preserves <style> blocks within it', () => {
    // Marketing emails ship CSS in <head>. The <head> element itself is
    // dropped (it can host base / meta / link attacks) but the inner
    // <style> rules survive so the email keeps its design.
    const out = sanitize('<head><style>.btn{color:red}</style></head><p class="btn">hi</p>');
    expect(out).toContain('<style>.btn{color:red}</style>');
    expect(out).toContain('<p class="btn">hi</p>');
    expect(out).not.toContain('<head>');
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
  it('removes inline style with expression()', () => {
    expect(sanitize('<div style="width: expression(alert(1))">x</div>')).toBe('<div>x</div>');
  });

  it('removes inline style with -moz-binding', () => {
    expect(sanitize('<div style="-moz-binding: url(evil.xml)">x</div>')).toBe('<div>x</div>');
  });

  it('neutralizes expression() inside <style> blocks', () => {
    const out = sanitize('<style>.x{width:expression(alert(1))}</style>');
    // Original keyword no longer present as an active declaration; the
    // prefixed form is harmless because no browser recognizes it.
    expect(out).not.toMatch(/(?<![a-z-])expression\s*\(/i);
    expect(out).toContain('invalid-expression(');
  });

  it('neutralizes -moz-binding inside <style> blocks', () => {
    const out = sanitize('<style>.x{-moz-binding:url(evil.xml)}</style>');
    expect(out).not.toMatch(/(?<![a-z])-moz-binding\s*:/i);
    expect(out).toContain('invalid-moz-binding:');
  });

  it('neutralizes url(javascript:) inside <style> blocks', () => {
    const out = sanitize('<style>.x{background:url(javascript:alert(1))}</style>');
    expect(out).not.toMatch(/url\s*\(\s*["']?javascript:/i);
  });

  it('neutralizes behavior: inside <style> blocks', () => {
    const out = sanitize('<style>.x{behavior:url(htc.htc)}</style>');
    expect(out).not.toMatch(/(?<![a-z-])behavior\s*:/i);
    expect(out).toContain('invalid-behavior:');
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

  it('preserves <style> blocks in body', () => {
    const input = '<style>.btn{color:#fff;background:#0a66c2}</style><a class="btn">click</a>';
    const out = sanitize(input);
    expect(out).toContain('<style>.btn{color:#fff;background:#0a66c2}</style>');
    expect(out).toContain('<a class="btn">click</a>');
  });

  it('preserves <font> color and face attributes', () => {
    // <font> is deprecated but still common in legacy transactional emails
    // (banks, airlines). Stripping it makes those emails look like wireframes.
    const out = sanitize('<font color="#cc0000" face="Arial">important</font>');
    expect(out).toContain('<font');
    expect(out).toContain('color="#cc0000"');
    expect(out).toContain('face="Arial"');
    expect(out).toContain('important');
  });

  it('preserves <center> wrapper', () => {
    expect(sanitize('<center><p>centered</p></center>')).toBe('<center><p>centered</p></center>');
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
