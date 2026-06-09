export const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+SC:wght@400;600&display=swap');

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
    --text-3: #a3a09c;
    --accent: #b07d56;
    --accent-dim: rgba(176,125,86,0.12);
    --accent-text: #8a6340;
    --red: #b05a5a;
    --scrollbar: rgba(0,0,0,0.1);
    --scrollbar-hover: rgba(0,0,0,0.2);
    --radius: 6px;
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
  .preview {
    flex: 1; overflow-y: auto; overflow-x: hidden; background: var(--bg);
    display: flex; flex-direction: column;
    min-height: 0;
  }

  .preview-empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; gap: 16px; color: var(--text-3);
  }
  .preview-empty svg { width: 40px; height: 40px; opacity: 0.2; }
  .preview-empty span { font-size: 13px; font-style: italic; letter-spacing: 0.02em; }

  .preview-content {
    max-width: 820px; width: 100%; margin: 0 auto; padding: 24px 32px 32px;
    animation: fadeIn 0.3s cubic-bezier(0.2, 0, 0, 1);
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-height: 100%;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

  .preview-header {
    margin-bottom: 20px; padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    position: relative;
    flex: 0 0 auto;
  }
  .preview-header::after {
    content: ''; position: absolute; bottom: -1px; left: 0; width: 48px; height: 1px;
    background: var(--accent);
  }

  .preview-subject {
    font-family: 'DM Serif Display', 'Noto Serif SC', Georgia, serif;
    font-size: 20px; font-weight: 400; line-height: 1.35;
    color: var(--text-1); margin-bottom: 12px;
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
    color: var(--text-3); margin-top: 8px;
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 4px;
    background: var(--bg-surface); border: 1px solid var(--border);
  }

  .attachment-list {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin: -6px 0 18px;
    flex: 0 0 auto;
  }
  .attachment-list:empty { display: none; }
  .attachment-title {
    width: 100%;
    font-size: 11px; color: var(--text-3);
  }
  .attachment-item {
    display: inline-flex; align-items: center; gap: 8px;
    max-width: 100%;
    padding: 7px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-surface);
    color: var(--text-2);
    text-decoration: none;
    font-size: 12px;
  }
  .attachment-item:hover {
    border-color: var(--border-strong);
    color: var(--text-1);
  }
  .attachment-icon { flex: 0 0 auto; }
  .attachment-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .attachment-size {
    flex: 0 0 auto;
    color: var(--text-3);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
  }

  .preview-body {
    padding-top: 4px;
    flex: 1 1 auto;
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .preview-body .plain-text {
    font-family: 'DM Sans', 'Noto Sans SC', sans-serif;
    font-size: 14.5px; line-height: 1.8; color: var(--text-2);
    white-space: pre-wrap; word-break: break-word;
    letter-spacing: 0.01em;
    padding: 4px 0 0; border-radius: 0;
    background: transparent; border: 0;
  }

  /* ── HTML email "paper card" ── */
  .email-iframe-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 160px;
    flex: 0 0 auto;
    background: transparent;
    border-radius: 0;
    overflow: visible;
    border: 0;
    box-shadow: none;
    transition: box-shadow 0.3s ease, border-color 0.3s ease;
  }
  .email-iframe-card::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 22px; height: 22px;
    margin: -11px 0 0 -11px;
    border-radius: 50%;
    border: 2px solid rgba(138, 99, 64, 0.18);
    border-top-color: rgba(138, 99, 64, 0.55);
    animation: spin 0.9s linear infinite;
    opacity: 1;
    transition: opacity 0.2s ease;
    pointer-events: none;
    z-index: 0;
  }
  .email-iframe-card.iframe-ready::after {
    opacity: 0;
  }
  .email-iframe-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 44px; height: 44px;
    background: transparent;
    pointer-events: none;
    border-radius: 12px 0 0 0;
    z-index: 1;
  }
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
  .email-iframe.ready {
    opacity: 1;
  }

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
    box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2);
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
`;
