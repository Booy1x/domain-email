export interface PollingPage<T> { emails?: T[]; cursor?: string | null }

export async function drainPollingPages<T>(
  fetchPage: (cursor: string | null) => Promise<PollingPage<T>>,
  collected: T[] = [],
): Promise<T[]> {
  let cursor: string | null = null;
  do {
    const page = await fetchPage(cursor);
    if (page.emails?.length) collected.push(...page.emails);
    cursor = page.cursor || null;
  } while (cursor);
  return collected;
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function formatBytes(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024;
    unit++;
  }
  return (unit === 0 ? value : value.toFixed(value >= 10 ? 0 : 1)) + ' ' + units[unit];
}

export function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (d.getFullYear() === now.getFullYear()) return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

export function compareActivation(a: { activation_seq?: unknown; seq?: unknown; id?: string }, b: { activation_seq?: unknown; seq?: unknown; id?: string }): number {
  const as = Number(a.activation_seq || a.seq || 0);
  const bs = Number(b.activation_seq || b.seq || 0);
  if (as !== bs) return as < bs ? -1 : 1;
  return (a.id || '') < (b.id || '') ? -1 : ((a.id || '') > (b.id || '') ? 1 : 0);
}

export function buildEmailSrcdoc(rawHtml: string, allowRemote: boolean): string {
  const base = [
    'html,body{margin:0;padding:0;background:#f5f3f0;color:#2b2a27;overflow:visible;}',
    'body{padding:32px 36px;font:15px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue","Noto Sans SC","PingFang SC",sans-serif;word-break:break-word;}',
    'img,video,canvas{max-width:100%;height:auto;}',
    'p{margin:10px 0;}p:first-child{margin-top:0;}p:last-child{margin-bottom:0;}',
    'ul,ol{padding-left:24px;margin:10px 0;}li{margin:4px 0;}',
    'table{max-width:100%;}',
    'pre code{background:transparent;padding:0;border-radius:0;}',
    'h1:first-child,h2:first-child,h3:first-child,h4:first-child{margin-top:0;}',
    'h1{font-size:22px;}h2{font-size:18px;}h3{font-size:16px;}',
    'pre{overflow-x:auto;padding:14px 16px;background:#f5f1ea;border:0;border-radius:6px;font:13px/1.55 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#3a342a;white-space:pre-wrap;word-break:break-word;}',
    'code{background:#f0ebe1;padding:2px 6px;border-radius:4px;font:13px/1.5 "JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;color:#3a342a;}',
    'blockquote{border:0;margin:16px 0;padding:6px 16px;color:#5d574d;background:rgba(200,149,108,0.06);border-radius:6px;}',
    'th{background:#f5f1ea;font-weight:600;}',
    'a{color:#8a6340;text-decoration:none;border-bottom:0;}',
    'a:hover{color:#6f4f33;}',
    'h1,h2,h3,h4,h5,h6{color:#1a1917;margin:18px 0 8px;line-height:1.35;letter-spacing:0.005em;}',
    'hr{border:0;height:1px;background:rgba(43,42,39,0.08);margin:20px 0;}',
    '@media(max-width:640px){body{padding:20px 18px;font-size:14px;}table{width:100%!important;}td,th{word-break:break-word;}}'
  ].join('');
  const remoteSources = allowRemote ? ' https: http:' : '';
  const csp = "default-src 'none'; img-src data: cid:" + remoteSources + "; style-src 'unsafe-inline'; font-src data:" + remoteSources + "; media-src data:; base-uri 'none'; form-action 'none';";
  return '<!doctype html><html><head>'
    + '<meta charset="utf-8">'
    + '<meta http-equiv="Content-Security-Policy" content="' + csp + '">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<base target="_blank">'
    + '<style>' + base + '</style>'
    + '</head><body>' + rawHtml + '</body></html>';
}

