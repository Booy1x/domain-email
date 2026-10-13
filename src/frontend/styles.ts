export const styles = `
  :root {
    --bg: #f5f3f0;
    --bg-surface: #faf9f7;
    --bg-elevated: #ffffff;
    --bg-hover: rgba(0,0,0,0.03);
    --bg-active: rgba(0,0,0,0.06);
    --border: rgba(0,0,0,0.08);
    --border-strong: rgba(0,0,0,0.15);
    --text-1: #1a1917;
    --text-2: #6b6865;
    --text-3: #8f8c88;
    --accent: #b07d56;
    --accent-dim: rgba(176,125,86,0.12);
    --accent-text: #8a6340;
    --accent-solid: #8a6340;
    --on-accent: #ffffff;
    --danger: #b05a5a;
    --danger-dim: rgba(176,90,90,0.14);
    --paper: #ffffff;
    --paper-border: rgba(0,0,0,0.08);
    --scrollbar: rgba(0,0,0,0.1);
    --scrollbar-hover: rgba(0,0,0,0.2);
    --shadow-pop: 0 10px 30px rgba(40,30,20,0.16), 0 2px 8px rgba(40,30,20,0.08);
    --radius: 8px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', system-ui, sans-serif;
    --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  }

  :root[data-theme="dark"] {
    --bg: #1b1916;
    --bg-surface: #23201c;
    --bg-elevated: #2c2822;
    --bg-hover: rgba(255,255,255,0.05);
    --bg-active: rgba(255,255,255,0.09);
    --border: rgba(255,255,255,0.1);
    --border-strong: rgba(255,255,255,0.22);
    --text-1: #ece8e1;
    --text-2: #b1aca3;
    --text-3: #847e75;
    --accent: #cd9267;
    --accent-dim: rgba(205,146,103,0.17);
    --accent-text: #dca978;
    --accent-solid: #cd9267;
    --on-accent: #1b1916;
    --danger: #d08787;
    --danger-dim: rgba(208,135,135,0.17);
    --scrollbar: rgba(255,255,255,0.14);
    --scrollbar-hover: rgba(255,255,255,0.26);
    --shadow-pop: 0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35);
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; overflow: hidden; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text-1);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: background 0.2s ease, color 0.2s ease;
  }
  button { font-family: inherit; }

  * { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
  *::-webkit-scrollbar { width: 6px; height: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }
  *::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

  /* ── Layout ── */
  .app { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }

  /* ── Sidebar ── */
  .sidebar {
    width: 248px; min-width: 248px;
    display: flex; flex-direction: column;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
  }

  .sidebar-header { padding: 16px 16px 12px; }

  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-icon {
    width: 34px; height: 34px; border-radius: 9px;
    background: var(--accent-solid); color: var(--on-accent);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    box-shadow: 0 1px 2px rgba(40,30,20,0.18), inset 0 1px 0 rgba(255,255,255,0.18);
  }
  .logo-icon svg { width: 18px; height: 18px; }
  .logo-text { display: flex; flex-direction: column; min-width: 0; }
  .logo-text h1 {
    font-size: 15px; font-weight: 650; letter-spacing: -0.01em;
    color: var(--text-1); line-height: 1.25;
    display: flex; align-items: baseline; gap: 4px;
  }
  .logo-text h1 .logo-word-domain { color: var(--text-1); }
  .logo-text h1 .logo-word-inbox { color: var(--accent-text); }
  .logo-text .logo-sub { font-size: 11px; color: var(--text-3); line-height: 1.3; }

  .sidebar-label {
    padding: 10px 18px 6px;
    font-size: 11px; font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text-3);
  }

  .sidebar-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 8px; }
  .domain-list { list-style: none; padding: 2px 8px 4px 22px; }
  .domain-list.collapsed { display: none; }

  .inbox-entry {
    display: flex; align-items: center; gap: 8px;
    height: 36px; padding: 0 10px; margin: 2px 8px; cursor: pointer;
    border-radius: var(--radius); color: var(--text-2);
    transition: background 0.12s ease, color 0.12s ease;
    user-select: none;
  }
  .inbox-entry svg { color: var(--text-3); flex-shrink: 0; transition: color 0.12s ease; }
  .inbox-entry:hover { background: var(--bg-hover); color: var(--text-1); }
  .inbox-entry.active { background: var(--bg-active); color: var(--accent-text); font-weight: 600; }
  .inbox-entry.active svg { color: var(--accent); }
  .inbox-label { flex: 1; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .inbox-arrow {
    flex-shrink: 0; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 8px; color: var(--text-3); border-radius: 4px; transform: rotate(90deg);
    transition: transform 0.15s ease, background 0.12s ease;
  }
  .inbox-arrow:hover { background: var(--bg-active); color: var(--text-1); }
  .inbox-entry[aria-expanded="false"] .inbox-arrow { transform: rotate(0deg); }
  /* align sent/deleted icons with the inbox icon, which sits after the 18px arrow + 8px gap */
  #btn-sent, #btn-trash { padding-left: 36px; }

  .nav-divider { height: 1px; background: var(--border); margin: 8px 16px; }

  .rcpt-empty { padding: 6px 12px 6px 34px; font-size: 12px; color: var(--text-3); }

  .domain-tree { margin-bottom: 1px; }
  .domain-tree-header {
    display: flex; align-items: center; gap: 8px;
    height: 34px; padding: 0 10px; cursor: pointer; border-radius: var(--radius);
    transition: background 0.12s ease; user-select: none;
  }
  .domain-tree-header:hover { background: var(--bg-hover); }
  .domain-tree.active > .domain-tree-header { background: var(--bg-active); }
  .domain-tree.active > .domain-tree-header .domain-name { color: var(--accent-text); font-weight: 600; }

  .tree-arrow {
    font-size: 8px; color: var(--text-3); flex-shrink: 0; width: 10px;
    transition: transform 0.15s ease; display: inline-block;
  }
  .domain-tree.open > .domain-tree-header .tree-arrow { transform: rotate(90deg); }

  .domain-avatar, .rcpt-avatar {
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 600; color: rgba(255,255,255,0.95);
    flex-shrink: 0;
  }
  .domain-avatar { width: 22px; height: 22px; font-size: 10px; }
  .rcpt-avatar { width: 20px; height: 20px; font-size: 9px; border-radius: 50%; }

  .domain-name {
    flex: 1; font-size: 13px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .domain-count {
    font-size: 11px; color: var(--text-3); white-space: nowrap;
  }

  .rcpt-list { list-style: none; padding: 0; margin: 0; display: none; }
  .domain-tree.open > .rcpt-list { display: block; }

  .rcpt-item {
    display: flex; align-items: center; gap: 8px;
    height: 32px; padding: 0 10px 0 30px; cursor: pointer; border-radius: var(--radius);
    transition: background 0.12s ease;
  }
  .rcpt-item:hover { background: var(--bg-hover); }
  .rcpt-item.active { background: var(--bg-active); }
  .rcpt-item.active .rcpt-name { color: var(--accent-text); font-weight: 600; }
  .rcpt-name {
    flex: 1; font-size: 12.5px; color: var(--text-2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .rcpt-unread-badge {
    font-size: 10px; font-weight: 600;
    color: var(--on-accent); background: var(--accent-solid);
    padding: 0 6px; height: 16px; line-height: 16px; border-radius: 8px; min-width: 16px; text-align: center;
  }
  .rcpt-count { font-size: 11px; color: var(--text-3); }
  .rcpt-copy {
    width: 20px; height: 20px; border: none; border-radius: 4px;
    background: transparent; color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; padding: 0; opacity: 0; transition: all 0.12s ease;
  }
  .rcpt-item:hover .rcpt-copy, .rcpt-item:focus-within .rcpt-copy { opacity: 1; }
  .rcpt-copy:hover { background: var(--accent-dim); color: var(--accent); }
  .rcpt-copy.copied { opacity: 1; color: var(--accent); }
  @media (hover: none) { .rcpt-copy { opacity: 1; } }

  .domain-empty {
    display: flex; align-items: center; justify-content: center;
    height: 80px; color: var(--text-3); font-size: 13px;
  }

  .sidebar-footer {
    padding: 10px 14px; border-top: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
  }
  .theme-toggle {
    margin-left: auto;
    width: 28px; height: 28px; border: none; border-radius: 7px;
    background: transparent; color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    padding: 0; flex-shrink: 0; transition: all 0.12s ease;
  }
  .theme-toggle:hover { background: var(--bg-hover); color: var(--text-1); }
  .theme-toggle .icon-sun { display: none; }
  :root[data-theme="dark"] .theme-toggle .icon-sun { display: block; }
  :root[data-theme="dark"] .theme-toggle .icon-moon { display: none; }
  .domain-total { font-size: 11.5px; color: var(--text-3); }
  .app-version {
    font-family: var(--mono);
    font-size: 10px; color: var(--text-3); opacity: 0.8;
    white-space: nowrap; user-select: none;
  }

  /* ── Main ── */
  .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

  .toolbar {
    height: 56px; padding: 0 20px; display: flex; align-items: center; gap: 12px;
    border-bottom: 1px solid var(--border); background: var(--bg-surface); flex-shrink: 0;
  }

  .search-wrap { flex: 1; max-width: 400px; position: relative; }
  .search-wrap svg {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    width: 14px; height: 14px; color: var(--text-3); pointer-events: none; transition: color 0.15s ease;
  }
  .search-wrap:focus-within > svg { color: var(--accent); }
  .search-input {
    width: 100%; height: 36px; padding: 0 34px 0 34px;
    border-radius: 10px; border: 1px solid transparent;
    background: var(--bg); color: var(--text-1);
    font-size: 13.5px; font-family: inherit; outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    caret-color: var(--accent);
  }
  .search-input::placeholder { color: var(--text-3); }
  .search-input:hover { border-color: var(--border); }
  .search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); background: var(--bg-surface); }
  .search-clear {
    position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
    width: 24px; height: 24px; border: none; border-radius: 6px;
    background: transparent; color: var(--text-3); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.12s ease; padding: 0; z-index: 1; opacity: 0; pointer-events: none;
  }
  .search-clear.visible { opacity: 1; pointer-events: auto; }
  .search-clear:hover { background: var(--bg-active); color: var(--text-1); }

  .email-total { font-size: 12px; color: var(--text-3); white-space: nowrap; }
  .btn-icon {
    width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg-surface); color: var(--text-2); cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all 0.12s ease;
  }
  .btn-icon:hover { background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-1); }
  .mobile-only, .mobile-bottom-nav, .drawer-backdrop { display: none; }

  /* ── Split ── */
  .split { display: flex; flex: 1; min-height: 0; }

  .email-list {
    width: 372px; min-width: 372px; overflow-y: auto;
    border-right: 1px solid var(--border); background: var(--bg-surface);
  }

  .email-list-empty {
    display: flex; align-items: center; justify-content: center;
    height: 100%; min-height: 120px; color: var(--text-3); font-size: 13px;
  }

  .email-card {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.12s ease; position: relative;
  }
  .email-card::before {
    content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--accent); opacity: 0; transition: opacity 0.12s ease;
  }
  .email-card:hover { background: var(--bg-hover); }
  .email-card.active { background: var(--bg-active); }
  .email-card.active::before { opacity: 1; }

  .email-avatar {
    position: relative; flex-shrink: 0;
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.96);
    text-transform: uppercase; user-select: none;
  }
  .email-avatar.lg { width: 40px; height: 40px; font-size: 16px; }
  .email-card.unread .email-avatar::after {
    content: ''; position: absolute; top: -1px; right: -1px;
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--accent); border: 2px solid var(--bg-surface);
  }
  .email-card.active.unread .email-avatar::after { border-color: var(--bg-surface); }

  .email-main { flex: 1; min-width: 0; padding-right: 0; }
  .email-card-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 1px; }
  .email-from { font-size: 13.5px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .email-time { font-size: 11.5px; color: var(--text-3); white-space: nowrap; flex-shrink: 0; }
  .email-subject { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 1px; }
  .email-recipient { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }

  .email-card.unread .email-from { font-weight: 650; }
  .email-card.unread .email-subject { color: var(--text-1); font-weight: 600; }
  .email-card.unread .email-time { color: var(--accent-text); font-weight: 500; }

  .email-meta-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 24px; }
  .email-actions { display: flex; gap: 2px; margin-left: auto; visibility: hidden; }
  .email-actions.always { visibility: visible; }
  .email-card:hover .email-actions,
  .email-card:focus-within .email-actions { visibility: visible; }
  @media (hover: none) { .email-actions { visibility: visible; } }
  .email-btn {
    min-width: 24px; height: 24px; padding: 0 6px; border-radius: 6px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; transition: all 0.12s ease;
    background: transparent; color: var(--text-3);
  }
  .email-btn:hover { background: var(--bg-active); }
  .email-btn-read:hover, .email-btn-restore:hover { background: var(--accent-dim); color: var(--accent); }
  .email-btn-restore { color: var(--accent-text); font-weight: 500; }
  .email-btn-delete:hover { background: var(--danger-dim); color: var(--danger); }

  /* ── Preview ── */
  .preview {
    flex: 1; overflow-y: auto; overflow-x: hidden; background: var(--bg);
    display: flex; flex-direction: column;
    min-height: 0;
  }

  .preview-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 14px; color: var(--text-3);
  }
  .preview-empty svg { width: 44px; height: 44px; opacity: 0.35; }
  .preview-empty span { font-size: 13.5px; }

  .preview-content {
    max-width: 860px; width: 100%; margin: 0 auto; padding: 28px 36px 40px;
    animation: fadeIn 0.2s ease;
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-height: 100%;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

  .preview-header { margin-bottom: 18px; flex: 0 0 auto; }

  .preview-subject {
    font-size: 22px; font-weight: 650; line-height: 1.35;
    color: var(--text-1); margin-bottom: 16px;
    letter-spacing: -0.01em; word-break: break-word;
  }

  .preview-meta {
    display: flex; align-items: center; gap: 12px;
    font-size: 13px; color: var(--text-3);
  }
  .preview-people { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .preview-meta .from {
    color: var(--text-1); font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .preview-to {
    display: flex; align-items: center; gap: 4px; min-width: 0;
    color: var(--text-3); font-size: 12.5px;
  }
  .preview-to-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .preview-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .preview-date { margin-top: 12px; font-size: 12px; color: var(--text-3); }

  .meta-copy {
    border: none; border-radius: 5px; background: transparent;
    color: var(--text-3); cursor: pointer; padding: 3px 4px;
    display: inline-flex; align-items: center; transition: all 0.12s ease;
  }
  .meta-copy:hover { background: var(--accent-dim); color: var(--accent); }
  .meta-copy.copied { color: var(--accent); }

  .meta-reply, .meta-delete {
    height: 32px; padding: 0 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg-surface);
    color: var(--text-2); cursor: pointer; font-size: 13px; font-weight: 500;
    display: inline-flex; align-items: center; gap: 6px; transition: all 0.12s ease;
  }
  .meta-reply { color: var(--on-accent); background: var(--accent-solid); border-color: var(--accent-solid); }
  .meta-reply:hover { filter: brightness(1.08); }
  .meta-delete:hover { background: var(--danger-dim); border-color: transparent; color: var(--danger); }

  .btn {
    height: 34px; padding: 0 14px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--bg-surface);
    color: var(--text-2); cursor: pointer; font-size: 13px; font-weight: 500;
    transition: all 0.12s ease;
  }
  .btn:hover { background: var(--bg-hover); border-color: var(--border-strong); color: var(--text-1); }
  .btn.btn-primary { background: var(--accent-solid); border-color: var(--accent-solid); color: var(--on-accent); }
  .btn.btn-primary:hover { filter: brightness(1.08); }
  .btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }

  /* ── Reply composer ── */
  .reply-composer {
    margin: 0 0 18px; padding: 16px;
    border: 1px solid var(--border-strong); border-radius: 12px;
    background: var(--bg-surface);
    display: flex; flex-direction: column; gap: 10px;
    box-shadow: 0 4px 16px rgba(40,30,20,0.06);
    animation: fadeIn 0.18s ease;
  }
  .reply-subject, .reply-text {
    width: 100%; padding: 9px 12px;
    border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg-surface); color: var(--text-1);
    font-family: inherit; outline: none; transition: all 0.12s ease;
  }
  .reply-subject { font-size: 13.5px; }
  .reply-text { min-height: 150px; font-size: 14px; line-height: 1.7; resize: vertical; }
  .reply-subject:focus, .reply-text:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-dim); }
  .reply-actions { display: flex; align-items: center; gap: 10px; }
  .reply-hint {
    flex: 1; font-size: 12px; color: var(--text-3);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .reply-send:disabled { opacity: 0.65; cursor: wait; }

  .attachment-list {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin: 0 0 16px;
    flex: 0 0 auto;
  }
  .attachment-list:empty { display: none; }
  .attachment-title { width: 100%; font-size: 12px; color: var(--text-3); }
  .attachment-item {
    display: inline-flex; align-items: center; gap: 8px;
    max-width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-surface);
    color: var(--text-2);
    text-decoration: none;
    font-size: 12.5px;
    transition: all 0.12s ease;
  }
  .attachment-item:hover { border-color: var(--accent); color: var(--text-1); }
  .attachment-unavailable,
  .attachment-unavailable:hover {
    cursor: not-allowed;
    border-color: var(--border);
    color: var(--text-3);
    opacity: 0.72;
  }
  .attachment-status { flex: 0 0 auto; color: var(--danger); font-size: 11px; }
  .attachment-icon { flex: 0 0 auto; }
  .attachment-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .attachment-size { flex: 0 0 auto; color: var(--text-3); font-size: 11px; }

  .preview-body {
    padding-top: 2px;
    flex: 1 1 auto;
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .preview-body .plain-text {
    font-size: 14.5px; line-height: 1.8; color: var(--text-1);
    white-space: pre-wrap; word-break: break-word;
    padding: 20px 24px; border-radius: 12px;
    background: var(--bg-surface); border: 1px solid var(--border);
  }

  /* ── HTML email "paper card" ── */
  .email-iframe-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 160px;
    flex: 0 0 auto;
    background: var(--paper);
    border: 1px solid var(--paper-border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(40,30,20,0.05), 0 8px 24px rgba(40,30,20,0.06);
  }
  .email-iframe-card::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 22px; height: 22px;
    margin: -11px 0 0 -11px;
    border-radius: 50%;
    border: 2px solid rgba(138,99,64,0.18);
    border-top-color: rgba(138,99,64,0.55);
    animation: spin 0.9s linear infinite;
    opacity: 1;
    transition: opacity 0.2s ease;
    pointer-events: none;
    z-index: 0;
  }
  .email-iframe-card.iframe-ready::after { opacity: 0; }
  .email-iframe {
    display: block;
    width: 100%;
    border: 0;
    background: transparent;
    overflow: auto;
    opacity: 0;
    transition: opacity 0.18s ease;
    position: relative;
    z-index: 1;
    min-height: 160px;
    height: 160px;
  }
  .email-iframe.ready { opacity: 1; }

  /* ── Breadcrumb ── */
  .breadcrumb-bar {
    display: none; align-items: center; gap: 6px;
    padding: 9px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-surface);
    font-size: 12.5px;
    flex-shrink: 0;
  }
  .breadcrumb-bar .bc-domain { color: var(--text-2); }
  .breadcrumb-bar .bc-sep { color: var(--text-3); opacity: 0.6; font-size: 10px; }
  .breadcrumb-bar .bc-rcpt { color: var(--accent-text); font-weight: 600; }
  .breadcrumb-bar .bc-label { color: var(--text-1); font-weight: 600; }

  /* ── Remote content button ── */
  .remote-content-button {
    align-self: flex-start;
    margin: 0 0 12px;
    padding: 8px 12px;
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    background: var(--bg-surface);
    color: var(--accent-text);
    font: 500 12.5px/1.4 var(--font);
    cursor: pointer;
  }
  .remote-content-button:hover { background: var(--accent-dim); }
  .email-iframe-card .remote-content-button {
    align-self: stretch; margin: 0; border: 0; border-bottom: 1px solid var(--border);
    border-radius: 0; text-align: left; padding: 10px 16px;
  }
  .remote-content-button:disabled { cursor: wait; opacity: 0.65; }

  /* ── Loading ── */
  .spinner { width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-wrap { display: flex; align-items: center; justify-content: center; height: 160px; }
  .error-msg { text-align: center; padding: 40px; color: var(--danger); font-size: 13px; }

  /* ── Toast notifications ── */
  .toast-container {
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    background: var(--bg-elevated); border: 1px solid var(--border-strong);
    border-radius: 12px; padding: 12px 16px; min-width: 280px; max-width: 380px;
    box-shadow: var(--shadow-pop);
    cursor: pointer; position: relative; overflow: hidden;
    animation: toastIn 0.25s cubic-bezier(0.2, 0, 0, 1);
    transition: transform 0.15s ease, opacity 0.2s ease;
  }
  .toast:hover { transform: translateY(-2px); }
  .toast.toast-out { animation: toastOut 0.2s cubic-bezier(0.4, 0, 1, 1) forwards; }
  .toast-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .toast-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
  .toast-from { font-size: 12.5px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
  .toast-time { font-size: 11px; color: var(--text-3); flex-shrink: 0; margin-left: auto; }
  .toast-subject { font-size: 13px; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .toast-bar { position: absolute; bottom: 0; left: 0; height: 2px; background: var(--accent); animation: toastBar 30s linear forwards; }
  @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(8px); } }
  @keyframes toastBar { from { width: 100%; } to { width: 0%; } }

  .toast.toast-message { cursor: default; min-width: 0; display: flex; align-items: center; gap: 14px; }
  .toast.toast-message .toast-subject { white-space: normal; word-break: break-word; flex: 1; color: var(--text-1); }
  .toast-undo {
    flex-shrink: 0; border: none; background: transparent; cursor: pointer;
    color: var(--accent-text); font-size: 13px; font-weight: 600; padding: 4px 8px; border-radius: 6px;
  }
  .toast-undo:hover { background: var(--accent-dim); }

  /* ── Keyboard focus ── */
  .inbox-entry:focus-visible,
  .inbox-arrow:focus-visible,
  .domain-tree-header:focus-visible,
  .rcpt-item:focus-visible,
  .email-card:focus-visible,
  .btn-icon:focus-visible,
  .theme-toggle:focus-visible,
  .attachment-item:focus-visible,
  .remote-content-button:focus-visible,
  .rcpt-copy:focus-visible,
  .meta-copy:focus-visible,
  .meta-reply:focus-visible,
  .meta-delete:focus-visible,
  .toast-undo:focus-visible,
  .email-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  @media (max-width: 900px) {
    .app { flex-direction: column; }
    .sidebar {
      width: 100%; min-width: 0; max-height: 220px;
      border-right: 0; border-bottom: 1px solid var(--border);
    }
    .sidebar-header { padding: 12px 16px 8px; }
    .sidebar-label { padding: 8px 16px 4px; }
    .domain-list { display: flex; gap: 6px; overflow-x: auto; overflow-y: hidden; padding: 6px 12px 10px; }
    .domain-tree { min-width: 220px; flex: 0 0 auto; }
    .main { min-height: 0; }
    .split { flex-direction: column; }
    .email-list {
      width: 100%; min-width: 0; height: 34vh;
      border-right: 0; border-bottom: 1px solid var(--border);
    }
    .preview { flex: 1 1 auto; }
    .preview-content { max-width: none; padding: 20px 24px 28px; }
  }

  @media (max-width: 640px) {
    html, body { overscroll-behavior: none; }
    .app { padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; z-index: 1001;
      width: min(86vw, 320px); min-width: 0; max-height: none;
      border-right: 1px solid var(--border); border-bottom: 0;
      transform: translateX(-105%); transition: transform 0.22s ease;
      box-shadow: 14px 0 36px rgba(40,30,20,0.18);
    }
    .app.drawer-open .sidebar { transform: translateX(0); }
    .app.drawer-open + .drawer-backdrop { display: block; position: fixed; inset: 0; z-index: 1000; background: rgba(40,30,20,0.45); }
    .sidebar-header { padding-top: calc(16px + env(safe-area-inset-top)); }
    .domain-list { display: block; overflow-y: auto; overflow-x: hidden; padding: 2px 8px 4px 22px; }
    .domain-tree { min-width: 0; }
    .inbox-entry { height: 44px; }
    .domain-tree-header { height: 44px; }
    .rcpt-item { height: 40px; }
    .main { width: 100%; min-height: 0; }
    .toolbar { height: auto; padding: calc(10px + env(safe-area-inset-top)) 12px 10px; gap: 8px; flex-wrap: wrap; }
    .mobile-only { display: flex; flex: 0 0 auto; }
    .search-wrap { max-width: none; min-width: 0; flex: 1; order: 0; }
    .email-total { margin-left: 0; }
    .split { flex-direction: row; }
    .email-list { width: 100%; min-width: 100%; height: auto; border-right: 0; border-bottom: 0; padding-bottom: 8px; }
    .preview { display: none; width: 100%; min-width: 100%; }
    body.email-open .email-list { display: none; }
    body.email-open .preview { display: flex; }
    #btn-mobile-back { display: none; }
    body.email-open #btn-sidebar { display: none; }
    body.email-open #btn-mobile-back { display: flex; }
    body.email-open .search-wrap, body.email-open .email-total { display: none; }
    .email-card { min-height: 76px; padding: 14px 14px; }
    .email-btn { min-width: 32px; height: 32px; font-size: 14px; }
    .email-meta-row { min-height: 32px; }
    .preview-content { padding: 16px 14px calc(28px + env(safe-area-inset-bottom)); }
    .preview-subject { font-size: 19px; margin-bottom: 14px; }
    .preview-meta { flex-wrap: wrap; align-items: flex-start; }
    .preview-people { flex-basis: calc(100% - 52px); }
    .preview-actions { width: 100%; order: 3; }
    .preview-actions .meta-reply, .preview-actions .meta-delete { flex: 1; justify-content: center; height: 40px; }
    .preview-body .plain-text { padding: 16px; }
    .attachment-item { width: 100%; }
    .toast-container { left: 12px; right: 12px; bottom: calc(72px + env(safe-area-inset-bottom)); }
    .toast { min-width: 0; max-width: none; width: 100%; }
    .mobile-bottom-nav {
      position: fixed; display: flex; z-index: 900; left: 0; right: 0; bottom: 0;
      height: calc(60px + env(safe-area-inset-bottom)); padding: 6px 12px env(safe-area-inset-bottom);
      background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
      border-top: 1px solid var(--border); backdrop-filter: blur(16px);
    }
    .mobile-nav-item { flex: 1; border: 0; background: transparent; color: var(--text-3); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; font: 500 11px/1.2 var(--font); cursor: pointer; border-radius: 10px; min-height: 44px; }
    .mobile-nav-item.active { color: var(--accent-text); background: var(--accent-dim); }
    .mobile-nav-item:active { transform: scale(0.96); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
