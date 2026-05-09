#!/usr/bin/env tsx

/**
 * 从备份文件恢复生产数据
 * 先清空 D1 中的 mock 数据，再逐条插回生产数据
 *
 * 用法: npx tsx scripts/restore-prod.ts
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const DB_NAME = "mail-db";
const BACKUP_FILE = "raw/prod-backup.json";
const TMP_SQL = "/tmp/restore-prod.sql";

function d1file(sqlFile: string): void {
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --file "${sqlFile}"`, { stdio: "pipe" });
}

function d1single(sql: string): void {
  writeFileSync(TMP_SQL, sql);
  d1file(TMP_SQL);
}

function esc(s: string | null | undefined): string {
  return String(s ?? "").replace(/'/g, "''");
}

async function main() {
  console.log("\n♻️  恢复生产数据...\n");

  let backup: { timestamp: string; emails: any[]; attachments: any[] };
  try {
    backup = JSON.parse(readFileSync(BACKUP_FILE, "utf-8"));
  } catch {
    console.error(`❌ 找不到备份文件 ${BACKUP_FILE}，请先运行 backup-prod.ts`);
    process.exit(1);
  }

  console.log(`  备份时间: ${backup.timestamp}`);
  console.log(`  邮件: ${backup.emails.length} 封`);
  console.log(`  附件: ${backup.attachments.length} 个\n`);

  // 1. Clear D1
  console.log("  🗑  清空 D1 当前数据...");
  d1single("DELETE FROM attachments; DELETE FROM emails;");
  console.log("  ✅ 已清空\n");

  // 2. Re-insert emails one by one (safe for large content)
  console.log("  📤 恢复邮件...");
  let inserted = 0;
  for (const e of backup.emails) {
    const sql = `INSERT INTO emails (id, domain, mail_from, rcpt_to, subject, body_text, body_html, date, r2_key, is_read, is_flagged, is_spam, created_at) VALUES ('${esc(e.id)}','${esc(e.domain)}','${esc(e.mail_from)}','${esc(e.rcpt_to)}','${esc(e.subject)}','${esc(e.body_text)}','${esc(e.body_html)}','${esc(e.date)}','${esc(e.r2_key)}',${e.is_read ?? 0},${e.is_flagged ?? 0},${e.is_spam ?? 0},'${esc(e.created_at)}');`;
    writeFileSync(TMP_SQL, sql);
    d1file(TMP_SQL);
    inserted++;
    if (inserted % 10 === 0 || inserted === backup.emails.length) {
      process.stdout.write(`  ✅ ${inserted}/${backup.emails.length}\r`);
    }
  }
  console.log("");

  // 3. Re-insert attachments
  console.log("  📎 恢复附件...");
  let attInserted = 0;
  for (const a of backup.attachments) {
    const sql = `INSERT INTO attachments (id, email_id, filename, content_type, size, r2_key, created_at) VALUES ('${esc(a.id)}','${esc(a.email_id)}','${esc(a.filename)}','${esc(a.content_type)}',${a.size ?? 0},'${esc(a.r2_key)}','${esc(a.created_at)}');`;
    writeFileSync(TMP_SQL, sql);
    d1file(TMP_SQL);
    attInserted++;
    process.stdout.write(`  ✅ ${attInserted}/${backup.attachments.length}\r`);
  }
  console.log("");

  // 4. Rebuild FTS
  console.log("\n  🔍 重建 FTS5 索引...");
  d1single("INSERT INTO emails_fts(emails_fts) VALUES('rebuild');");

  // 5. Verify
  const result = execSync(
    `npx wrangler d1 execute ${DB_NAME} --remote --command "SELECT COUNT(*) as total FROM emails;" --json`,
    { stdio: "pipe" }
  ).toString();
  const parsed = JSON.parse(result);
  const total = parsed[0]?.results?.[0]?.total ?? 0;

  // Cleanup
  try { unlinkSync(TMP_SQL); } catch {}

  console.log(`\n🎉 恢复完成！D1 中共 ${total} 封邮件\n`);
}

main();