export function emailCardHtml(e: { id: string; is_read: number; mail_from: string; date: string; subject: string; rcpt_to?: string }, selectedId: string | null): string {
  const active = selectedId === e.id;
  const unread = !e.is_read ? ' unread' : '';
  const timeStr = formatTime(e.date);
  return '<div class="email-card' + unread + (active ? ' active' : '') +
    '" data-id="' + esc(e.id) + '">' +
    '<div class="email-card-top">' +
      '<span class="email-from">' + esc(e.mail_from) + '</span>' +
      '<span class="email-time">' + timeStr + '</span>' +
    '</div>' +
    '<div class="email-subject">' + esc(e.subject || '(无主题)') + '</div>' +
    '<div class="email-recipient">' + esc((e.rcpt_to || '').split('@')[0] || '') + '</div>' +
    '<div class="email-actions">' +
      '<button class="email-btn email-btn-read" type="button" aria-label="' + (e.is_read ? '标记未读' : '标记已读') + '" data-id="' + esc(e.id) + '" data-read="' + e.is_read + '" title="' + (e.is_read ? '标记未读' : '标记已读') + '">' +
        (e.is_read ? '○' : '●') + '</button>' +
      '<button class="email-btn email-btn-delete" type="button" aria-label="删除" data-id="' + esc(e.id) + '" title="删除">✕</button>' +
    '</div>' +
  '</div>';
}

