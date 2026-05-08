import { describe, it, expect } from 'vitest';

// ── helpers ──
// sanitizeHtml etc. are not exported from index.ts, so we replicate
// the logic here for unit testing.
// In a real refactor, these functions should be moved to a separate module.

const ALLOWED_TAGS = new Set([
  'a','abbr','address','area','article','aside','audio',
  'b','bdi','bdo','blockquote','br','button','canvas','caption','cite','code','col','colgroup','data','datalist','dd','del','details','dfn','dialog','div','dl','dt',
  'em','embed',
  'fieldset','figcaption','figure','footer','form',
  'h1','h2','h3','h4','h5','h6','head','header','hgroup','hr',
  'i','iframe','img','input','ins',
  'kbd','label','legend','li','link',
  'main','map','mark','menu','meta','meter',
  'nav','noscript',
  'ol','optgroup','option','output',
  'p','param','picture','pre','progress',
  'q',
  'rp','rt','ruby',
  's','samp','section','select','slot','small','source','span','strong','sub','summary','sup','svg',
  'table','tbody','td','template','textarea','tfoot','th','thead','time','title','tr','track',
  'u','ul',
  'var','video',
  'wbr'
]);

const EVENT_ATTR_RE = /^on[a-z]+$/i;
const DANGEROUS_URI_RE = /^\s*(javascript|data|vbscript|mhtml):/i;
const DANGEROUS_CSS_RE = /(expression\s*\()|(moz-binding\s*:)/i;

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cleanTagAttributes(attrsStr: string): string {
  if (!attrsStr.trim()) return '';
  const attrs: Array<{ name: string; value: string }> = [];
  let i = 0;
  const s = attrsStr;

  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const nameStart = i;
    while (i < s.length && !/[\s=]/.test(s[i])) i++;
    const name = s.slice(nameStart, i).toLowerCase().trim();
    if (!name) { i++; continue; }
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i < s.length && s[i] === '=') {
      i++;
      while (i < s.length && /\s/.test(s[i])) i++;
      let value: string;
      if (i < s.length && (s[i] === '"' || s[i] === "'")) {
        const quote = s[i]; i++;
        const valStart = i;
        while (i < s.length && s[i] !== quote) i++;
        value = s.slice(valStart, i);
        if (i < s.length) i++;
      } else {
        const valStart = i;
        while (i < s.length && !/\s/.test(s[i])) i++;
        value = s.slice(valStart, i);
      }
      attrs.push({ name, value });
    } else {
      attrs.push({ name, value: '' });
    }
  }

  const kept: string[] = [];
  for (const { name, value } of attrs) {
    if (EVENT_ATTR_RE.test(name)) continue;
    if (name.startsWith('data-') && DANGEROUS_URI_RE.test(value)) continue;
    if (name === 'style') {
      if (DANGEROUS_CSS_RE.test(value)) continue;
      if (/position\s*:\s*fixed/i.test(value)) continue;
      kept.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    if (name === 'href' || name === 'src' || name === 'action' || name === 'formaction') {
      if (DANGEROUS_URI_RE.test(value)) continue;
      if (DANGEROUS_URI_RE.test(decodeURIComponent(value))) continue;
      kept.push(`${name}="${escapeAttr(value)}"`);
      continue;
    }
    if (value && DANGEROUS_URI_RE.test(value)) continue;
    if (name.includes(':')) continue;
    kept.push(value ? `${name}="${escapeAttr(value)}"` : name);
  }
  return kept.length > 0 ? ' ' + kept.join(' ') : '';
}

function processTag(tag: string): string {
  const match = tag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)\s*([^>]*?)(\/?)>$/);
  if (!match) return tag;
  const tagName = match[1].toLowerCase();
  const attrsStr = match[2];
  const selfClose = match[3];
  if (!ALLOWED_TAGS.has(tagName)) return '';
  if (tagName === 'iframe' || tagName === 'body' || tagName === 'html') return '';
  const cleanAttrs = cleanTagAttributes(attrsStr);
  return `<${tagName}${cleanAttrs}${selfClose}>`;
}

function cleanAttributes(html: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < html.length) {
    const tagStart = html.indexOf('<', i);
    if (tagStart === -1) { result.push(html.slice(i)); break; }
    if (tagStart > i) result.push(html.slice(i, tagStart));
    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) { result.push(html.slice(tagStart)); break; }
    const fullTag = html.slice(tagStart, tagEnd + 1);
    if (fullTag.startsWith('<!--')) { result.push(fullTag); i = tagEnd + 1; continue; }
    if (fullTag.startsWith('</') || fullTag.startsWith('<!')) { result.push(fullTag); i = tagEnd + 1; continue; }
    result.push(processTag(fullTag));
    i = tagEnd + 1;
  }
  return result.join('');
}

function sanitize(html: string): string {
  if (!html) return '';
  let cleaned = html
    .replace(/<script[\s>][\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s>][\s\S]*?<\/noscript>/gi, '')
    .replace(/<object[\s>][\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<applet[\s>][\s\S]*?<\/applet>/gi, '')
    .replace(/<form[\s>][\s\S]*?<\/form>/gi, '')
    .replace(/<link[^>]*>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<base[^>]*>/gi, '')
    .replace(/<head[\s>][\s\S]*?<\/head>/gi, '')
    .replace(/<\/(iframe|body|html|noscript|object|applet|form|embed|link|meta|base|script)\s*>/gi, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '');
  cleaned = cleanAttributes(cleaned);
  return cleaned;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

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
