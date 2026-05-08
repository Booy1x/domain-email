#!/usr/bin/env tsx

/**
 * 交互式部署向导
 * 引导用户完成从零到部署的全流程：
 *   1. 检查 wrangler 环境
 *   2. 创建 D1 数据库
 *   3. 创建 R2 存储桶
 *   4. 运行数据库 migrations
 *   5. 部署 Worker
 *   6. 配置 Email Routing（可选）
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

// ── helpers ──────────────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? " [Y/n] " : " [y/N] ";
  return prompt(question + hint).then((ans) => {
    if (!ans) return defaultYes;
    return ans.toLowerCase() === "y" || ans.toLowerCase() === "yes";
  });
}

function run(
  cmd: string,
  args: string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: "pipe" | "inherit" }
): ReturnType<typeof spawnSync> {
  console.log(`\n> ${cmd} ${args.join(" ")}\n`);
  return spawnSync(cmd, args, {
    stdio: options?.stdio ?? "inherit",
    cwd: options?.cwd ?? process.cwd(),
    env: options?.env ?? process.env,
    shell: true,
  });
}

function runSilent(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { stdio: "pipe", shell: true, cwd: process.cwd() });
  return (result.stdout?.toString() ?? "").trim();
}

function readJsonc(path: string): Record<string, any> {
  const raw = readFileSync(path, "utf-8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

function writeJsonc(path: string, obj: Record<string, any>) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

// ── banner ────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════╗
║       Catch-All Mail — 部署向导          ║
║                                          ║
║  一键部署多域名邮件收件箱                ║
╚══════════════════════════════════════════╝
`);

// ── step 1: check wrangler ───────────────────────────────────────────

async function checkWrangler() {
  console.log("── 步骤 1/6: 检查环境 ──\n");

  const wranglerVersion = runSilent("wrangler", ["--version"]);
  if (!wranglerVersion) {
    console.error("❌ 未找到 wrangler。请先安装：npm install -g wrangler");
    process.exit(1);
  }
  console.log(`✅ wrangler: ${wranglerVersion}`);

  const whoami = runSilent("wrangler", ["whoami"]);
  if (whoami.includes("not authenticated") || whoami.includes("Error")) {
    console.log("⚠️  未登录 Cloudflare，正在打开登录页面...\n");
    run("wrangler", ["login"], { stdio: "inherit" });

    const recheck = runSilent("wrangler", ["whoami"]);
    if (recheck.includes("not authenticated") || recheck.includes("Error")) {
      console.error("❌ 登录失败，请重试");
      process.exit(1);
    }
  }
  console.log(`✅ 已登录 Cloudflare\n`);
}

// ── step 2: create D1 database ────────────────────────────────────────

async function createDatabase(): Promise<string> {
  console.log("── 步骤 2/6: 创建 D1 数据库 ──\n");

  const wranglerPath = "wrangler.jsonc";
  const config = readJsonc(wranglerPath);
  const existingId = config?.d1_databases?.[0]?.database_id;
  const alreadyCreated = existingId && existingId !== "REPLACE_WITH_YOUR_DATABASE_ID";

  if (alreadyCreated) {
    const reuse = await promptYesNo(`检测到已有数据库 ID: ${existingId}，是否复用？`);
    if (reuse) {
      console.log("✅ 复用已有数据库\n");
      return existingId as string;
    }
  }

  console.log("正在创建 D1 数据库 mail-db...\n");

  const result = spawnSync(
    "wrangler",
    ["d1", "create", "mail-db", "--json"],
    { stdio: "pipe", shell: true, cwd: process.cwd() }
  );

  const output = result.stdout?.toString() ?? "";
  let dbId: string | null = null;

  try {
    const json = JSON.parse(output);
    dbId = json?.uuid ?? json?.database_id ?? null;
  } catch {
    const match = output.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    dbId = match ? match[1] : null;
  }

  if (!dbId) {
    console.error("❌ 创建 D1 数据库失败");
    console.error(output);
    process.exit(1);
  }

  config.d1_databases[0].database_id = dbId;
  writeJsonc(wranglerPath, config);

  console.log(`✅ 数据库已创建，ID: ${dbId}`);
  console.log(`✅ 已自动写入 ${wranglerPath}\n`);

  return dbId;
}

// ── step 3: create R2 bucket ──────────────────────────────────────────

async function createBucket() {
  console.log("── 步骤 3/6: 创建 R2 存储桶 ──\n");

  const listOutput = runSilent("wrangler", ["r2", "bucket", "list"]);
  if (listOutput.includes("mail-storage")) {
    console.log("✅ R2 存储桶 mail-storage 已存在，跳过创建\n");
    return;
  }

  const result = run("wrangler", ["r2", "bucket", "create", "mail-storage"]);
  if (result.status !== 0) {
    console.error("❌ 创建 R2 存储桶失败");
    process.exit(1);
  }
  console.log("✅ R2 存储桶已创建\n");
}

// ── step 4: run migrations ────────────────────────────────────────────

async function runMigrations() {
  console.log("── 步骤 4/6: 初始化数据库表结构 ──\n");

  const result = run("wrangler", ["d1", "migrations", "apply", "mail-db", "--remote"]);
  if (result.status !== 0) {
    console.error("❌ 数据库迁移失败");
    process.exit(1);
  }
  console.log("✅ 数据库表结构已初始化\n");
}

// ── step 5: deploy worker ─────────────────────────────────────────────

async function deployWorker(): Promise<string> {
  console.log("── 步骤 5/6: 部署 Worker ──\n");

  const result = spawnSync(
    "wrangler",
    ["deploy", "--name", "catch-all-mail"],
    { stdio: "pipe", shell: true, cwd: process.cwd() }
  );

  if (result.status !== 0) {
    console.error(result.stderr?.toString() ?? "未知错误");
    console.error("❌ Worker 部署失败");
    process.exit(1);
  }

  const output = (result.stdout?.toString() ?? "") + (result.stderr?.toString() ?? "");
  const urlMatch = output.match(/https:\/\/catch-all-mail\.[a-z0-9-]+\.workers\.dev/);
  const workerUrl = urlMatch ? urlMatch[0].replace("https://", "") : "catch-all-mail.<your-subdomain>.workers.dev";

  console.log(output);
  console.log(`\n✅ Worker 已部署: https://${workerUrl}\n`);
  return workerUrl;
}

// ── step 6: configure email routing ───────────────────────────────────

async function configureEmailRouting() {
  console.log("── 步骤 6/6: 配置 Email Routing（可选）──\n");

  const shouldConfigure = await promptYesNo("是否要配置域名 Email Routing？");
  if (!shouldConfigure) {
    console.log("\n跳过。你可以稍后运行：");
    console.log("  export CF_API_TOKEN=你的Token");
    console.log("  ./scripts/configure-domains.sh domains.txt\n");
    return;
  }

  let apiToken = process.env.CF_API_TOKEN ?? "";
  if (!apiToken) {
    apiToken = await prompt("请输入 Cloudflare API Token: ");
    if (!apiToken) {
      console.log("⚠️  未提供 API Token，跳过 Email Routing 配置\n");
      return;
    }
  }

  let accountId = process.env.CF_ACCOUNT_ID ?? "";
  if (!accountId) {
    accountId = await prompt("请输入 Cloudflare Account ID: ");
    if (!accountId) {
      console.log("⚠️  未提供 Account ID，跳过 Email Routing 配置\n");
      return;
    }
  }

  const domainInput = await prompt("请输入要配置的域名（每行一个，输入空行结束）:\n");
  const domains = domainInput
    .split("\n")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);

  if (domains.length === 0) {
    console.log("⚠️  未提供域名，跳过\n");
    return;
  }

  const tmpFile = "/tmp/catch-all-mail-domains.txt";
  writeFileSync(tmpFile, domains.join("\n") + "\n");

  console.log(`\n将为以下 ${domains.length} 个域名配置 Email Routing：`);
  domains.forEach((d) => console.log(`  - ${d}`));
  console.log("");

  const confirm = await promptYesNo("确认开始配置？");
  if (!confirm) {
    console.log("已取消\n");
    return;
  }

  const result = run(
    "bash",
    ["scripts/configure-domains.sh", tmpFile],
    { env: { ...process.env, CF_API_TOKEN: apiToken, CF_ACCOUNT_ID: accountId } }
  );

  if (result.status !== 0) {
    console.error("⚠️  Email Routing 配置过程中出现错误，请检查输出");
  } else {
    console.log("\n✅ Email Routing 配置完成！");
  }
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  try {
    await checkWrangler();
    await createDatabase();
    await createBucket();
    await runMigrations();
    const workerUrl = await deployWorker();
    await configureEmailRouting();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`
╔══════════════════════════════════════════╗
║              🎉 部署完成！               ║
╠══════════════════════════════════════════╣
║                                          ║
║  Worker URL: https://${workerUrl.padEnd(24)}║
║  用时: ${elapsed}s${" ".repeat(29 - elapsed.length)}║
║                                          ║
║  访问上面的 URL 即可使用邮件收件箱       ║
╚══════════════════════════════════════════╝
`);
  } catch (err) {
    console.error("\n❌ 部署过程中断:", err);
    process.exit(1);
  }
}

main();