export const scripts = `
${drainPollingPages.toString()}
${esc.toString()}
${formatBytes.toString()}
${formatTime.toString()}
${compareActivation.toString()}
${buildEmailSrcdoc.toString()}
${emailCardHtml.toString()}
var state = {
  domain: '', rcptUser: '', emails: [], cursor: null, loading: false, hasMore: true,
  selectedId: null, totalLoaded: 0, view: 'home',
  trashMode: false,
  previousInbox: null,
  trash: { emails: [], cursor: null, loading: false, hasMore: true }
};
var allDomains = [];
var listRequestSeq = 0;
var detailRequestSeq = 0;
var trashRequestSeq = 0;

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

fetch('/api/domains')
  .then(function(r) { return r.json(); })
  .then(updateDomainSidebar)
  .catch(function() {});

updateBreadcrumb();

function searchMails() {
  var q = document.getElementById('search').value.trim();
  state.cursor = null; state.emails = []; state.hasMore = true; state.selectedId = null; state.totalLoaded = 0;
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
  if (q) {
    state.domain = '';
    state.rcptUser = '';
    state.view = 'search';
    document.querySelectorAll('.rcpt-item').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('active'); });
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
  syncHash();
}
var searchTimer = null;
function toggleSearchClear() {
  var btn = document.getElementById('search-clear');
  var hasValue = document.getElementById('search').value.length > 0;
  btn.classList.toggle('visible', hasValue);
}
document.getElementById('search').addEventListener('input', function() {
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

function updateDomainSidebar(domains) {
  allDomains = domains || [];
  var total = 0;
  for (var i = 0; i < allDomains.length; i++) {
    total += allDomains[i].count;
  }
  document.getElementById('total-count').textContent = allDomains.length + ' 个域名 / ' + total + ' 封邮件';

  document.querySelectorAll('.domain-tree').forEach(function(tree) {
    var domain = tree.dataset.domain;
    var domainData = null;
    for (var i = 0; i < allDomains.length; i++) {
      if (allDomains[i].domain === domain) {
        domainData = allDomains[i];
        break;
      }
    }
    if (!domainData) return;
    var domainCount = tree.querySelector('.domain-count');
    if (domainCount) domainCount.textContent = domainData.count + '封 · ' + domainData.recipients.length + '账户';

    tree.querySelectorAll('.rcpt-item').forEach(function(item) {
      var rcpt = item.dataset.rcpt;
      var rcptData = null;
      for (var j = 0; j < domainData.recipients.length; j++) {
        if (domainData.recipients[j].rcpt_user === rcpt) {
          rcptData = domainData.recipients[j];
          break;
        }
      }
      if (!rcptData) return;
      var rcptCount = item.querySelector('.rcpt-count');
      if (rcptCount) rcptCount.textContent = rcptData.total;
      var badge = item.querySelector('.rcpt-unread-badge');
      if (rcptData.unread > 0) {
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'rcpt-unread-badge';
          var countEl = item.querySelector('.rcpt-count');
          item.insertBefore(badge, countEl);
        }
        badge.textContent = rcptData.unread;
      } else if (badge) {
        badge.remove();
      }
    });
  });
}

function refreshDomainCounts() {
  fetch('/api/domains')
    .then(function(r) { return r.json(); })
    .then(updateDomainSidebar)
    .catch(function() {});
}

function updateEmailReadState(id, isRead) {
  for (var i = 0; i < state.emails.length; i++) {
    if (state.emails[i].id === id) {
      state.emails[i].is_read = isRead ? 1 : 0;
      return;
    }
  }
}

document.querySelector('.domain-list').addEventListener('click', function(e) {
  var copyBtn = e.target.closest('.rcpt-copy');
  if (copyBtn) {
    copyText(copyBtn.dataset.addr || '', copyBtn);
    return;
  }

  var rcptItem = e.target.closest('.rcpt-item');
  if (rcptItem) {
    showRcptView(rcptItem.dataset.domain, rcptItem.dataset.rcpt);
    return;
  }

  var domainHeader = e.target.closest('.domain-tree-header');
  if (domainHeader) {
    var tree = domainHeader.closest('.domain-tree');
    var isOpen = tree.classList.contains('open');
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('open'); });
    if (!isOpen) tree.classList.add('open');
    showDomainView(tree.dataset.domain);
    return;
  }
});

function activateSidebar(domain, rcpt, openTree) {
  document.querySelectorAll('.rcpt-item').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('active'); });
  document.querySelectorAll('.domain-tree').forEach(function(tree) {
    if (tree.dataset.domain !== domain) return;
    tree.classList.add('active');
    if (openTree) tree.classList.add('open');
    if (rcpt) {
      tree.querySelectorAll('.rcpt-item').forEach(function(item) {
        if (item.dataset.rcpt === rcpt) item.classList.add('active');
      });
    }
  });
}

function resetListAndPreview() {
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
}

function showDomainView(domain) {
  activateSidebar(domain, '', false);
  state.domain = domain;
  state.rcptUser = '';
  state.selectedId = null;
  state.emails = []; state.cursor = null; state.hasMore = true; state.totalLoaded = 0;
  state.view = 'domain';
  updateBreadcrumb();
  resetListAndPreview();
  loadEmails(true);
  syncHash();
}

function showRcptView(domain, rcpt) {
  activateSidebar(domain, rcpt, true);
  state.domain = domain;
  state.rcptUser = rcpt;
  state.selectedId = null;
  state.emails = []; state.cursor = null; state.hasMore = true; state.totalLoaded = 0;
  state.view = 'rcpt';
  updateBreadcrumb();
  resetListAndPreview();
  loadEmails(true);
  syncHash();
}

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
  } else if (state.view === 'search') {
    html = '<span class="bc-label">搜索结果</span>';
  } else if (state.view === 'trash') {
    html = '<span class="bc-label">回收站</span>';
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
  state.domain = '';
  state.rcptUser = '';
  state.cursor = null;
  state.emails = [];
  state.hasMore = true;
  state.selectedId = null;
  state.totalLoaded = 0;
  state.view = 'home';
  activateSidebar('', '', false);
  updateBreadcrumb();
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  loadEmails(true);
  syncHash();
}

document.getElementById('email-list').addEventListener('click', function(e) {
  var restoreBtn = e.target.closest('.email-btn-restore');
  if (restoreBtn) {
    e.stopPropagation();
    var rid = restoreBtn.dataset.id;
    fetch('/api/emails/' + rid + '/restore', { method: 'POST' })
      .then(function(r) {
        if (!r.ok) throw new Error('restore failed');
        loadTrash(true);
        refreshDomainCounts();
      })
      .catch(function() { showToastMessage('恢复失败，请重试'); });
    return;
  }

  var delBtn = e.target.closest('.email-btn-delete');
  if (delBtn) {
    e.stopPropagation();
    var id = delBtn.dataset.id;
    showConfirm('确定要删除这封邮件吗？', function() {
      fetch('/api/emails/' + id, { method: 'DELETE' })
        .then(function(r) {
          if (!r.ok) throw new Error('delete failed');
          var card = document.querySelector('.email-card[data-id="' + id + '"]');
          if (card) card.remove();
          state.emails = state.emails.filter(function(e) { return e.id !== id; });
          state.totalLoaded = state.emails.length;
          renderedEmailCount = state.emails.length;
          document.getElementById('email-count').textContent = state.totalLoaded + ' 封';
          if (state.selectedId === id) {
            state.selectedId = null;
            document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
          }
          refreshDomainCounts();
        })
        .catch(function() { showToastMessage('删除失败，请重试'); });
    });
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
            readBtn.setAttribute('aria-label', '标记未读');
          } else {
            card.classList.add('unread');
            readBtn.textContent = '●';
            readBtn.dataset.read = '0';
            readBtn.title = '标记已读';
            readBtn.setAttribute('aria-label', '标记已读');
          }
          updateEmailReadState(rid, nowRead);
          refreshDomainCounts();
        }
      })
      .catch(function() {});
    return;
  }

  var item = e.target.closest('.email-card');
  if (!item) return;
  if (state.trashMode) {
    document.querySelectorAll('.email-card').forEach(function(el) { el.classList.remove('active'); });
    item.classList.add('active');
    document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>已删除邮件请先恢复后查看</span></div>';
    return;
  }
  state.selectedId = item.dataset.id;
  document.querySelectorAll('.email-card').forEach(function(el) { el.classList.remove('active'); });
  item.classList.add('active');
  item.classList.remove('unread');
  var btn = item.querySelector('.email-btn-read');
  if (btn) { btn.textContent = '○'; btn.dataset.read = '1'; btn.title = '标记未读'; }
  updateEmailReadState(item.dataset.id, true);
  loadEmailDetail(item.dataset.id);
});

document.getElementById('email-list').addEventListener('scroll', function(e) {
  var el = e.target;
  if (state.view === 'trash') {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && state.trash.hasMore && !state.trash.loading) loadTrash();
    return;
  }
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && state.hasMore && !state.loading) loadEmails();
});

document.getElementById('btn-trash').addEventListener('click', function() {
  state.previousInbox = {
    domain: state.domain,
    rcptUser: state.rcptUser,
    view: state.view,
    search: document.getElementById('search').value
  };
  state.trashMode = true;
  state.view = 'trash';
  state.loading = false;
  state.selectedId = null;
  listRequestSeq++;
  detailRequestSeq++;
  document.getElementById('btn-trash').style.display = 'none';
  document.getElementById('btn-back').style.display = 'flex';
  document.getElementById('search').style.display = 'none';
  document.getElementById('email-count').style.display = '';
  document.querySelector('.domain-list').style.opacity = '0.3';
  document.querySelector('.domain-list').style.pointerEvents = 'none';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
  updateBreadcrumb();
  loadTrash(true);
  syncHash();
});
document.getElementById('btn-back').addEventListener('click', function() {
  var prev = state.previousInbox;
  state.previousInbox = null;
  state.trashMode = false;
  state.loading = false;
  listRequestSeq++;
  detailRequestSeq++;
  document.getElementById('btn-trash').style.display = 'flex';
  document.getElementById('btn-back').style.display = 'none';
  document.getElementById('search').style.display = '';
  document.getElementById('email-count').style.display = '';
  document.querySelector('.domain-list').style.opacity = '';
  document.querySelector('.domain-list').style.pointerEvents = '';
  state.cursor = null; state.emails = []; state.hasMore = true; state.selectedId = null; state.totalLoaded = 0;
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
  if (prev) {
    state.domain = prev.domain || '';
    state.rcptUser = prev.rcptUser || '';
    state.view = prev.view || 'home';
    document.getElementById('search').value = prev.search || '';
    toggleSearchClear();
  }
  updateBreadcrumb();
  if (state.view === 'home') {
    loadHomeEmails();
  } else {
    activateSidebar(state.domain, state.rcptUser, state.view === 'rcpt');
    loadEmails(true);
    syncHash();
  }
});

function loadTrash(reset) {
  if ((state.trash.loading || !state.trash.hasMore) && !reset) return;
  var requestSeq = ++trashRequestSeq;
  state.trash.loading = true;
  if (reset) {
    state.trash.emails = [];
    state.trash.cursor = null;
    state.trash.hasMore = true;
    document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  }
  var params = new URLSearchParams({ limit: '50' });
  if (state.trash.cursor) params.set('cursor', state.trash.cursor);
  fetch('/api/emails/deleted?' + params)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (requestSeq !== trashRequestSeq || state.view !== 'trash') return;
      var emails = data.emails || [];
      if (reset) state.trash.emails = emails;
      else state.trash.emails.push.apply(state.trash.emails, emails);
      state.trash.cursor = data.cursor;
      state.trash.hasMore = !!data.cursor;
      renderTrashList();
    })
    .catch(function() {
      if (requestSeq !== trashRequestSeq || state.view !== 'trash') return;
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() {
      if (requestSeq === trashRequestSeq) state.trash.loading = false;
    });
}

function renderTrashList() {
  document.getElementById('email-count').textContent = state.trash.emails.length + (state.trash.hasMore ? '+' : '') + ' 封已删除';
  if (state.trash.emails.length === 0) {
    document.getElementById('email-list').innerHTML = '<div class="email-list-empty">回收站为空</div>';
    return;
  }
  document.getElementById('email-list').innerHTML = state.trash.emails.map(function(e) {
    var timeStr = formatTime(e.date);
    return '<div class="email-card" data-id="' + esc(e.id) + '">' +
      '<div class="email-card-top">' +
        '<span class="email-from">' + esc(e.mail_from) + '</span>' +
        '<span class="email-time">' + timeStr + '</span>' +
      '</div>' +
      '<div class="email-subject">' + esc(e.subject || '(无主题)') + '</div>' +
      '<div class="email-actions" style="display:flex;">' +
        '<button class="email-btn email-btn-restore" type="button" aria-label="恢复" data-id="' + esc(e.id) + '" title="恢复">↩</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

function loadEmails(reset) {
  if ((state.loading || !state.hasMore) && !reset) return;
  var requestSeq = ++listRequestSeq;
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
      if (requestSeq !== listRequestSeq) return;
      if (reset) state.emails = data.emails;
      else state.emails.push.apply(state.emails, data.emails);
      state.cursor = data.cursor;
      state.hasMore = !!data.cursor;
      state.totalLoaded = state.emails.length;
      renderEmailList(reset);
    })
    .catch(function() {
      if (requestSeq !== listRequestSeq) return;
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() {
      if (requestSeq === listRequestSeq) state.loading = false;
    });
}

var renderedEmailCount = 0;

function renderEmailList(reset) {
  var el = document.getElementById('email-list');
  document.getElementById('email-count').textContent = state.totalLoaded + ' 封';
  if (state.emails.length === 0) {
    el.innerHTML = state.view === 'search'
      ? '<div class="email-list-empty">没有找到匹配的邮件</div>'
      : '';
    renderedEmailCount = 0;
    return;
  }
  var html = state.emails.map(function(e) { return emailCardHtml(e, state.selectedId); }).join('');
  if (reset || renderedEmailCount === 0) {
    el.innerHTML = html;
  } else {
    el.insertAdjacentHTML('beforeend', html);
  }
  renderedEmailCount = state.emails.length;
}

function loadEmailDetail(id) {
  var requestSeq = ++detailRequestSeq;
  var preview = document.getElementById('preview');
  preview.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/' + id)
    .then(function(r) { return r.json(); })
    .then(function(email) {
      if (requestSeq !== detailRequestSeq) return;
      var hasHtml = email.body_html && email.body_html.length > 0;
      var hasText = email.body_text && email.body_text.length > 0;
      var body;
      var iframeCardId = null;
      var rawHtmlSrc = hasHtml ? email.body_html : null;

      if (hasHtml) {
        iframeCardId = 'email-card-' + id;
        body = '<div class="email-iframe-card" id="' + iframeCardId + '"></div>';
      } else if (hasText) {
        body = '<div class="plain-text">' + esc(email.body_text) + '</div>';
      } else {
        body = '<div class="email-list-empty">此邮件没有正文内容</div>';
      }

      preview.innerHTML =
        '<div class="preview-content">' +
          '<div class="preview-header">' +
            '<h2 class="preview-subject">' + esc(email.subject || '(无主题)') + '</h2>' +
            '<div class="preview-meta">' +
              '<span class="from">' + esc(email.mail_from) + '</span>' +
              '<span class="arrow">→</span>' +
              '<span>' + esc(email.rcpt_to) + '</span>' +
              '<button class="meta-copy" data-addr="' + esc(email.rcpt_to).replace(/"/g, '&quot;') + '" title="复制地址" aria-label="复制地址"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>' +
            '</div>' +
            '<div class="preview-date">' + new Date(email.date).toLocaleString('zh-CN') + '</div>' +
          '</div>' +
          '<div class="attachment-list" id="attachment-list-' + id + '"></div>' +
          '<div class="preview-body">' + body + '</div>' +
        '</div>';

      loadEmailAttachments(id, requestSeq);

      if (iframeCardId && rawHtmlSrc) {
        var iframeSrcdoc = buildEmailSrcdoc(rawHtmlSrc, false);
        mountEmailIframe(iframeCardId, iframeSrcdoc, rawHtmlSrc);
      }
      if (!email.is_read) {
        fetch('/api/emails/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true }) })
          .then(function() {
            updateEmailReadState(id, true);
            refreshDomainCounts();
          })
          .catch(function() {});
      }
    })
    .catch(function() {
      if (requestSeq !== detailRequestSeq) return;
      preview.innerHTML = '<div class="error-msg">加载失败</div>';
    });
}

function loadEmailAttachments(id, requestSeq) {
  fetch('/api/emails/' + id + '/attachments')
    .then(function(r) { return r.json(); })
    .then(function(attachments) {
      if (requestSeq !== detailRequestSeq) return;
      var el = document.getElementById('attachment-list-' + id);
      if (!el || !attachments || attachments.length === 0) return;
      el.innerHTML = '<div class="attachment-title">附件</div>' +
        attachments.map(function(att) {
          var status = att.object_status || 'unknown';
          var statusText = status === 'missing' ? '历史文件缺失' : '存储状态未知';
          var content =
            '<span class="attachment-icon">📎</span>' +
            '<span class="attachment-name">' + esc(att.filename || '未命名附件') + '</span>' +
            '<span class="attachment-size">' + esc(formatBytes(att.size || 0)) + '</span>';
          if (status !== 'available') {
            return '<span class="attachment-item attachment-unavailable" aria-disabled="true" title="' + statusText + '">' +
              content + '<span class="attachment-status">' + statusText + '</span></span>';
          }
          var href = '/api/attachments/' + encodeURIComponent(att.id);
          return '<a class="attachment-item" href="' + href + '" target="_blank" rel="noopener noreferrer">' +
            content +
          '</a>';
        }).join('');
    })
    .catch(function() {});
}

function mountEmailIframe(cardId, srcdoc, rawHtml) {
  setTimeout(function() {
    var card = document.getElementById(cardId);
    if (!card) return;
    var iframe = document.createElement('iframe');
    iframe.className = 'email-iframe';
    iframe.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('scrolling', 'no');
    iframe.srcdoc = srcdoc;

    var revealed = false;
    var measureHeight = function() {
      var doc = iframe.contentDocument;
      if (!doc) return 0;
      var values = [];
      var add = function(v) {
        if (v && isFinite(v)) values.push(v);
      };
      var root = doc.documentElement;
      var body = doc.body;
      if (root) {
        add(root.scrollHeight);
        add(root.offsetHeight);
        add(root.clientHeight);
        add(root.getBoundingClientRect().height);
      }
      if (body) {
        add(body.scrollHeight);
        add(body.offsetHeight);
        add(body.clientHeight);
        var bodyRect = body.getBoundingClientRect();
        add(bodyRect.height);
        var maxBottom = bodyRect.bottom;
        var nodes = body.querySelectorAll('*');
        for (var i = 0; i < nodes.length; i++) {
          var rect = nodes[i].getBoundingClientRect();
          if (rect.width || rect.height) maxBottom = Math.max(maxBottom, rect.bottom);
        }
        add(maxBottom - Math.min(bodyRect.top, 0));
      }
      return values.length ? Math.ceil(Math.max.apply(Math, values)) : 0;
    };
    var measureLight = function() {
      var doc = iframe.contentDocument;
      if (!doc) return 0;
      var root = doc.documentElement;
      var body = doc.body;
      var values = [];
      var add = function(v) {
        if (v && isFinite(v)) values.push(v);
      };
      if (root) add(root.scrollHeight);
      if (body) add(body.scrollHeight);
      return values.length ? Math.ceil(Math.max.apply(Math, values)) : 0;
    };
    var resize = function() {
      var h = measureHeight();
      if (h > 0) iframe.style.height = (h + 2) + 'px';
    };
    var resizeLight = function() {
      var h = measureLight();
      if (h > 0) iframe.style.height = (h + 2) + 'px';
    };
    var reveal = function() {
      if (revealed) return;
      var doc = iframe.contentDocument;
      if (!doc || !doc.documentElement) return;
      if (measureHeight() === 0) return;
      resize();
      iframe.classList.add('ready');
      card.classList.add('iframe-ready');
      revealed = true;
      clearInterval(settleTimer);
    };
    var wired = false;
    var wireDoc = function() {
      if (wired) return;
      var doc = iframe.contentDocument;
      if (!doc) return;
      wired = true;
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function() { resizeLight(); });
        ro.observe(doc.documentElement);
        if (doc.body) ro.observe(doc.body);
      }
      var imgs = doc.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (!img.complete) img.addEventListener('load', resizeLight, { once: true });
        img.addEventListener('error', resizeLight, { once: true });
      }
    };
    var settleChecks = 0;
    var settleTimer = setInterval(function() {
      resizeLight();
      reveal();
      settleChecks++;
      if (settleChecks >= 20) clearInterval(settleTimer);
    }, 250);

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

    var remoteButton = document.createElement('button');
    remoteButton.type = 'button';
    remoteButton.className = 'remote-content-button';
    remoteButton.textContent = '加载远程图片和字体';
    remoteButton.title = '可能向发件方暴露你的 IP 地址和打开时间';
    remoteButton.addEventListener('click', function() {
      remoteButton.disabled = true;
      remoteButton.textContent = '正在加载远程内容…';
      iframe.srcdoc = buildEmailSrcdoc(rawHtml, true);
      setTimeout(function() { if (remoteButton.parentNode) remoteButton.remove(); }, 500);
    });
    card.appendChild(remoteButton);
    card.appendChild(iframe);
  }, 0);
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (err) {}
  document.body.removeChild(ta);
}

function copyText(text, btn) {
  var done = function() {
    if (!btn || btn.dataset.copying) return;
    btn.dataset.copying = '1';
    var orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '✓';
    setTimeout(function() {
      btn.classList.remove('copied');
      btn.innerHTML = orig;
      delete btn.dataset.copying;
    }, 1200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function() { fallbackCopy(text); done(); });
  } else {
    fallbackCopy(text);
    done();
  }
}

document.getElementById('preview').addEventListener('click', function(e) {
  var btn = e.target.closest('.meta-copy');
  if (btn) copyText(btn.dataset.addr || '', btn);
});

var applyingHash = false;

function buildHash() {
  if (state.view === 'domain') return '#/d/' + encodeURIComponent(state.domain);
  if (state.view === 'rcpt') return '#/d/' + encodeURIComponent(state.domain) + '/' + encodeURIComponent(state.rcptUser);
  if (state.view === 'search') return '#/s/' + encodeURIComponent(document.getElementById('search').value.trim());
  if (state.view === 'trash') return '#/trash';
  return '#/';
}

function syncHash() {
  if (applyingHash) return;
  var h = buildHash();
  if (h === '#/' && (location.hash === '' || location.hash === '#')) return;
  if (location.hash !== h) location.hash = h;
}

function applyHash() {
  applyingHash = true;
  try {
    var raw = location.hash;
    if (raw.charAt(0) === '#') raw = raw.slice(1);
    if (raw.charAt(0) === '/') raw = raw.slice(1);
    var parts = raw.split('/');
    var first = parts[0] || '';
    if (state.trashMode && first !== 'trash') {
      state.trashMode = false;
      state.previousInbox = null;
      state.loading = false;
      listRequestSeq++;
      detailRequestSeq++;
      document.getElementById('btn-trash').style.display = 'flex';
      document.getElementById('btn-back').style.display = 'none';
      document.getElementById('search').style.display = '';
      document.querySelector('.domain-list').style.opacity = '';
      document.querySelector('.domain-list').style.pointerEvents = '';
    }
    if (first === 'trash') {
      if (!state.trashMode) document.getElementById('btn-trash').click();
    } else if (first === 'd' && parts[1]) {
      document.getElementById('search').value = '';
      toggleSearchClear();
      if (parts[2]) showRcptView(decodeURIComponent(parts[1]), decodeURIComponent(parts[2]));
      else showDomainView(decodeURIComponent(parts[1]));
    } else if (first === 's' && parts.length > 1) {
      var input = document.getElementById('search');
      input.value = decodeURIComponent(parts.slice(1).join('/'));
      toggleSearchClear();
      searchMails();
    } else {
      document.getElementById('search').value = '';
      toggleSearchClear();
      loadHomeEmails();
    }
  } catch (err) {
    loadHomeEmails();
  } finally {
    applyingHash = false;
  }
}

window.addEventListener('hashchange', function() {
  if ((location.hash || '#/') === buildHash()) return;
  applyHash();
});

function initRoute() {
  if (location.hash && location.hash !== '#' && location.hash !== '#/') applyHash();
  else loadHomeEmails();
}

function moveSelection(dir) {
  var cards = document.querySelectorAll('#email-list .email-card');
  if (!cards.length) return;
  var idx = -1;
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].classList.contains('active')) { idx = i; break; }
  }
  var next = idx === -1 ? (dir > 0 ? 0 : cards.length - 1) : idx + dir;
  if (next < 0 || next >= cards.length) return;
  cards[next].click();
  cards[next].scrollIntoView({ block: 'nearest' });
}

document.addEventListener('keydown', function(e) {
  if (e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
  var target = e.target;
  var tag = (target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || target.isContentEditable) {
    if (e.key === 'Escape') target.blur();
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search').focus();
    return;
  }
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    moveSelection(e.key === 'j' ? 1 : -1);
    return;
  }
  if (e.key === 'Delete' && state.selectedId && !state.trashMode) {
    var card = document.querySelector('.email-card[data-id="' + state.selectedId + '"]');
    var del = card && card.querySelector('.email-btn-delete');
    if (del) del.click();
  }
});

var lastSeen = null;
var pollInFlight = false;

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

function showToastMessage(text) {
  var container = document.getElementById('toast-container');
  if (!container) return;
  var el = document.createElement('div');
  el.className = 'toast toast-message';
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="toast-subject">' + esc(text) + '</div>';
  el.addEventListener('click', function() { dismissToast(el); });
  container.appendChild(el);
  setTimeout(function() { dismissToast(el); }, 4000);
}

function showConfirm(message, onConfirm) {
  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  var dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML =
    '<div class="confirm-message">' + esc(message) + '</div>' +
    '<div class="confirm-actions">' +
      '<button type="button" class="confirm-btn confirm-cancel">取消</button>' +
      '<button type="button" class="confirm-btn confirm-ok">删除</button>' +
    '</div>';
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  var cancelBtn = dialog.querySelector('.confirm-cancel');
  var okBtn = dialog.querySelector('.confirm-ok');
  var close = function() {
    document.removeEventListener('keydown', onKeydown);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };
  var onKeydown = function(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      close();
      onConfirm();
    }
  };
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', function() { close(); onConfirm(); });
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKeydown);
  cancelBtn.focus();
}

function drainSince(url, collected) {
  return drainPollingPages(function(cursor) {
    var pageUrl = cursor
      ? '/api/emails/since?limit=100&cursor=' + encodeURIComponent(cursor)
      : url;
    return fetch(pageUrl).then(function(r) { return r.json(); });
  }, collected);
}

function prependNewEmails(emails) {
  var existingIds = {};
  for (var i = 0; i < state.emails.length; i++) existingIds[state.emails[i].id] = true;
  var fresh = [];
  for (var j = 0; j < emails.length; j++) {
    if (!existingIds[emails[j].id]) { existingIds[emails[j].id] = true; fresh.push(emails[j]); }
  }
  if (!fresh.length) return;
  state.emails = fresh.concat(state.emails);
  state.totalLoaded = state.emails.length;
  renderedEmailCount = state.emails.length;
  var countEl = document.getElementById('email-count');
  if (countEl) countEl.textContent = state.totalLoaded + ' 封';
  var listEl = document.getElementById('email-list');
  if (listEl && listEl.querySelector('.email-card')) {
    listEl.insertAdjacentHTML('afterbegin', fresh.map(function(e) { return emailCardHtml(e, state.selectedId); }).join(''));
  }
}

function pollForNewMail() {
  if (pollInFlight || !lastSeen) return;
  pollInFlight = true;
  var url = '/api/emails/since?limit=100&seq=' + encodeURIComponent(lastSeen.seq) + '&id=' + encodeURIComponent(lastSeen.id);
  drainSince(url, [])
    .then(function(emails) {
      if (!emails.length) return;
      emails.sort(compareActivation);
      for (var i = 0; i < emails.length; i++) showToast(emails[i]);
      var newest = emails[emails.length - 1];
      lastSeen = { seq: Number(newest.activation_seq), id: newest.id || '' };
      refreshDomainCounts();
      if (state.view === 'home' && !state.trashMode) prependNewEmails(emails);
    })
    .catch(function() {})
    .finally(function() { pollInFlight = false; });
}

function startPolling() {
  setInterval(pollForNewMail, 15000);
}

fetch('/api/emails/since?initial=1')
  .then(function(r) { return r.json(); })
  .then(function(data) {
    var watermark = data.watermark || { seq: 0, id: '' };
    lastSeen = { seq: Number(watermark.seq || 0), id: watermark.id || '' };
    initRoute();
    startPolling();
  })
  .catch(function() {
    lastSeen = { seq: 0, id: '' };
    initRoute();
    startPolling();
  });
`;
