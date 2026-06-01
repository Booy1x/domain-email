import { styles } from './styles';
import { scripts } from './scripts';

interface DomainData {
  domain: string;
  count: number;
  recipients: { rcpt_user: string; total: number; unread: number; last_date: string }[];
}

export function inboxPage(domains: DomainData[]): string {
  const domainItems = domains.length === 0
    ? `<li class="domain-empty">暂无域名</li>`
    : domains.map(d => {
        const rcptItems = d.recipients.map(r =>
          `<li class="rcpt-item" data-domain="${escHtml(d.domain)}" data-rcpt="${escHtml(r.rcpt_user)}">
            <span class="rcpt-avatar" style="background:${stringToColor(r.rcpt_user)}">${escHtml(r.rcpt_user.charAt(0).toUpperCase())}</span>
            <span class="rcpt-name">${escHtml(r.rcpt_user)}</span>
            ${r.unread > 0 ? `<span class="rcpt-unread-badge">${r.unread}</span>` : ''}
            <span class="rcpt-count">${r.total}</span>
          </li>`
        ).join('');
        return `<li class="domain-tree" data-domain="${escHtml(d.domain)}">
          <div class="domain-tree-header">
            <span class="tree-arrow">▶</span>
            <span class="domain-avatar" style="background:${stringToColor(d.domain)}">${escHtml(d.domain.charAt(0).toUpperCase())}</span>
            <span class="domain-name">${escHtml(d.domain)}</span>
            <span class="domain-count">${d.count}封 · ${d.recipients.length}账户</span>
          </div>
          <ul class="rcpt-list">${rcptItems}</ul>
        </li>`;
      }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<script>
(function(){
  var t = localStorage.getItem('theme') || 'dark';
  document.documentElement.className = t;
})();
<\/script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Domain Inbox</title>
<style>${styles}</style>
</head>
<body>
<div class="app">

  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <rect x="2" y="5" width="20" height="14" rx="2.5" stroke-width="1.4"/>
            <path d="M2 8.5l8.7 5.8a1.5 1.5 0 001.6 0L21 8.5" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="17.5" cy="7" r="3" fill="var(--accent)" stroke="var(--bg-surface)" stroke-width="1.5" opacity="0.85"/>
            <text x="17.5" y="8.2" text-anchor="middle" font-size="3.5" font-weight="700" fill="var(--bg-surface)" font-family="monospace" stroke="none">D</text>
          </svg>
        </div>
        <div class="logo-text">
          <h1><span class="logo-word-domain">Domain</span><span class="logo-word-inbox">Inbox</span></h1>
          <span class="logo-sub">多域名邮件收件箱</span>
        </div>
      </div>
    </div>
    <div class="sidebar-label">域名 / 收件人</div>
    <ul class="domain-list">${domainItems}</ul>
    <div class="sidebar-footer">
      <span class="domain-total" id="total-count">0 个域名</span>
      <button class="theme-toggle" id="theme-toggle" title="切换主题">
        <svg class="icon icon-sun" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
        <svg class="icon icon-moon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
      </button>
    </div>
  </aside>

  <main class="main">
    <div class="toolbar">
      <div class="search-wrap">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="search" type="text" placeholder="搜索邮件..." class="search-input">
        <button id="search-clear" class="search-clear" title="清除搜索">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <span class="email-total" id="email-count"></span>
      <button id="btn-trash" class="btn-icon" title="回收站" style="margin-left:auto;">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
      <button id="btn-back" class="btn-icon" title="返回收件箱" style="display:none;">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
      </button>
    </div>

    <div class="split">
      <div class="email-list" id="email-list">
      </div>
      <div class="preview" id="preview">
        <div class="preview-empty">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"/></svg>
          <span>选择一封邮件阅读</span>
        </div>
      </div>
    </div>
  </main>
</div>

<div class="toast-container" id="toast-container"></div>

<script>${scripts}<\/script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stringToColor(str: string) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var h = Math.abs(hash) % 360;
  var s = 35 + (Math.abs(hash >> 8) % 20);
  var l = 40 + (Math.abs(hash >> 16) % 15);
  return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}
