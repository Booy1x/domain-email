// HTML Sanitizer — strip XSS vectors before sending to client
// Removes: scripts, event handlers, javascript: URIs, data: URIs,
//          expression(), -moz-binding, and other known attack vectors.

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
  's','samp','section','select','slot','small','source','span','strong','sub','summary','sup',
  'table','tbody','td','textarea','tfoot','th','thead','time','title','tr','track',
  'u','ul',
  'var','video',
  'wbr'
]);

// Event handler attributes to strip (on*)
const EVENT_ATTR_RE = /^on[a-z]+$/i;
// Dangerous URI schemes
const DANGEROUS_URI_RE = /^\s*(javascript|data|vbscript|mhtml):/i;
// CSS expression() and -moz-binding
const DANGEROUS_CSS_RE = /(expression\s*\()|(moz-binding\s*:)/i;

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Phase 1: Remove dangerous elements entirely (script, object, embed, etc.)
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

  // Phase 2: Parse and clean attributes using a simple state machine
  return cleanAttributes(cleaned);
}

function cleanAttributes(html: string): string {
  const result: string[] = [];
  let i = 0;

  while (i < html.length) {
    const tagStart = html.indexOf('<', i);
    if (tagStart === -1) {
      result.push(html.slice(i));
      break;
    }

    if (tagStart > i) {
      result.push(html.slice(i, tagStart));
    }

    const tagEnd = html.indexOf('>', tagStart);
    if (tagEnd === -1) {
      result.push(html.slice(tagStart));
      break;
    }

    const fullTag = html.slice(tagStart, tagEnd + 1);

    if (fullTag.startsWith('<!--')) {
      result.push(fullTag);
      i = tagEnd + 1;
      continue;
    }

    if (fullTag.startsWith('</') || fullTag.startsWith('<!')) {
      result.push(fullTag);
      i = tagEnd + 1;
      continue;
    }

    result.push(processTag(fullTag));
    i = tagEnd + 1;
  }

  return result.join('');
}

function processTag(tag: string): string {
  const match = tag.match(/^<([a-zA-Z][a-zA-Z0-9-]*)\s*([^>]*?)(\/?)>$/);
  if (!match) return tag;

  const tagName = match[1].toLowerCase();
  const attrsStr = match[2];
  const selfClose = match[3];

  if (!ALLOWED_TAGS.has(tagName)) {
    return '';
  }

  if (tagName === 'iframe' || tagName === 'body' || tagName === 'html') {
    return '';
  }

  const cleanAttrs = cleanTagAttributes(attrsStr);
  return `<${tagName}${cleanAttrs}${selfClose}>`;
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
        const quote = s[i];
        i++;
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

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
