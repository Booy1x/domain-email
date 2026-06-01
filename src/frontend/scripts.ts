export const scripts = `
var state = {
  domain: '', rcptUser: '', emails: [], cursor: null, loading: false, hasMore: true,
  selectedId: null, totalLoaded: 0, view: 'home'
};
var allDomains = [];

var originalFetch = window.fetch;
window.fetch = function(url, opts) {
  opts = opts || {};
  opts.credentials = 'same-origin';
  return originalFetch.call(window, url, opts).then(function(r) {
    if (r.redirected || (r.status === 403 || r.status === 401)) {
      window.location.reload();
      return Promise.reject(new Error('Auth session expired'));
    }
    var ct = r.headers.get('content-type') || '';
    if (url.toString().indexOf('/api/') !== -1 && ct.indexOf('text/html') !== -1) {
      window.location.reload();
      return Promise.reject(new Error('Auth session expired'));
    }
    return r;
  });
};

var currentTheme = localStorage.getItem('theme') || 'dark';
function applyTheme(t) {
  document.documentElement.className = t;
  localStorage.setItem('theme', t);
}
applyTheme(currentTheme);

fetch('/api/domains')
  .then(function(r) { return r.json(); })
  .then(function(domains) {
    var total = 0;
    for (var i = 0; i < domains.length; i++) {
      total += domains[i].count;
    }
    document.getElementById('total-count').textContent = domains.length + ' 个域名 / ' + total + ' 封邮件';
  })
  .catch(function() {});

document.getElementById('theme-toggle').addEventListener('click', function() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme);
  if (state.selectedId) loadEmailDetail(state.selectedId);
});

updateBreadcrumb();
loadHomeEmails();

function searchMails() {
  var q = document.getElementById('search').value.trim();
  state.cursor = null; state.emails = []; state.hasMore = true; state.selectedId = null; state.totalLoaded = 0;
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
  if (q) {
    state.view = 'home';
    updateBreadcrumb();
    loadEmails(true);
  } else if (state.domain) {
    state.view = 'domain';
    state.rcptUser = '';
    updateBreadcrumb();
    loadEmails(true);
  } else if (!state.domain) {
    loadHomeEmails();
  }
}
var searchTimer = null;
function toggleSearchClear() {
  var btn = document.getElementById('search-clear');
  var hasValue = document.getElementById('search').value.length > 0;
  btn.classList.toggle('visible', hasValue);
}
var searchInitialized = false;
document.getElementById('search').addEventListener('input', function() {
  if (!searchInitialized) { searchInitialized = true; return; }
  toggleSearchClear();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(function() { searchMails(); }, 300);
});
document.getElementById('search-clear').addEventListener('click', function() {
  var input = document.getElementById('search');
  input.value = '';
  toggleSearchClear();
  input.focus();
  searchMails();
});

document.querySelector('.domain-list').addEventListener('click', function(e) {
  var rcptItem = e.target.closest('.rcpt-item');
  if (rcptItem) {
    e.stopPropagation();
    var domain = rcptItem.dataset.domain;
    var rcpt = rcptItem.dataset.rcpt;
    document.querySelectorAll('.rcpt-item').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('active'); });
    rcptItem.classList.add('active');
    var parentTree = rcptItem.closest('.domain-tree');
    if (parentTree) parentTree.classList.add('active');
    state.domain = domain;
    state.rcptUser = rcpt;
    state.selectedId = null;
    state.emails = []; state.cursor = null; state.hasMore = true; state.totalLoaded = 0;
    state.view = 'rcpt';
    updateBreadcrumb();
    document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
    document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
    loadEmails(true);
    return;
  }

  var domainHeader = e.target.closest('.domain-tree-header');
  if (domainHeader) {
    e.stopPropagation();
    var tree = domainHeader.closest('.domain-tree');
    var domain = tree.dataset.domain;
    var isOpen = tree.classList.contains('open');
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('open'); });
    if (!isOpen) {
      tree.classList.add('open');
    }
    document.querySelectorAll('.rcpt-item').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('active'); });
    tree.classList.add('active');
    state.domain = domain;
    state.rcptUser = '';
    state.selectedId = null;
    state.emails = []; state.cursor = null; state.hasMore = true; state.totalLoaded = 0;
    state.view = 'domain';
    updateBreadcrumb();
    document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
    document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
    loadEmails(true);
    return;
  }
});

var breadcrumbBar = null;
function updateBreadcrumb() {
  if (!breadcrumbBar) {
    breadcrumbBar = document.createElement('div');
    breadcrumbBar.className = 'breadcrumb-bar';
    breadcrumbBar.id = 'breadcrumb-bar';
    var toolbar = document.querySelector('.toolbar');
    toolbar.parentNode.insertBefore(breadcrumbBar, toolbar.nextSibling);
  }
  var html = '';
  if (state.view === 'home') {
    html = '';
  } else if (state.view === 'domain') {
    html = '<span class="bc-domain">' + esc(state.domain) + '</span>';
  } else if (state.view === 'rcpt') {
    html = '<span class="bc-domain">' + esc(state.domain) + '</span>' +
      '<span class="bc-sep">›</span>' +
      '<span class="bc-rcpt">' + esc(state.rcptUser) + '</span>';
  }
  breadcrumbBar.innerHTML = html;
  breadcrumbBar.style.display = html ? 'flex' : 'none';
}

function loadHomeEmails() {
  if (state.loading) return;
  state.loading = true;
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/recent?limit=10')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      state.emails = data.emails || [];
      state.totalLoaded = state.emails.length;
      state.view = 'home';
      updateBreadcrumb();
      renderEmailList();
    })
    .catch(function() {
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() { state.loading = false; });
}

document.getElementById('email-list').addEventListener('click', function(e) {
  var restoreBtn = e.target.closest('.email-btn-restore');
  if (restoreBtn) {
    e.stopPropagation();
    var rid = restoreBtn.dataset.id;
    fetch('/api/emails/' + rid + '/restore', { method: 'POST' })
      .then(function() {
        var card = document.querySelector('.email-card[data-id="' + rid + '"]');
        if (card) card.remove();
      });
    return;
  }

  var delBtn = e.target.closest('.email-btn-delete');
  if (delBtn) {
    e.stopPropagation();
    var id = delBtn.dataset.id;
    if (confirm('确定要删除这封邮件吗？')) {
      fetch('/api/emails/' + id, { method: 'DELETE' })
        .then(function() {
          var card = document.querySelector('.email-card[data-id="' + id + '"]');
          if (card) card.remove();
          state.emails = state.emails.filter(function(e) { return e.id !== id; });
          state.totalLoaded = state.emails.length;
          document.getElementById('email-count').textContent = state.totalLoaded + ' 封';
          if (state.selectedId === id) {
            state.selectedId = null;
            document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
          }
        });
    }
    return;
  }

  var readBtn = e.target.closest('.email-btn-read');
  if (readBtn) {
    e.stopPropagation();
    var rid = readBtn.dataset.id;
    var wasRead = parseInt(readBtn.dataset.read || '0', 10) === 1;
    var nowRead = !wasRead;
    fetch('/api/emails/' + rid, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: nowRead }) })
      .then(function() {
        var card = document.querySelector('.email-card[data-id="' + rid + '"]');
        if (card) {
          if (nowRead) {
            card.classList.remove('unread');
            readBtn.textContent = '○';
            readBtn.dataset.read = '1';
            readBtn.title = '标记未读';
          } else {
            card.classList.add('unread');
            readBtn.textContent = '●';
            readBtn.dataset.read = '0';
            readBtn.title = '标记已读';
          }
        }
      })
      .catch(function() {});
    return;
  }

  var item = e.target.closest('.email-card');
  if (!item) return;
  state.selectedId = item.dataset.id;
  document.querySelectorAll('.email-card').forEach(function(el) { el.classList.remove('active'); });
  item.classList.add('active');
  item.classList.remove('unread');
  var btn = item.querySelector('.email-btn-read');
  if (btn) { btn.textContent = '○'; btn.dataset.read = '1'; btn.title = '标记未读'; }
  loadEmailDetail(item.dataset.id);
});

document.getElementById('email-list').addEventListener('scroll', function(e) {
  var el = e.target;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && state.hasMore && !state.loading) loadEmails();
});

var trashMode = false;
document.getElementById('btn-trash').addEventListener('click', function() {
  trashMode = true;
  document.getElementById('btn-trash').style.display = 'none';
  document.getElementById('btn-back').style.display = 'flex';
  document.getElementById('search').style.display = 'none';
  document.getElementById('email-count').style.display = 'none';
  document.querySelector('.domain-list').style.opacity = '0.3';
  document.querySelector('.domain-list').style.pointerEvents = 'none';
  loadTrash();
});
document.getElementById('btn-back').addEventListener('click', function() {
  trashMode = false;
  document.getElementById('btn-trash').style.display = 'flex';
  document.getElementById('btn-back').style.display = 'none';
  document.getElementById('search').style.display = '';
  document.getElementById('email-count').style.display = '';
  document.querySelector('.domain-list').style.opacity = '';
  document.querySelector('.domain-list').style.pointerEvents = '';
  state.cursor = null; state.emails = []; state.hasMore = true; state.selectedId = null; state.totalLoaded = 0;
  document.getElementById('email-list').innerHTML = '<div class="email-list-empty">选择一个域名</div>';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
});

function loadTrash() {
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/deleted?limit=50')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var emails = data.emails || [];
      if (emails.length === 0) {
        document.getElementById('email-list').innerHTML = '<div class="email-list-empty">回收站为空</div>';
        return;
      }
      document.getElementById('email-count').textContent = emails.length + ' 封已删除';
      document.getElementById('email-list').innerHTML = emails.map(function(e) {
        var timeStr = formatTime(e.date);
        return '<div class="email-card" data-id="' + e.id + '">' +
          '<div class="email-card-top">' +
            '<span class="email-from">' + esc(e.mail_from) + '</span>' +
            '<span class="email-time">' + timeStr + '</span>' +
          '</div>' +
          '<div class="email-subject">' + esc(e.subject || '(无主题)') + '</div>' +
          '<div class="email-actions" style="display:flex;">' +
            '<button class="email-btn email-btn-restore" data-id="' + e.id + '" title="恢复">↩</button>' +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    });
}

function loadEmails(reset) {
  if (state.loading || !state.hasMore) return;
  state.loading = true;
  var params = new URLSearchParams({ limit: '30' });
  if (state.domain) params.set('domain', state.domain);
  if (state.rcptUser) params.set('rcpt_user', state.rcptUser);
  if (state.cursor) params.set('cursor', state.cursor);
  var q = document.getElementById('search').value.trim();
  if (q) params.set('q', q);
  fetch('/api/emails?' + params)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (reset) state.emails = data.emails;
      else state.emails.push.apply(state.emails, data.emails);
      state.cursor = data.cursor;
      state.hasMore = !!data.cursor;
      state.totalLoaded = state.emails.length;
      renderEmailList();
    })
    .catch(function() {
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() { state.loading = false; });
}

function renderEmailList() {
  var el = document.getElementById('email-list');
  document.getElementById('email-count').textContent = state.totalLoaded + ' 封';
  if (state.emails.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = state.emails.map(function(e) {
    var active = state.selectedId === e.id;
    var unread = !e.is_read ? ' unread' : '';
    var timeStr = formatTime(e.date);
    return '<div class="email-card' + unread + (active ? ' active' : '') +
      '" data-id="' + e.id + '">' +
      '<div class="email-card-top">' +
        '<span class="email-from">' + esc(e.mail_from) + '</span>' +
        '<span class="email-time">' + timeStr + '</span>' +
      '</div>' +
      '<div class="email-subject">' + esc(e.subject || '(无主题)') + '</div>' +
      '<div class="email-recipient">' + esc((e.rcpt_to || '').split('@')[0] || '') + '</div>' +
      '<div class="email-actions">' +
        '<button class="email-btn email-btn-read" data-id="' + e.id + '" data-read="' + e.is_read + '" title="' + (e.is_read ? '标记未读' : '标记已读') + '">' +
          (e.is_read ? '○' : '●') + '</button>' +
        '<button class="email-btn email-btn-delete" data-id="' + e.id + '" title="删除">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function loadEmailDetail(id) {
  var preview = document.getElementById('preview');
  preview.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/' + id)
    .then(function(r) { return r.json(); })
    .then(function(email) {
      var hasHtml = email.body_html && email.body_html.length > 0;
      var hasText = email.body_text && email.body_text.length > 0;
      var isHtmlText = hasText && email.body_text.trim().charAt(0) === '<';
      var body;
      var iframeCardId = null;
      var isDark = currentTheme === 'dark';
      var rawHtmlSrc = hasHtml ? email.body_html : (isHtmlText ? email.body_text : null);

      if (hasHtml || isHtmlText) {
        iframeCardId = 'email-card-' + id;
        body = '<div class="email-iframe-card" id="' + iframeCardId + '"></div>';
      } else if (hasText) {
        body = '<div class="plain-text">' + esc(email.body_text) + '</div>';
      } else {
        body = '<div class="email-list-empty">此邮件没有正文内容</div>';
      }

      var toggleBtn = (iframeCardId && isDark)
        ? '<button class="email-style-toggle" id="email-style-toggle" data-original="0">' +
            '<span class="toggle-icon">☀</span><span>查看原始样式</span>' +
          '</button>'
        : '';

      preview.innerHTML =
        '<div class="preview-content">' +
          '<div class="preview-header">' +
            '<h2 class="preview-subject">' + esc(email.subject || '(无主题)') + '</h2>' +
            '<div class="preview-meta">' +
              '<span class="from">' + esc(email.mail_from) + '</span>' +
              '<span class="arrow">→</span>' +
              '<span>' + esc(email.rcpt_to) + '</span>' +
              toggleBtn +
            '</div>' +
            '<div class="preview-date">' + new Date(email.date).toLocaleString('zh-CN') + '</div>' +
          '</div>' +
          '<div class="preview-body">' + body + '</div>' +
        '</div>';

      if (iframeCardId && rawHtmlSrc) {
        var iframeSrcdoc = buildEmailSrcdoc(rawHtmlSrc, isDark);
        mountEmailIframe(iframeCardId, iframeSrcdoc);

        var toggleEl = document.getElementById('email-style-toggle');
        if (toggleEl) {
          toggleEl.addEventListener('click', function() {
            var isOriginal = toggleEl.dataset.original === '1';
            var newDark = isOriginal;
            toggleEl.dataset.original = isOriginal ? '0' : '1';
            toggleEl.querySelector('.toggle-icon').textContent = isOriginal ? '\\u2600' : '\\u263E';
            toggleEl.querySelector('.toggle-icon').nextElementSibling.textContent = isOriginal ? '查看原始样式' : '暗色阅读模式';
            var card = document.getElementById(iframeCardId);
            if (card) {
              card.innerHTML = '';
              card.classList.remove('iframe-ready');
            }
            var newSrcdoc = buildEmailSrcdoc(rawHtmlSrc, newDark);
            mountEmailIframe(iframeCardId, newSrcdoc);
          });
        }
      }
      fetch('/api/emails/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true }) });
    })
    .catch(function() {
      preview.innerHTML = '<div class="error-msg">加载失败</div>';
    });
}

function formatTime(dateStr) {
  var d = new Date(dateStr);
  var now = new Date();
  var diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function buildEmailSrcdoc(rawHtml, dark) {
  var base = [
    'body{padding:32px 36px;font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue","Noto Sans SC","PingFang SC",sans-serif;word-break:break-word;}',
    'img{max-width:100%;height:auto;border-radius:4px;}',
    'p{margin:10px 0;}p:first-child{margin-top:0;}p:last-child{margin-bottom:0;}',
    'ul,ol{padding-left:24px;margin:10px 0;}li{margin:4px 0;}',
    'table{border-collapse:collapse;max-width:100%;margin:14px 0;}',
    'td,th{border:0;padding:8px 12px;}',
    'pre code{background:transparent;padding:0;border-radius:0;}',
    'h1:first-child,h2:first-child,h3:first-child,h4:first-child{margin-top:0;}',
    'h1{font-size:22px;}h2{font-size:18px;}h3{font-size:16px;}',
    'table,tbody,thead,tfoot,tr,td,th,div,section,article{border:0!important;outline:0!important;box-shadow:none!important;}',
    '[border]{border:0!important;}',
    '[style*="border"]{border:0!important;}',
    '[style*="outline"]{outline:0!important;}',
    '[style*="box-shadow"]{box-shadow:none!important;}'
  ].join('');

  var theme;
  if (dark) {
    theme = [
      'html,body{margin:0;padding:0;background:#2a2a2e;color:#d8d5d0;overflow:visible;}',
      'pre{overflow-x:auto;padding:14px 16px;background:#333338;border:0;border-radius:6px;font:13px/1.55 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8c5c0;white-space:pre-wrap;word-break:break-word;}',
      'code{background:#333338;padding:2px 6px;border-radius:4px;font:13px/1.5 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#c8c5c0;}',
      'blockquote{border:0;margin:16px 0;padding:6px 16px;color:#a09d98;background:rgba(200,149,108,0.08);border-radius:6px;}',
      'th{background:#333338;font-weight:600;color:#d8d5d0;}',
      'a{color:#8ab4f8;text-decoration:none;border-bottom:0;}',
      'a:hover{color:#aecbfa;}',
      'h1,h2,h3,h4,h5,h6{color:#e8e6e3;margin:18px 0 8px;line-height:1.35;letter-spacing:0.005em;}',
      'hr{border:0;height:1px;background:rgba(255,255,255,0.1);margin:20px 0;}',
      '*{color-scheme:dark;}'
    ].join('');
  } else {
    theme = [
      'html,body{margin:0;padding:0;background:#fdfaf4;color:#2b2a27;overflow:visible;}',
      'pre{overflow-x:auto;padding:14px 16px;background:#f5f1ea;border:0;border-radius:6px;font:13px/1.55 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#3a342a;white-space:pre-wrap;word-break:break-word;}',
      'code{background:#f0ebe1;padding:2px 6px;border-radius:4px;font:13px/1.5 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#3a342a;}',
      'blockquote{border:0;margin:16px 0;padding:6px 16px;color:#5d574d;background:rgba(200,149,108,0.06);border-radius:6px;}',
      'th{background:#f5f1ea;font-weight:600;}',
      'a{color:#8a6340;text-decoration:none;border-bottom:0;}',
      'a:hover{color:#6f4f33;}',
      'h1,h2,h3,h4,h5,h6{color:#1a1917;margin:18px 0 8px;line-height:1.35;letter-spacing:0.005em;}',
      'hr{border:0;height:1px;background:rgba(43,42,39,0.08);margin:20px 0;}'
    ].join('');
  }
  var css = theme + base;
  var csp = "default-src 'none'; img-src data: cid: https: http:; style-src 'unsafe-inline'; font-src data: https:; media-src data:; base-uri 'none';";
  return '<!doctype html><html><head>'
    + '<meta charset="utf-8">'
    + '<meta http-equiv="Content-Security-Policy" content="' + csp + '">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<base target="_blank">'
    + '<style>' + css + '</style>'
    + '</head><body>' + rawHtml + '</body></html>';
}

function mountEmailIframe(cardId, srcdoc) {
  setTimeout(function() {
    var card = document.getElementById(cardId);
    if (!card) return;
    var iframe = document.createElement('iframe');
    iframe.className = 'email-iframe';
    iframe.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('scrolling', 'auto');
    iframe.srcdoc = srcdoc;

    var revealed = false;
    var resize = function() {
      iframe.style.height = '100%';
    };
    var reveal = function() {
      if (revealed) return;
      var doc = iframe.contentDocument;
      if (!doc || !doc.documentElement) return;
      resize();
      iframe.classList.add('ready');
      card.classList.add('iframe-ready');
      revealed = true;
    };
    var wired = false;
    var wireDoc = function() {
      if (wired) return;
      var doc = iframe.contentDocument;
      if (!doc) return;
      wired = true;
      var imgs = doc.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (!img.complete) img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    };

    setTimeout(function() {
      var doc = iframe.contentDocument;
      if (doc && doc.readyState !== 'loading') {
        reveal();
        wireDoc();
        return;
      }
      if (doc) {
        doc.addEventListener('DOMContentLoaded', function() {
          reveal();
          wireDoc();
        }, { once: true });
      }
    }, 0);

    iframe.addEventListener('load', function() {
      reveal();
      wireDoc();
    });

    card.appendChild(iframe);
  }, 0);
}

var lastSeenTs = null;

function updateLastSeenTs() {
  if (state.emails && state.emails.length > 0) {
    var newest = state.emails[0];
    if (newest.created_at && (!lastSeenTs || newest.created_at > lastSeenTs)) {
      lastSeenTs = newest.created_at;
    }
  }
}

function showToast(email) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML =
    '<div class="toast-header">' +
      '<span class="toast-dot"></span>' +
      '<span class="toast-from">' + esc(email.mail_from || '未知发件人') + '</span>' +
      '<span class="toast-time">' + esc(formatTime(email.created_at)) + '</span>' +
    '</div>' +
    '<div class="toast-subject">' + esc(email.subject || '(无主题)') + '</div>' +
    '<div class="toast-bar"></div>';
  el.addEventListener('click', function() {
    dismissToast(el);
    var existing = document.querySelector('.email-card[data-id="' + email.id + '"]');
    if (existing) {
      existing.click();
      existing.scrollIntoView({ block: 'nearest' });
    }
  });
  container.appendChild(el);
  setTimeout(function() { dismissToast(el); }, 30000);
}

function dismissToast(el) {
  if (!el || el.classList.contains('toast-out')) return;
  el.classList.add('toast-out');
  setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}

function startPolling() {
  setInterval(function() {
    if (!lastSeenTs) return;
    fetch('/api/emails/since?ts=' + encodeURIComponent(lastSeenTs))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.emails && data.emails.length > 0) {
          var emails = data.emails.slice().reverse();
          for (var i = 0; i < emails.length; i++) {
            showToast(emails[i]);
          }
          lastSeenTs = data.emails[0].created_at;
          if (state.view === 'home') loadHomeEmails();
        }
      })
      .catch(function() {});
  }, 15000);
}

var originalLoadHomeEmails = loadHomeEmails;
loadHomeEmails = function() {
  originalLoadHomeEmails();
  var check = setInterval(function() {
    if (!state.loading) {
      clearInterval(check);
      updateLastSeenTs();
    }
  }, 50);
};

var originalRenderEmailList = renderEmailList;
renderEmailList = function() {
  originalRenderEmailList();
  updateLastSeenTs();
};

var originalLoadEmails = loadEmails;
loadEmails = function(reset) {
  var prevLoading = state.loading;
  originalLoadEmails(reset);
  var check = setInterval(function() {
    if (!state.loading && prevLoading) {
      clearInterval(check);
      updateLastSeenTs();
    }
    prevLoading = state.loading;
  }, 50);
};

setTimeout(function() {
  updateLastSeenTs();
  if (!lastSeenTs) {
    var d = new Date(Date.now() - 60000);
    lastSeenTs = d.toISOString();
  }
  startPolling();
}, 1000);
`;
