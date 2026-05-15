// Inbox frontend — dual theme with CSS variables
// Design: Editorial precision — warm ink on cool paper

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
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
  tailwind.config = {
    darkMode: 'class',
    theme: {
      extend: {
        fontFamily: {
          sans: ['"DM Sans"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
          serif: ['"DM Serif Display"', '"Noto Serif SC"', 'Georgia', 'serif'],
          mono: ['"JetBrains Mono"', 'monospace']
        }
      }
    }
  }
<\/script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap');

  :root {
    --bg: #0c0c0e;
    --bg-surface: #131316;
    --bg-elevated: #1a1a1e;
    --bg-hover: rgba(255,255,255,0.04);
    --bg-active: rgba(255,255,255,0.08);
    --border: rgba(255,255,255,0.06);
    --border-strong: rgba(255,255,255,0.12);
    --text-1: #e8e6e3;
    --text-2: #8a8784;
    --text-3: #555350;
    --accent: #c8956c;
    --accent-dim: rgba(200,149,108,0.15);
    --accent-text: #d4a87a;
    --red: #c97b7b;
    --scrollbar: rgba(255,255,255,0.08);
    --scrollbar-hover: rgba(255,255,255,0.16);
    --radius: 6px;
  }

  .light {
    --bg: #f5f3f0;
    --bg-surface: #faf9f7;
    --bg-elevated: #ffffff;
    --bg-hover: rgba(0,0,0,0.03);
    --bg-active: rgba(0,0,0,0.06);
    --border: rgba(0,0,0,0.08);
    --border-strong: rgba(0,0,0,0.15);
    --text-1: #1a1917;
    --text-2: #6b6865;
    --text-3: #a3a09c;
    --accent: #b07d56;
    --accent-dim: rgba(176,125,86,0.12);
    --accent-text: #8a6340;
    --red: #b05a5a;
    --scrollbar: rgba(0,0,0,0.1);
    --scrollbar-hover: rgba(0,0,0,0.2);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }

  body {
    font-family: 'DM Sans', 'Noto Sans SC', system-ui, sans-serif;
    background: var(--bg);
    color: var(--text-1);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background 0.3s ease, color 0.3s ease;
  }

  * { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
  *::-webkit-scrollbar { width: 6px; height: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }
  *::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; overflow: hidden; }

  /* ── Sidebar ── */
  .sidebar {
    width: 260px; min-width: 260px;
    display: flex; flex-direction: column;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
  }

  .sidebar-header {
    padding: 24px 20px 20px;
    border-bottom: 1px solid var(--border);
  }

  .logo { display: flex; align-items: center; gap: 14px; }

  .logo-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: linear-gradient(135deg, var(--accent-dim), rgba(200,149,108,0.06));
    border: 1px solid rgba(200,149,108,0.18);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    position: relative; overflow: hidden;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .logo-icon::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 30% 25%, rgba(200,149,108,0.12), transparent 60%);
    pointer-events: none;
  }
  .logo:hover .logo-icon {
    border-color: rgba(200,149,108,0.35);
    box-shadow: 0 0 16px rgba(200,149,108,0.1);
  }
  .logo-icon svg { width: 20px; height: 20px; color: var(--accent); position: relative; z-index: 1; }

  .logo-text { display: flex; flex-direction: column; gap: 1px; }
  .logo-text h1 {
    font-family: 'DM Serif Display', 'Noto Serif SC', Georgia, serif;
    font-size: 16px; font-weight: 400; letter-spacing: 0.03em;
    color: var(--text-1); line-height: 1.25;
    display: flex; align-items: baseline; gap: 3px;
  }
  .logo-text h1 .logo-word-domain { opacity: 0.55; font-size: 14px; }
  .logo-text h1 .logo-word-inbox { color: var(--accent-text); }
  .logo-text .logo-sub {
    font-family: 'Noto Serif SC', 'DM Serif SC', Georgia, serif;
    font-size: 10.5px; color: var(--text-3);
    letter-spacing: 0.16em; margin-top: 1px;
    font-weight: 400;
  }
  .logo-text .logo-sub::before {
    content: ''; display: inline-block; width: 10px; height: 1px;
    background: var(--accent); opacity: 0.4; vertical-align: middle;
    margin-right: 6px; position: relative; top: -1px;
  }

  .sidebar-label {
    padding: 16px 20px 8px;
    font-size: 9px; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--text-3);
  }

  .domain-list { flex: 1; overflow-y: auto; list-style: none; padding: 4px 8px; }

  .domain-tree { margin-bottom: 1px; }
  .domain-tree-header {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; cursor: pointer; border-radius: var(--radius);
    transition: background 0.15s ease; user-select: none;
  }
  .domain-tree-header:hover { background: var(--bg-hover); }
  .domain-tree.active > .domain-tree-header { background: var(--bg-active); }
  .domain-tree.active > .domain-tree-header .domain-name { color: var(--text-1); font-weight: 500; }

  .tree-arrow {
    font-size: 8px; color: var(--text-3); flex-shrink: 0; width: 10px;
    transition: transform 0.2s ease; display: inline-block;
  }
  .domain-tree.open > .domain-tree-header .tree-arrow { transform: rotate(90deg); }

  .domain-avatar {
    width: 26px; height: 26px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.9);
    flex-shrink: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }

  .domain-name {
    flex: 1; font-size: 13px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    transition: color 0.15s ease;
  }

  .domain-count {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 500;
    color: var(--text-3); background: var(--bg-hover);
    padding: 2px 7px; border-radius: 10px; min-width: 26px; text-align: center;
  }

  .rcpt-list {
    list-style: none; padding: 0; margin: 0; display: none;
  }
  .domain-tree.open > .rcpt-list { display: block; }

  .rcpt-item {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px 6px 36px; cursor: pointer; border-radius: var(--radius);
    transition: background 0.15s ease;
  }
  .rcpt-item:hover { background: var(--bg-hover); }
  .rcpt-item.active { background: var(--bg-active); }
  .rcpt-item.active .rcpt-name { color: var(--text-1); font-weight: 500; }

  .rcpt-avatar {
    width: 22px; height: 22px; border-radius: 5px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.9);
    flex-shrink: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.2);
  }
  .rcpt-name {
    flex: 1; font-size: 12px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rcpt-unread-badge {
    font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600;
    color: var(--accent); background: var(--accent-dim);
    padding: 1px 6px; border-radius: 8px; min-width: 16px; text-align: center;
  }
  .rcpt-count {
    font-family: 'JetBrains Mono', monospace; font-size: 10px;
    color: var(--text-3);
  }

  .domain-empty {
    display: flex; align-items: center; justify-content: center;
    height: 80px; color: var(--text-3); font-size: 13px; font-style: italic;
  }

  .sidebar-footer {
    padding: 12px 16px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
  }
  .domain-total { font-size: 11px; color: var(--text-3); }

  /* ── Theme toggle ── */
  .theme-toggle {
    width: 32px; height: 32px; border-radius: var(--radius);
    border: 1px solid var(--border); background: var(--bg-hover);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.2s ease; position: relative; overflow: hidden;
  }
  .theme-toggle:hover { background: var(--bg-active); border-color: var(--border-strong); }
  .theme-toggle:active { transform: scale(0.95); }

  .theme-toggle .icon {
    width: 14px; height: 14px; color: var(--text-2);
    position: absolute;
    transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease;
  }
  .theme-toggle .icon-sun { opacity: 0; transform: rotate(-90deg) scale(0.5); }
  .theme-toggle .icon-moon { opacity: 1; transform: rotate(0deg) scale(1); }
  .dark .theme-toggle .icon-sun { opacity: 1; transform: rotate(0deg) scale(1); }
  .dark .theme-toggle .icon-moon { opacity: 0; transform: rotate(90deg) scale(0.5); }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .toolbar {
    padding: 14px 24px; display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid var(--border); background: var(--bg-surface);
    position: sticky; top: 0; z-index: 10;
    backdrop-filter: blur(8px);
  }

  .search-wrap { flex: 1; max-width: 360px; position: relative; }
  .search-wrap svg {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    width: 14px; height: 14px; color: var(--text-3); pointer-events: none; transition: color 0.2s ease;
  }
  .search-input:focus + svg { color: var(--accent); }
  .search-input {
    width: 100%; padding: 9px 36px 9px 36px; box-sizing: border-box;
    border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg-surface); color: var(--text-1);
    font-size: 13px; font-family: 'JetBrains Mono', monospace; outline: none;
    transition: all 0.2s ease;
    caret-color: var(--accent);
  }
  .search-input::placeholder { color: var(--text-3); font-family: 'DM Sans', 'Noto Sans SC', system-ui, sans-serif; }
  .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim), inset 0 1px 3px rgba(0,0,0,0.1); background: var(--bg); }
  .search-clear {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 22px; height: 22px; border: none; border-radius: 5px;
    background: transparent; color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s ease; padding: 0; z-index: 1; opacity: 0; pointer-events: none;
  }
  .search-clear.visible { opacity: 1; pointer-events: auto; }
  .search-clear:hover { background: var(--bg-active); color: var(--text-1); }
  .search-clear:active { transform: translateY(-50%) scale(0.9); }

  .email-total { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-3); white-space: nowrap; }
  .btn-icon {
    width: 32px; height: 32px; border-radius: var(--radius); border: 1px solid var(--border);
    background: var(--bg-hover); color: var(--text-2); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;
  }
  .btn-icon:hover { background: var(--bg-active); border-color: var(--border-strong); color: var(--text-1); }

  /* ── Split ── */
  .split { display: flex; flex: 1; min-height: 0; }

  .email-list {
    width: 340px; min-width: 340px; overflow-y: auto;
    border-right: 1px solid var(--border); background: var(--bg-surface);
  }

  .email-list-empty {
    display: flex; align-items: center; justify-content: center;
    height: 100%; color: var(--text-3); font-size: 13px; font-style: italic; letter-spacing: 0.02em;
  }

  .email-card {
    padding: 14px 20px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.15s ease; position: relative; padding-right: 60px;
  }
  .email-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
    background: var(--accent); opacity: 0; transition: opacity 0.15s ease;
  }
  .email-card:hover { background: var(--bg-hover); }
  .email-card.active { background: var(--bg-active); }
  .email-card.active::before { opacity: 1; }

  .email-card.unread .email-from { color: var(--text-1); font-weight: 500; }
  .email-card.unread .email-subject { color: var(--text-1); }
  .email-card.unread .email-from::before {
    content: ''; display: inline-block; width: 5px; height: 5px;
    border-radius: 50%; background: var(--accent);
    margin-right: 8px; vertical-align: middle;
  }

  .email-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
  .email-from { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .email-time { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-3); white-space: nowrap; flex-shrink: 0; margin-left: 8px; }
  .email-subject { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }
  .email-recipient { font-size: 11px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .email-actions { display: none; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); gap: 4px; }
  .email-card:hover .email-actions { display: flex; }
  .email-btn {
    width: 24px; height: 24px; border-radius: 4px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; transition: all 0.15s ease;
  }
  .email-btn-read { background: var(--bg-hover); color: var(--text-3); }
  .email-btn-read:hover { background: var(--accent-dim); color: var(--accent); }
  .email-btn-delete { background: var(--bg-hover); color: var(--text-3); }
  .email-btn-delete:hover { background: rgba(200,120,120,0.2); color: #c97b7b; }
  .email-btn-restore { background: var(--bg-hover); color: var(--text-3); }
  .email-btn-restore:hover { background: var(--accent-dim); color: var(--accent); }

  /* ── Preview ── */
  .preview { flex: 1; overflow-y: auto; background: var(--bg); }

  .preview-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 16px; color: var(--text-3);
  }
  .preview-empty svg { width: 40px; height: 40px; opacity: 0.2; }
  .preview-empty span { font-size: 13px; font-style: italic; letter-spacing: 0.02em; }

  .preview-content {
    max-width: 820px; margin: 0 auto; padding: 40px 56px 60px;
    animation: fadeIn 0.3s cubic-bezier(0.2, 0, 0, 1);
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .preview-header {
    margin-bottom: 32px; padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
    position: relative;
  }
  .preview-header::after {
    content: ''; position: absolute; bottom: -1px; left: 0; width: 48px; height: 1px;
    background: var(--accent);
  }

  .preview-subject {
    font-family: 'DM Serif Display', 'Noto Serif SC', Georgia, serif;
    font-size: 22px; font-weight: 400; line-height: 1.35;
    color: var(--text-1); margin-bottom: 16px;
    letter-spacing: 0.01em;
  }

  .preview-meta {
    display: flex; align-items: center; gap: 10px;
    font-size: 12px; color: var(--text-3);
  }
  .preview-meta .from {
    color: var(--accent-text); font-weight: 500;
    max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .preview-meta .arrow { opacity: 0.3; font-size: 10px; }
  .preview-meta .to {
    color: var(--text-2);
    max-width: 240px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .preview-date {
    font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500;
    color: var(--text-3); margin-top: 10px;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 4px;
    background: var(--bg-surface); border: 1px solid var(--border);
  }

  .preview-body { padding-top: 8px; }
  .preview-body pre {
    font-family: 'DM Sans', 'Noto Sans SC', sans-serif;
    font-size: 14.5px; line-height: 1.8; color: var(--text-2);
    white-space: pre-wrap; word-break: break-word;
    letter-spacing: 0.01em;
  }

  /* ── Email iframe ── */
  .email-iframe, iframe.email-iframe { display: block; width: 100% !important; border: 0 !important; border-radius: var(--radius); background: #fff; min-height: 200px; overflow: hidden; outline: none; box-shadow: none; }

  /* ── Breadcrumb ── */
  .breadcrumb-bar {
    display: none; align-items: center; gap: 6px;
    padding: 8px 24px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    font-size: 12px;
    flex-shrink: 0;
  }
  .breadcrumb-bar .bc-domain { color: var(--text-2); }
  .breadcrumb-bar .bc-sep { color: var(--text-3); opacity: 0.5; font-size: 10px; }
  .breadcrumb-bar .bc-rcpt { color: var(--accent-text); font-weight: 500; }
  .breadcrumb-bar .bc-label { color: var(--text-2); font-style: italic; }

  /* ── Loading ── */
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--text-2); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-wrap { display: flex; align-items: center; justify-content: center; height: 160px; }
  .error-msg { text-align: center; padding: 40px; color: var(--red); font-size: 13px; }

  /* ── Toast notifications ── */
  .toast-container {
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    background: var(--bg-elevated); border: 1px solid var(--border-strong);
    border-radius: 10px; padding: 14px 18px; min-width: 280px; max-width: 380px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.15);
    cursor: pointer; position: relative; overflow: hidden;
    animation: toastIn 0.35s cubic-bezier(0.2, 0, 0, 1);
    transition: transform 0.2s ease, opacity 0.2s ease;
  }
  .toast:hover { transform: translateY(-2px); }
  .toast.toast-out { animation: toastOut 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
  .toast-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .toast-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .toast-from { font-size: 12px; font-weight: 500; color: var(--accent-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .toast-time { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--text-3); flex-shrink: 0; margin-left: auto; }
  .toast-subject { font-size: 13px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toast-bar { position: absolute; bottom: 0; left: 0; height: 2px; background: var(--accent); border-radius: 0 0 10px 10px; animation: toastBar 30s linear forwards; }
  @keyframes toastIn { from { opacity: 0; transform: translateX(120%); } to { opacity: 1; transform: translateX(0); } }
  @keyframes toastOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(120%); } }
  @keyframes toastBar { from { width: 100%; } to { width: 0%; } }
</style>
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

<script>
var state = {
  domain: '', rcptUser: '', emails: [], cursor: null, loading: false, hasMore: true,
  selectedId: null, totalLoaded: 0, view: 'home' // 'home' | 'domain' | 'rcpt'
};
var allDomains = []; // cached from /api/domains

// Theme toggle
var currentTheme = localStorage.getItem('theme') || 'dark';
function applyTheme(t) {
  document.documentElement.className = t;
  localStorage.setItem('theme', t);
}
applyTheme(currentTheme);

// Update domain total count
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
});

// Initial state: load recent 5 emails
updateBreadcrumb();
loadHomeEmails();

// Search
function searchMails() {
  var q = document.getElementById('search').value.trim();
  state.cursor = null; state.emails = []; state.hasMore = true; state.selectedId = null; state.totalLoaded = 0;
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
  if (q) {
    // 有搜索词 → 全局搜索
    state.view = 'home';
    updateBreadcrumb();
    loadEmails(true);
  } else if (state.domain) {
    // 无搜索词但有选中域名 → 回到域名视图
    state.view = 'domain';
    state.rcptUser = '';
    updateBreadcrumb();
    loadEmails(true);
  } else if (!state.domain) {
    // 无搜索词且无选中域名 → 回到最近邮件
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

// Sidebar tree interaction
document.querySelector('.domain-list').addEventListener('click', function(e) {
  // Recipient click
  var rcptItem = e.target.closest('.rcpt-item');
  if (rcptItem) {
    e.stopPropagation();
    var domain = rcptItem.dataset.domain;
    var rcpt = rcptItem.dataset.rcpt;
    // Update active states
    document.querySelectorAll('.rcpt-item').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('active'); });
    rcptItem.classList.add('active');
    var parentTree = rcptItem.closest('.domain-tree');
    if (parentTree) parentTree.classList.add('active');
    // Load recipient emails
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

  // Domain header click → toggle expand/collapse, load all domain emails
  var domainHeader = e.target.closest('.domain-tree-header');
  if (domainHeader) {
    e.stopPropagation();
    var tree = domainHeader.closest('.domain-tree');
    var domain = tree.dataset.domain;
    // Toggle expand
    var isOpen = tree.classList.contains('open');
    // Close all trees
    document.querySelectorAll('.domain-tree').forEach(function(el) { el.classList.remove('open'); });
    if (!isOpen) {
      tree.classList.add('open');
    }
    // Load domain emails
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

// Breadcrumb bar
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

// Home: load recent 5 emails globally
function loadHomeEmails() {
  if (state.loading) return;
  state.loading = true;
  document.getElementById('email-list').innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  fetch('/api/emails/recent?limit=5')
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

// Email list click handler (delete/read/card click)
document.getElementById('email-list').addEventListener('click', function(e) {
  // Restore button (trash mode)
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

  // Delete button
  var delBtn = e.target.closest('.email-btn-delete');
  if (delBtn) {
    e.stopPropagation();
    var id = delBtn.dataset.id;
    if (confirm('确定要删除这封邮件吗？')) {
      fetch('/api/emails/' + id, { method: 'DELETE' })
        .then(function() {
          var card = document.querySelector('.email-card[data-id="' + id + '"]');
          if (card) card.remove();
          if (state.selectedId === id) {
            document.getElementById('preview').innerHTML = '<div class="preview-empty"><span>选择一封邮件阅读</span></div>';
          }
        });
    }
    return;
  }

  // Read/unread toggle button
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

  // Card click
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

// Trash / Recycle bin
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
      var body;
      if (hasHtml) {
        var iframeId = 'email-frame-' + id;
        var cleanHtml = email.body_html
          .replace(/<body[^>]*>/gi, '<body>')
          .replace(/border\s*=\s*["']?\d+["']?/gi, '')
          .replace(/frameborder\s*=\s*["']?\w+["']?/gi, '')
          .replace(/rules\s*=\s*["']?\w+["']?/gi, '')
          .replace(/(border[\w-]*|outline)\s*:\s*[^;"]*/gi, '')
          .replace(/bgcolor\s*=\s*["']?[^"'\s>]*/gi, '')
          .replace(/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|rgb(?:a)?\s*\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*[^)]*)?\s*\))\s*[;"]?/gi, '');
        var srcdocContent = '<!DOCTYPE html><html><head><style>'
          + 'html,body{overflow:hidden!important;margin:0!important;padding:0!important;border:0!important;outline:0!important;}'
          + 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:15px;line-height:1.75;color:#2d2d2d;padding:8px 16px;background:#fff;word-break:break-word;-webkit-font-smoothing:antialiased;}'
          + 'a{color:#b07d56;text-decoration:none;border-bottom:1px solid rgba(176,125,86,0.3);transition:border-color 0.15s;}'
          + 'a:hover{border-bottom-color:#b07d56;}'
          + 'img{max-width:100%!important;height:auto;border-radius:6px;margin:8px 0;}'
          + 'blockquote{border-left:3px solid #c8956c;padding:4px 16px;color:#555;margin:16px 0;background:rgba(200,149,108,0.04);border-radius:0 6px 6px 0;}'
          + 'pre{background:#f8f6f3;border:1px solid #e8e4de;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;color:#333;font-family:"JetBrains Mono",monospace;}'
          + 'code{background:#f0ede8;padding:2px 6px;border-radius:4px;font-size:13px;font-family:"JetBrains Mono",monospace;}'
          + 'table{border-collapse:collapse;width:100%;margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e8e4de;}'
          + 'td,th{border:1px solid #e8e4de;padding:10px 14px;color:#333;}'
          + 'th{background:#f8f6f3;font-weight:600;font-size:13px;}'
          + 'h1,h2,h3,h4,h5,h6{color:#111;margin:20px 0 8px;line-height:1.35;}'
          + 'h1{font-size:22px;}h2{font-size:18px;}h3{font-size:16px;}'
          + 'p{margin:10px 0;}'
          + 'ul,ol{padding-left:24px;margin:10px 0;}'
          + 'li{margin:4px 0;}'
          + 'div,span,section,article,main,header,footer{border:0!important;outline:0!important;}'
          + '::selection{background:rgba(200,149,108,0.25);}'
          + '</style></head><body>' + cleanHtml + '</body></html>';
        body = '<iframe id="' + iframeId + '" class="email-iframe" sandbox="" scrolling="no" frameborder="0" style="width:100%;border:0;overflow:hidden;box-shadow:none;display:block;" srcdoc="' + srcdocContent.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '"></iframe>';
        setTimeout(function() {
          var iframe = document.getElementById(iframeId);
          if (!iframe) return;
          var resize = function() {
            try { iframe.style.height = iframe.contentDocument.body.scrollHeight + 'px'; } catch(e) {}
          };
          iframe.onload = function() {
            resize();
            var imgs = iframe.contentDocument.querySelectorAll('img');
            for (var i = 0; i < imgs.length; i++) { imgs[i].onload = resize; }
          };
        }, 0);
      } else if (hasText) {
        if (email.body_text.trim().startsWith('<')) {
          var cleanText = email.body_text
            .replace(/<body[^>]*>/gi, '<body>')
            .replace(/border\s*=\s*["']?\d+["']?/gi, '')
            .replace(/frameborder\s*=\s*["']?\w+["']?/gi, '')
            .replace(/rules\s*=\s*["']?\w+["']?/gi, '')
            .replace(/(border[\w-]*|outline)\s*:\s*[^;"]*/gi, '')
            .replace(/bgcolor\s*=\s*["']?[^"'\s>]*/gi, '')
            .replace(/background(?:-color)?\s*:\s*(?:#fff(?:fff)?|rgb(?:a)?\s*\(\s*255\s*,\s*255\s*,\s*255\s*(?:,\s*[^)]*)?\s*\))\s*[;"]?/gi, '');
          body = '<iframe class="email-iframe" sandbox="" scrolling="no" style="width:100%;border:none;overflow:hidden;" srcdoc="' + esc(cleanText.replace(/"/g, '&quot;')) + '"></iframe>';
        } else {
          body = '<pre class="preview-body" style="background:var(--bg-surface);border:1px solid var(--border);padding:24px;border-radius:10px;">' + esc(email.body_text) + '</pre>';
        }
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
          '<div class="preview-body">' + body + '</div>' +
        '</div>';
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
function jsStringToColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  var h = Math.abs(hash) % 360;
  var s = 35 + (Math.abs(hash >> 8) % 20);
  var l = 40 + (Math.abs(hash >> 16) % 15);
  return 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
}

// ── Toast notification system ──
var lastSeenTs = null;

// Update lastSeenTs whenever we load emails
function updateLastSeenTs() {
  if (state.emails && state.emails.length > 0) {
    var newest = state.emails[0];
    if (newest.created_at && (!lastSeenTs || newest.created_at > lastSeenTs)) {
      lastSeenTs = newest.created_at;
    }
  }
}

// Show a toast for a new email
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
    // Navigate to the email: find it in the list or load it
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

// Poll for new emails every 15s
function startPolling() {
  setInterval(function() {
    if (!lastSeenTs) return;
    fetch('/api/emails/since?ts=' + encodeURIComponent(lastSeenTs))
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.emails && data.emails.length > 0) {
          // Newest first from API — show oldest-first so they stack naturally
          var emails = data.emails.slice().reverse();
          for (var i = 0; i < emails.length; i++) {
            showToast(emails[i]);
          }
          // Update lastSeenTs to the newest
          lastSeenTs = data.emails[0].created_at;
          // Auto-refresh list if user is on home view
          if (state.view === 'home') loadHomeEmails();
        }
      })
      .catch(function() {});
  }, 15000);
}

// Hook into existing email loads to track lastSeenTs
var originalLoadHomeEmails = loadHomeEmails;
loadHomeEmails = function() {
  originalLoadHomeEmails();
  // After loadHomeEmails completes, update lastSeenTs
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

// Override loadEmails to also track lastSeenTs after fetch
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

// Start polling once DOM is ready
setTimeout(function() {
  // Initialize lastSeenTs from current emails if any
  updateLastSeenTs();
  if (!lastSeenTs) {
    // Fallback: use current time minus 1min so we catch near-immediate emails
    var d = new Date(Date.now() - 60000);
    lastSeenTs = d.toISOString();
  }
  startPolling();
}, 1000);
<\/script>
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
