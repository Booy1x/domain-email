export const scripts = `
var state = {
  domain: '', rcptUser: '', emails: [], cursor: null, loading: false, hasMore: true,
  selectedId: null, totalLoaded: 0, view: 'home'
};
var allDomains = [];
var listRequestSeq = 0;
var detailRequestSeq = 0;
var trashRequestSeq = 0;
var previousInboxState = null;
var trashState = { emails: [], cursor: null, loading: false, hasMore: true };

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
loadHomeEmails();

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
  updateBreadcrumb();
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  loadEmails(true);
}

document.getElementById('email-list').addEventListener('click', function(e) {
  var restoreBtn = e.target.closest('.email-btn-restore');
  if (restoreBtn) {
    e.stopPropagation();
    var rid = restoreBtn.dataset.id;
    fetch('/api/emails/' + rid + '/restore', { method: 'POST' })
      .then(function() {
        loadTrash(true);
        refreshDomainCounts();
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
          refreshDomainCounts();
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
          updateEmailReadState(rid, nowRead);
          refreshDomainCounts();
        }
      })
      .catch(function() {});
    return;
  }

  var item = e.target.closest('.email-card');
  if (!item) return;
  if (trashMode) {
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
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && trashState.hasMore && !trashState.loading) loadTrash();
    return;
  }
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200 && state.hasMore && !state.loading) loadEmails();
});

var trashMode = false;
document.getElementById('btn-trash').addEventListener('click', function() {
  previousInboxState = {
    domain: state.domain,
    rcptUser: state.rcptUser,
    view: state.view,
    search: document.getElementById('search').value
  };
  trashMode = true;
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
});
document.getElementById('btn-back').addEventListener('click', function() {
  var prev = previousInboxState;
  previousInboxState = null;
  trashMode = false;
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
    loadEmails(true);
  }
});

function loadTrash(reset) {
  if ((trashState.loading || !trashState.hasMore) && !reset) return;
  var requestSeq = ++trashRequestSeq;
  trashState.loading = true;
  if (reset) {
    trashState.emails = [];
    trashState.cursor = null;
    trashState.hasMore = true;
    document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  }
  var params = new URLSearchParams({ limit: '50' });
  if (trashState.cursor) params.set('cursor', trashState.cursor);
  fetch('/api/emails/deleted?' + params)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (requestSeq !== trashRequestSeq || state.view !== 'trash') return;
      var emails = data.emails || [];
      if (reset) trashState.emails = emails;
      else trashState.emails.push.apply(trashState.emails, emails);
      trashState.cursor = data.cursor;
      trashState.hasMore = !!data.cursor;
      renderTrashList();
    })
    .catch(function() {
      if (requestSeq !== trashRequestSeq || state.view !== 'trash') return;
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() {
      if (requestSeq === trashRequestSeq) trashState.loading = false;
    });
}

function renderTrashList() {
  document.getElementById('email-count').textContent = trashState.emails.length + (trashState.hasMore ? '+' : '') + ' 封已删除';
  if (trashState.emails.length === 0) {
    document.getElementById('email-list').innerHTML = '<div class="email-list-empty">回收站为空</div>';
    return;
  }
  document.getElementById('email-list').innerHTML = trashState.emails.map(function(e) {
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
      renderEmailList();
    })
    .catch(function() {
      if (requestSeq !== listRequestSeq) return;
      document.getElementById('email-list').innerHTML = '<div class="error-msg">加载失败</div>';
    })
    .finally(function() {
      if (requestSeq === listRequestSeq) state.loading = false;
    });
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
  var requestSeq = ++detailRequestSeq;
  var preview = document.getElementById('preview');
  preview.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/' + id)
    .then(function(r) { return r.json(); })
    .then(function(email) {
      if (requestSeq !== detailRequestSeq) return;
      var hasHtml = email.body_html && email.body_html.length > 0;
      var hasText = email.body_text && email.body_text.length > 0;
      var isHtmlText = hasText && email.body_text.trim().charAt(0) === '<';
      var body;
      var iframeCardId = null;
      var rawHtmlSrc = hasHtml ? email.body_html : (isHtmlText ? email.body_text : null);

      if (hasHtml || isHtmlText) {
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
            '</div>' +
            '<div class="preview-date">' + new Date(email.date).toLocaleString('zh-CN') + '</div>' +
          '</div>' +
          '<div class="attachment-list" id="attachment-list-' + id + '"></div>' +
          '<div class="preview-body">' + body + '</div>' +
        '</div>';

      loadEmailAttachments(id, requestSeq);

      if (iframeCardId && rawHtmlSrc) {
        var iframeSrcdoc = buildEmailSrcdoc(rawHtmlSrc);
        mountEmailIframe(iframeCardId, iframeSrcdoc);
      }
      fetch('/api/emails/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_read: true }) })
        .then(function() {
          updateEmailReadState(id, true);
          refreshDomainCounts();
        })
        .catch(function() {});
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
          var href = '/api/attachments/' + encodeURIComponent(att.r2_key);
          return '<a class="attachment-item" href="' + href + '" target="_blank" rel="noopener noreferrer">' +
            '<span class="attachment-icon">📎</span>' +
            '<span class="attachment-name">' + esc(att.filename || '未命名附件') + '</span>' +
            '<span class="attachment-size">' + esc(formatBytes(att.size || 0)) + '</span>' +
          '</a>';
        }).join('');
    })
    .catch(function() {});
}

function formatBytes(size) {
  if (!size) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var value = size;
  var unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value = value / 1024;
    unit++;
  }
  return (unit === 0 ? value : value.toFixed(value >= 10 ? 0 : 1)) + ' ' + units[unit];
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

function buildEmailSrcdoc(rawHtml) {
  var base = [
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
  var csp = "default-src 'none'; img-src data: cid: https: http:; style-src 'unsafe-inline'; font-src data: https:; media-src data:; base-uri 'none';";
  return '<!doctype html><html><head>'
    + '<meta charset="utf-8">'
    + '<meta http-equiv="Content-Security-Policy" content="' + csp + '">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<base target="_blank">'
    + '<style>' + base + '</style>'
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
    var resize = function() {
      var h = measureHeight();
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
    };
    var wired = false;
    var wireDoc = function() {
      if (wired) return;
      var doc = iframe.contentDocument;
      if (!doc) return;
      wired = true;
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(function() { resize(); reveal(); });
        ro.observe(doc.documentElement);
        if (doc.body) ro.observe(doc.body);
      }
      var imgs = doc.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (!img.complete) img.addEventListener('load', resize, { once: true });
        img.addEventListener('error', resize, { once: true });
      }
    };
    var settleChecks = 0;
    var settleTimer = setInterval(function() {
      resize();
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
