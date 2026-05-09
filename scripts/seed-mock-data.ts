#!/usr/bin/env tsx

/**
 * 大规模 mock 测试数据生成
 * 覆盖 5 个域名、20+ 收件人、60+ 封邮件
 *
 * 用法:
 *   npx tsx scripts/seed-mock-data.ts              # 追加插入
 *   npx tsx scripts/seed-mock-data.ts --clear       # 清空后重新插入
 */

import { execSync } from "node:child_process";

const DB_NAME = "mail-db";
const HOUR = 3600000;
const DAY = 86400000;
const NOW = Date.now();

let _uidCounter = 0;
function uid(): string {
  return "mock-" + (++_uidCounter).toString(36).padStart(6, "0") + "-" + crypto.randomUUID().slice(0, 8);
}
function ts(offsetMs: number): string {
  return new Date(NOW - offsetMs).toISOString();
}
function esc(s: string): string {
  return s.replace(/'/g, "''");
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── 域名 & 收件人 ────────────────────────────────────────────────────

const DOMAINS: Record<string, string[]> = {
  "example.com":    ["admin", "dev", "billing", "support", "info"],
  "myblog.net":     ["hello", "admin", "contact", "editor"],
  "startup.io":     ["founder", "finance", "hr", "ops", "ceo"],
  "shop.cn":        ["order", "service", "marketing", "boss"],
  "dev-team.org":   ["team", "pm", "jenkins", "git", "devops"],
};

// ── 邮件内容池 ───────────────────────────────────────────────────────

interface MailConfig {
  from: string;
  subject: string;
  text: string;
  html: string;
  flagged?: number;
}

const ALERT_MAILS: MailConfig[] = [
  {
    from: "alert@monitoring.io",
    subject: "🚨 服务器 web-01 CPU 使用率超过 95%",
    text: "服务器 web-01 CPU 95.2%，内存 82%，请及时处理。",
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><div style="background:#dc3545;color:#fff;padding:16px;border-radius:8px 8px 0 0"><h2 style="margin:0">⚠️ 服务器告警</h2></div><div style="border:1px solid #dee2e6;padding:24px;border-radius:0 0 8px 8px"><p><b>web-01</b> CPU <span style="color:#dc3545;font-size:24px">95.2%</span></p><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px;border:1px solid #dee2e6">主机</td><td style="padding:8px;border:1px solid #dee2e6">web-01</td></tr><tr><td style="padding:8px;border:1px solid #dee2e6">CPU</td><td style="padding:8px;border:1px solid #dee2e6;color:#dc3545"><b>95.2%</b></td></tr><tr><td style="padding:8px;border:1px solid #dee2e6">内存</td><td style="padding:8px;border:1px solid #dee2e6">82.1%</td></tr></table></div></div>`,
    flagged: 1,
  },
  {
    from: "alert@datadog.com",
    subject: "[Datadog] API P99 响应时间超过阈值 (2.3s > 1.5s)",
    text: "POST /api/orders 3.1s, GET /api/products 1.8s，持续 10 分钟。",
    html: `<div style="font-family:monospace;max-width:550px;margin:0 auto;background:#1e1e2e;color:#cdd6f4;border-radius:8px;overflow:hidden"><div style="background:#f38ba8;color:#1e1e2e;padding:12px 16px;font-weight:bold">🔴 ALERT: API Response Time</div><div style="padding:16px"><table style="width:100%;font-size:14px"><tr><td style="color:#a6adc8">P99</td><td style="text-align:right;color:#f38ba8"><b>2.3s</b></td></tr><tr><td style="color:#a6adc8">阈值</td><td style="text-align:right">1.5s</td></tr></table><div style="margin-top:12px;background:#313244;padding:8px;border-radius:4px">POST /api/orders <span style="color:#f38ba8;float:right">3.1s</span></div><div style="background:#313244;padding:8px;border-radius:4px">GET /api/products <span style="color:#f38ba8;float:right">1.8s</span></div></div></div>`,
    flagged: 1,
  },
  {
    from: "jenkins@ci.dev-team.org",
    subject: "[Jenkins] Build #1847 FAILED — main branch",
    text: "Build #1847 失败，3 个单元测试未通过。",
    html: `<div style="font-family:monospace;max-width:550px;margin:0 auto;background:#1e1e2e;color:#cdd6f4;border-radius:8px;overflow:hidden"><div style="background:#f38ba8;color:#1e1e2e;padding:12px 16px;font-weight:bold">🔴 BUILD FAILED</div><div style="padding:16px"><p><b>Branch:</b> main</p><p><b>Build:</b> #1847</p><p><b>失败：</b><span style="color:#f38ba8">3 个单元测试未通过</span></p></div></div>`,
    flagged: 1,
  },
  {
    from: "security@myblog.net",
    subject: "🔒 SSL 证书将在 7 天后过期",
    text: "域名 myblog.net 的 SSL 证书将在 7 天后过期，请尽快续期。",
    html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto"><div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:16px"><h3 style="color:#856404;margin:0">🔒 SSL 证书即将过期</h3></div><div style="padding:16px 0"><p><b>myblog.net</b> 证书将在 <b>7 天</b>后过期。</p></div></div>`,
    flagged: 1,
  },
];

const DEV_MAILS: MailConfig[] = [
  {
    from: "noreply@github.com",
    subject: "[GitHub] PR #42: feat: add JWT auth middleware",
    text: "PR #42 by @contributor: feat: add JWT auth middleware. +320 -45 lines.",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:0 auto;padding:16px"><div style="border-bottom:2px solid #24292f;padding-bottom:12px"><span style="font-size:24px">🐙</span><b>GitHub</b></div><h3 style="color:#0969da">New Pull Request</h3><div style="background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:16px"><p><b>PR #42:</b> feat: add JWT auth middleware</p><p><b>Author:</b> @contributor</p></div><a href="#" style="display:inline-block;background:#2da44e;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;margin-top:12px">Review →</a></div>`,
  },
  {
    from: "noreply@gitlab.com",
    subject: "[GitLab] MR !89: fix: resolve memory leak in worker pool",
    text: "MR !89 by @dev-lead: fix: resolve memory leak. +45 -12.",
    html: `<div style="font-family:sans-serif;padding:16px"><span style="font-size:24px">🦊</span><b>GitLab</b><h3 style="color:#fc6d26">Merge Request</h3><div style="background:#f5f5f5;border-radius:6px;padding:12px"><p><b>!89:</b> fix: resolve memory leak in worker pool</p><p><b>Author:</b> @dev-lead</p></div></div>`,
  },
  {
    from: "newsletter@techweekly.io",
    subject: "Tech Weekly #156: AI 时代的开发者工具盘点",
    text: "本周精选：Claude Code, Bun 1.0, Drizzle ORM, HTMX...",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fafafa"><div style="background:#1a1a2e;color:#fff;padding:32px;text-align:center"><h1 style="margin:0">Tech Weekly</h1><p style="opacity:.7">Issue #156</p></div><div style="padding:32px"><h2>AI 时代的开发者工具盘点</h2><div style="margin:16px 0;padding:16px;background:#fff;border-left:4px solid #e94560"><b>1. Claude Code</b><br/>AI 编程助手的新标杆。</div><div style="margin:16px 0;padding:16px;background:#fff;border-left:4px solid #0f3460"><b>2. Bun 1.0</b><br/>极速 JS 运行时。</div><div style="margin:16px 0;padding:16px;background:#fff;border-left:4px solid #16213e"><b>3. Drizzle ORM</b><br/>类型安全的数据库工具。</div></div></div>`,
  },
  {
    from: "pm@dev-team.org",
    subject: "Sprint 24 计划会议 — 明天 10:00",
    text: "Sprint 24 计划会议将于明天 10:00 线上召开。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>📋 Sprint 计划</h3><p><b>Sprint 24</b></p><p>时间：明天 10:00</p></div>`,
  },
];

const BIZ_MAILS: MailConfig[] = [
  {
    from: "partner@vc.com",
    subject: "Re: Series A 融资洽谈",
    text: "很高兴收到 BP，我们对项目很感兴趣，建议周三 14:00 线上会议。",
    html: `<div style="font-family:sans-serif;padding:16px"><p>很高兴收到你们的 BP。</p><p>建议时间：<b>周三 14:00</b> 或 <b>周五 10:00</b></p><p style="color:#999">— VC Partners</p></div>`,
    flagged: 1,
  },
  {
    from: "noreply@stripe.com",
    subject: "Stripe 收款 +$12,500.00 (Acme Corp)",
    text: "新收款：+$12,500.00，客户：Acme Corp，Enterprise Plan。",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto"><div style="background:#635bff;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h2 style="margin:0">Stripe</h2></div><div style="border:1px solid #e0e0e6;padding:24px;border-radius:0 0 8px 8px"><p style="font-size:14px;color:#666">新收款</p><p style="font-size:32px;font-weight:bold;color:#00d924;margin:8px 0">+$12,500.00</p><table style="width:100%;font-size:14px"><tr><td style="color:#666">客户</td><td style="text-align:right">Acme Corp</td></tr><tr><td style="color:#666">描述</td><td style="text-align:right">Enterprise Plan</td></tr></table></div></div>`,
  },
  {
    from: "candidate@talent.com",
    subject: "应聘：高级前端工程师 — 陈五",
    text: "5 年前端经验，React/TS/Next.js/Node.js/PostgreSQL/Docker。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>👤 应聘申请</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><span style="background:#e3f2fd;padding:4px 12px;border-radius:16px;font-size:13px">React</span><span style="background:#e3f2fd;padding:4px 12px;border-radius:16px;font-size:13px">TypeScript</span><span style="background:#e3f2fd;padding:4px 12px;border-radius:16px;font-size:13px">Next.js</span><span style="background:#e3f2fd;padding:4px 12px;border-radius:16px;font-size:13px">Node.js</span><span style="background:#e3f2fd;padding:4px 12px;border-radius:16px;font-size:13px">Docker</span></div><p>— 陈五</p></div>`,
  },
  {
    from: "board@startup.io",
    subject: "董事会会议通知：2026年5月15日 10:00",
    text: "董事会将于 5 月 15 日 10:00 线上召开，议题：Q2 战略规划。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>📅 董事会会议通知</h3><p><b>时间：</b>2026年5月15日 10:00</p><p><b>议题：</b>Q2 战略规划</p></div>`,
    flagged: 1,
  },
];

const SHOP_MAILS: MailConfig[] = [
  {
    from: "customer@buyer.com",
    subject: "订单 #20260508001 已发货",
    text: "您的订单已发货，顺丰 SF1234567890，预计 2 天到达。",
    html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:16px"><h3 style="color:#e63946">📦 订单已发货</h3><p>订单号：<b>#20260508001</b></p><p>快递：顺丰 SF1234567890</p></div>`,
  },
  {
    from: "review@buyer.com",
    subject: "⭐⭐⭐⭐⭐ 商品评价：非常好用！",
    text: "5 星好评：质量非常好，物流也很快，推荐购买！",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>⭐⭐⭐⭐⭐ 新评价</h3><p style="font-style:italic">"质量非常好，物流也很快，推荐购买！"</p></div>`,
  },
  {
    from: "ad@platform.com",
    subject: "🎉 618 大促广告投放方案",
    text: "618 大促即将开始，首页 Banner + 搜索竞价 + 短视频推广。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3 style="color:#e63946">🎉 618 大促方案</h3><ul><li>首页 Banner 展示</li><li>搜索关键词竞价</li><li>短视频推广</li></ul></div>`,
  },
  {
    from: "supplier@factory.com",
    subject: "Re: 供应商报价单 — 5月批次",
    text: "附件是 5 月批次的最新报价单，请查收。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>📄 报价单</h3><p>附件是 5 月批次的最新报价。</p></div>`,
  },
  {
    from: "return@buyer2.com",
    subject: "退货申请 #20260507015",
    text: "申请退货，原因：商品与描述不符。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>↩️ 退货申请</h3><p>订单：<b>#20260507015</b></p><p>原因：商品与描述不符</p></div>`,
  },
];

const BLOG_MAILS: MailConfig[] = [
  {
    from: "reader01@gmail.com",
    subject: "你的文章太棒了！",
    text: "读了你的 Rust 入门指南，终于搞懂了所有权，感谢分享！",
    html: `<div style="font-family:sans-serif;padding:16px"><p>读了你的 <b>Rust 入门指南</b>，终于搞懂了所有权的概念！🎉</p></div>`,
  },
  {
    from: "writer@freelance.com",
    subject: "投稿申请：WebAssembly 实践经验",
    text: "您好，想投稿一篇 Wasm 文章，大纲：基础概念、C++ in Browser、性能对比、实际案例。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>📝 投稿申请</h3><ol><li>Wasm 基础概念</li><li>浏览器中运行 C++</li><li>性能对比</li><li>实际案例</li></ol></div>`,
  },
  {
    from: "noreply@twitter.com",
    subject: "你的推文收到了 50 个赞",
    text: "你关于 Rust 生命周期的推文收到了 50 个赞和 12 次转发。",
    html: `<div style="font-family:sans-serif;padding:16px;text-align:center"><h2>🐦 Twitter</h2><p style="font-size:32px;color:#1da1f2"><b>50</b> 个赞</p></div>`,
  },
  {
    from: "reader02@outlook.com",
    subject: "请教：关于 Docker 网络配置的问题",
    text: "看了你的 Docker 教程，有个问题想请教：bridge 和 host 模式有什么区别？",
    html: `<div style="font-family:sans-serif;padding:16px"><p>看了你的 Docker 教程，有个问题想请教：</p><p><b>bridge 和 host 模式有什么区别？</b></p></div>`,
  },
];

const BILLING_MAILS: MailConfig[] = [
  {
    from: "billing@cloudflare.com",
    subject: "Cloudflare 账单 — 2026年5月 $20.00",
    text: "您的 Cloudflare Pro Plan 账单已生成：$20.00",
    html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px"><h2 style="color:#f48120">☁️ Cloudflare</h2><h3>月度账单</h3><table style="width:100%;border-collapse:collapse"><tr><td style="padding:8px 0;color:#666">计划</td><td style="text-align:right"><b>Pro Plan</b></td></tr><tr><td style="padding:8px 0;color:#666">金额</td><td style="text-align:right"><b style="font-size:20px">$20.00</b></td></tr></table></div>`,
  },
  {
    from: "invoice@aws.amazon.com",
    subject: "AWS 账单 — 2026年5月 $156.78",
    text: "您的 AWS 5月账单：$156.78，EC2 $89.20, S3 $12.50, RDS $55.08。",
    html: `<div style="font-family:sans-serif;padding:16px"><h3>☁️ AWS 账单</h3><p style="font-size:24px;font-weight:bold">$156.78</p><table style="width:100%"><tr><td>EC2</td><td style="text-align:right">$89.20</td></tr><tr><td>S3</td><td style="text-align:right">$12.50</td></tr><tr><td>RDS</td><td style="text-align:right">$55.08</td></tr></table></div>`,
  },
];

// ── 生成邮件列表 ─────────────────────────────────────────────────────

interface MockEmail {
  id: string;
  domain: string;
  mail_from: string;
  rcpt_to: string;
  subject: string;
  body_text: string;
  body_html: string;
  date: string;
  is_read: number;
  is_flagged: number;
}

function generateEmails(): MockEmail[] {
  const emails: MockEmail[] = [];
  const domainMailPools: Record<string, MailConfig[]> = {
    "example.com": [...ALERT_MAILS.slice(0, 1), ...DEV_MAILS.slice(2, 3), ...BILLING_MAILS.slice(0, 1), ...BIZ_MAILS.slice(2, 3)],
    "myblog.net": [...BLOG_MAILS, ...ALERT_MAILS.slice(3, 4)],
    "startup.io": [...BIZ_MAILS, ...ALERT_MAILS.slice(1, 2)],
    "shop.cn": [...SHOP_MAILS],
    "dev-team.org": [...DEV_MAILS.slice(0, 2), ...ALERT_MAILS.slice(2, 3), ...DEV_MAILS.slice(3, 4)],
  };

  // 每个域名每个收件人生成多封邮件，时间跨度 30 天
  for (const [domain, recipients] of Object.entries(DOMAINS)) {
    const pool = domainMailPools[domain] || DEV_MAILS;
    for (let r = 0; r < recipients.length; r++) {
      const recipient = recipients[r];
      // 每个收件人 3-6 封邮件
      const count = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const template = pick(pool);
        const hoursAgo = Math.random() * DAY * 30 / HOUR;
        const isRead = Math.random() > 0.35 ? 1 : 0;
        emails.push({
          id: uid(),
          domain,
          mail_from: template.from,
          rcpt_to: `${recipient}@${domain}`,
          subject: template.subject,
          body_text: template.text,
          body_html: template.html,
          date: ts(hoursAgo * HOUR),
          is_read: isRead,
          is_flagged: template.flagged ?? (Math.random() > 0.85 ? 1 : 0),
        });
      }
    }
  }

  // 按时间倒序
  emails.sort((a, b) => b.date.localeCompare(a.date));
  return emails;
}

// ── 插入 D1 ──────────────────────────────────────────────────────────

function insertBatch(emails: MockEmail[]): void {
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const stmts = batch.map(
      (e) =>
        `INSERT OR IGNORE INTO emails (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key, is_read, is_flagged, is_spam) VALUES ('${esc(e.id)}','${esc(e.domain)}','${esc(e.mail_from)}','${esc(e.rcpt_to)}','${esc(e.subject)}','${esc(e.body_text)}','${esc(e.body_html)}','${esc(e.date)}','',${e.is_read},${e.is_flagged},0)`
    );
    const sql = stmts.join("; ") + ";";
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "${sql.replace(/"/g, '\\"')}"`, {
      stdio: "pipe",
    });
  }
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const shouldClear = process.argv.includes("--clear");

  console.log("\n🌱 大规模 Mock 数据生成\n");

  if (shouldClear) {
    console.log("  🗑  清空现有数据...");
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "DELETE FROM emails; DELETE FROM attachments;"`, { stdio: "pipe" });
    execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "INSERT INTO emails_fts(emails_fts) VALUES('rebuild');"`, { stdio: "pipe" });
    console.log("  ✅ 已清空\n");
  }

  // Generate
  console.log("  📝 生成 mock 邮件...");
  const emails = generateEmails();
  console.log(`  ✅ 生成 ${emails.length} 封邮件\n`);

  // Insert
  console.log("  📤 插入 D1...");
  insertBatch(emails);

  // Verify
  const result = execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --command "SELECT domain, COUNT(*) as cnt FROM emails GROUP BY domain ORDER BY domain;" --json`,
    { stdio: "pipe" }
  ).toString();
  const parsed = JSON.parse(result);
  const rows = parsed[0]?.results ?? [];

  console.log("\n📊 数据分布:");
  console.log("  " + "─".repeat(30));
  let total = 0;
  for (const row of rows) {
    if (row.domain.startsWith("mock") || row.cnt > 5) {
      // skip aggregate rows that aren't domain-level
    }
    console.log(`  ${row.domain.padEnd(20)} ${String(row.cnt).padStart(4)} 封`);
    total += row.cnt;
  }
  console.log("  " + "─".repeat(30));
  console.log(`  注意: 包含原有数据，mock 新增约 ${emails.length} 封\n`);
  console.log("🎉 完成！\n");
}

main();
