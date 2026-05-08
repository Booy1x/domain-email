#!/usr/bin/env tsx

/**
 * 本地开发环境预检查
 * 确保 D1 数据库和 R2 存储桶已创建，wrangler 已登录
 * 如果资源不存在，提示用户先运行 npm run deploy
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function runSilent(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { stdio: "pipe", shell: true, cwd: process.cwd() });
  return (result.stdout?.toString() ?? "").trim();
}

interface CheckResult {
  ok: boolean;
  message: string;
}

const checks: CheckResult[] = [];

// 1. Check wrangler installed
const wranglerVersion = runSilent("wrangler", ["--version"]);
if (wranglerVersion) {
  checks.push({ ok: true, message: `wrangler: ${wranglerVersion}` });
} else {
  checks.push({ ok: false, message: "未找到 wrangler。请先安装：npm install -g wrangler" });
}

// 2. Check wrangler login
const whoami = runSilent("wrangler", ["whoami"]);
const loggedIn = whoami.length > 0 && !whoami.includes("not authenticated") && !whoami.includes("Error");
if (loggedIn) {
  checks.push({ ok: true, message: "已登录 Cloudflare" });
} else {
  checks.push({ ok: false, message: "未登录 Cloudflare。请先运行：wrangler login" });
}

// 3. Check wrangler.jsonc has real database ID (auto-detect from wrangler if placeholder)
try {
  const raw = readFileSync("wrangler.jsonc", "utf-8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const config = JSON.parse(stripped);
  const dbId = config?.d1_databases?.[0]?.database_id;

  if (dbId && dbId !== "REPLACE_WITH_YOUR_DATABASE_ID") {
    checks.push({ ok: true, message: `D1 数据库 ID: ${dbId}` });
  } else {
    // Try to auto-detect from wrangler
    console.log("  🔍 database_id 为占位符，尝试从 wrangler 自动获取...");
    const listOutput = runSilent("wrangler", ["d1", "list", "--json"]);
    let detectedId: string | null = null;
    try {
      const list = JSON.parse(listOutput);
      if (Array.isArray(list)) {
        const found = list.find((db: any) => db.name === "mail-db" || db.database_name === "mail-db");
        if (found) detectedId = found.uuid ?? found.database_id ?? null;
      }
    } catch {
      const lines = listOutput.split("\n");
      for (const line of lines) {
        if (line.includes("mail-db")) {
          const match = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (match) { detectedId = match[1]; break; }
        }
      }
    }
    if (detectedId) {
      config.d1_databases[0].database_id = detectedId;
      const newStripped = JSON.stringify(config, null, 2);
      // Preserve comments by only replacing the database_id line
      const newRaw = raw.replace(
        /"database_id"\s*:\s*"REPLACE_WITH_YOUR_DATABASE_ID"/,
        `"database_id": "${detectedId}"`
      );
      writeFileSync("wrangler.jsonc", newRaw, "utf-8");
      checks.push({ ok: true, message: `D1 数据库 ID: ${detectedId}（已自动从 wrangler 获取并写入）` });
    } else {
      checks.push({ ok: false, message: "D1 数据库尚未创建（wrangler.jsonc 中的 database_id 为占位符）" });
    }
  }
} catch {
  checks.push({ ok: false, message: "无法读取 wrangler.jsonc" });
}

// 4. Check R2 bucket exists
const bucketList = runSilent("wrangler", ["r2", "bucket", "list"]);
if (bucketList.includes("mail-storage")) {
  checks.push({ ok: true, message: "R2 存储桶 mail-storage: 已存在" });
} else {
  checks.push({ ok: false, message: "R2 存储桶 mail-storage 尚未创建" });
}

// ── Print results ─────────────────────────────────────────────────────

console.log("\n── 本地开发环境检查 ──\n");

let allOk = true;
for (const check of checks) {
  const icon = check.ok ? "✅" : "❌";
  console.log(`  ${icon} ${check.message}`);
  if (!check.ok) allOk = false;
}

console.log("");

if (!allOk) {
  console.log("⚠️  环境未就绪。请先运行部署向导创建资源：");
  console.log("");
  console.log("    npm run deploy");
  console.log("");
  console.log("  向导会自动创建 D1 数据库和 R2 存储桶。\n");
  process.exit(1);
}

console.log("✅ 环境就绪，启动本地开发服务器...\n");
