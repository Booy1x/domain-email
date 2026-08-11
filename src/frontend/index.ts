import { styles } from './styles';
import { bootTheme, scripts } from './scripts';

interface DomainData {
  domain: string;
  count: number;
  recipients: { rcpt_user: string; total: number; unread: number; last_date: string }[];
}

export function inboxPage(domains: DomainData[], version?: string): string {
  const domainItems = domains.length === 0
    ? `<li class="domain-empty">暂无域名</li>`
    : domains.map(d => {
        const rcptItems = d.recipients.length === 0
          ? `<li class="rcpt-empty">该域名暂无收件人</li>`
          : d.recipients.map(r =>
          `<li class="rcpt-item" data-domain="${escHtml(d.domain)}" data-rcpt="${escHtml(r.rcpt_user)}" tabindex="0" role="button">
            <span class="rcpt-avatar" style="background:${stringToColor(r.rcpt_user)}">${escHtml(r.rcpt_user.charAt(0).toUpperCase())}</span>
            <span class="rcpt-name">${escHtml(r.rcpt_user)}</span>
            ${r.unread > 0 ? `<span class="rcpt-unread-badge">${r.unread}</span>` : ''}
            <span class="rcpt-count">${r.total}</span>
            <button class="rcpt-copy" data-addr="${escHtml(r.rcpt_user)}@${escHtml(d.domain)}" title="复制地址" aria-label="复制地址"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
          </li>`
        ).join('');
        return `<li class="domain-tree" data-domain="${escHtml(d.domain)}">
          <div class="domain-tree-header" tabindex="0" role="button">
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
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Domain Inbox</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap">
<script>(${bootTheme.toString()})();<\/script>
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
    <div class="inbox-entry" id="inbox-entry" role="button" tabindex="0" title="全部邮件">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76"/></svg>
      <span class="inbox-label">收件箱</span>
    </div>
    <div class="inbox-entry" id="btn-sent" role="button" tabindex="0" title="已发送">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      <span class="inbox-label">已发送</span>
    </div>
    <ul class="domain-list">${domainItems}</ul>
    <div class="sidebar-footer">
      <span class="domain-total" id="total-count">0 个域名</span>
      <button id="btn-theme" class="theme-toggle" title="切换深色 / 浅色" aria-label="切换深色模式">
        <svg class="icon-moon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
      <span class="app-version" title="部署版本">v${escHtml(version || 'dev')}</span>
    </div>
  </aside>

  <main class="main">
    <div class="toolbar">
      <div class="search-wrap">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="search" type="text" placeholder="搜索邮件..." class="search-input">
        <button id="search-clear" class="search-clear" title="清除搜索" aria-label="清除搜索">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <span class="email-total" id="email-count"></span>
      <button id="btn-trash" class="btn-icon" title="回收站" aria-label="回收站" style="margin-left:auto;">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
      <button id="btn-back" class="btn-icon" title="返回收件箱" aria-label="返回收件箱" style="display:none;">
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
