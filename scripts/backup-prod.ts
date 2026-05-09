#!/usr/bin/env tsx

/**
 * 备份生产数据到本地 JSON 文件
 * 备份后自动清空 D1 中的生产数据（软删除改为硬删除）
 *
 * 用法: npx tsx scripts/backup-prod.ts
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const DB_NAME = "mail-db";
const BACKUP_FILE = "raw/prod-backup.json";

function d1(sql: string): any[] {
  const out = execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "${sql.replace(/"/g, '\\"')}" --json`, {
    stdio: "pipe",
    maxBuffer: 10 * 1024 * 1024,
  }).toString();
  const parsed = JSON.parse(out);
  return parsed[0]?.results ?? [];
}

async function main() {
  console.log("\n📦 备份生产数据...\n");

  // 1. Export all emails
  console.log("  导出 emails...");
  const emails = d1("SELECT * FROM emails");
  console.log(`  ✅ ${emails.length} 封邮件`);

  // 2. Export all attachments
  console.log("  导出 attachments...");
  const attachments = d1("SELECT * FROM attachments");
  console.log(`  ✅ ${attachments.length} 个附件记录`);

  // 3. Save to file
  const backup = {
    timestamp: new Date().toISOString(),
    emails,
    attachments,
  };
  writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
  console.log(`\n  💾 已保存到 ${BACKUP_FILE}`);

  // 4. Hard-delete production data from D1
  console.log("\n  🗑  清空 D1 生产数据...");
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "DELETE FROM attachments; DELETE FROM emails;"`, {
    stdio: "pipe",
  });

  // 5. Rebuild FTS index (now empty)
  execSync(`npx wrangler d1 execute ${DB_NAME} --remote --command "INSERT INTO emails_fts(emails_fts) VALUES('rebuild');"`, {
    stdio: "pipe",
  });

  console.log("  ✅ D1 已清空\n");
  console.log("🎉 备份完成！可以安全插入 mock 数据了。\n");
}

main();
