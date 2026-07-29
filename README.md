# Domain Email

基于 Cloudflare Workers、Email Routing、D1 和 R2 的多域名 Catch-all 收件箱。统一 Worker 名称为 **`domain-inbox`**，生产入口为 `mail.525458.xyz`，由仓库外的 Cloudflare Access 保护。

## 功能与安全边界

- 多域名 Catch-all、收件人筛选、FTS 搜索、无限滚动、回收站和恢复。
- 原始邮件及附件存入 R2；D1 仅保存元数据、稳定对象引用和处理状态。
- 附件只能按稳定 attachment ID 下载，API 不返回 `r2_key`。附件与 `.eml` 始终使用 `Content-Disposition: attachment`、`X-Content-Type-Options: nosniff` 和 `Cache-Control: private, no-store`。
- HTML 邮件先在服务端清洗，再放入无脚本 sandbox iframe。清洗失败时不返回原始 HTML；远程图片和字体默认由 CSP 阻止，只有用户点击隐私提示按钮后才加载。
- JSON API 保留原始文本字段，前端在写入 DOM 时统一转义，避免双重转义。
- 日志只记录操作类型和不透明 ID，不记录完整邮箱地址、邮件正文、附件、Token 或 Access assertion。

## 一致性设计

D1 与 R2 不共享事务。收件使用以下可重试流程：

1. 以“规范化收件人 + 原始邮件内容”的 SHA-256 作为稳定 ingest/email ID。
2. `ingestion_registry` 原子预留当前 `storage_generation`，然后 D1 原子写入 `pending` 邮件和附件记录。
3. 第一代使用 `raw/<email-id>.eml`、`attachments/<attachment-id>`；已完成永久清理后的重投使用确定性的 `.g<generation>` 后缀。发送方文件名只保存在 D1，旧清理任务因此无法删除新一代对象。
4. 所有对象写入成功后，D1 在同一事务中写入单调 activation event，并把附件、邮件和 registry 切换为 `active`。中途失败保持 `pending`，同一代重试覆盖相同对象且不会重复展示。

永久删除先把带 generation 的对象引用写入 `cleanup_outbox`，再删除 D1 邮件记录。清理进程必须按整封邮件原子取得 claim/lease 后才能删除 R2；未 claim 的清理可被重投原子取消，已 claim 的清理阻止重投，完成后重投递增 generation。R2 删除失败会释放 claim、保留 outbox 并退避重试。只读对账接口按页检查活动 D1 引用是否存在对应 R2 对象。普通删除只是软删除，恢复不触碰 R2。


清理端点默认每次只 claim 一封邮件；即使邮件包含 25 个附件，单次调用仍保持在免费计划的查询和子请求预算内。响应中的 `canContinue`/`pending.readyEmails` 表示是否需要继续调用。只有在明确采用更高平台预算时才应提高 `CLEANUP_EMAILS_PER_RUN`。
列表、FTS 和回收站使用带 ID tie-breaker 的复合 keyset cursor；新邮件轮询使用严格按可见性提交排序的 `(activation_seq, id)` cursor，并连续排空所有页面，因此 pending 邮件晚激活或单次新增超过 100 封都不会漏信。

## 限额

默认值在 `wrangler.jsonc` 中显式配置，运行时会再次校验：

| 项目 | 默认上限 |
|---|---:|
| 原始邮件 | 25 MiB |
| 单个文本或 HTML 正文 | 512 KiB |
| 文本与 HTML 正文合计 | 768 KiB |
| 附件数量 | 25 |
| 单个附件 | 10 MiB |
| 附件总量 | 20 MiB |
| 搜索字符串 | 200 字符 |
| API 单页 | 100 |
| 并发 R2 操作 | 4 |

超限邮件会通过 Email Worker `setReject()` 拒绝，不会写入 D1/R2。

## 本地开发

要求 Node.js 22（CI 使用版本）并安装依赖：

```bash
npm ci
npm run dev:migrate   # 只操作隔离的本地 D1
npm run dev           # D1/R2 默认使用 Wrangler 本地绑定
```

`check-env.ts` 不登录、枚举或修改远程 Cloudflare 资源。`seed-mock-data.ts` 也固定使用本地 D1。

常用验证：

```bash
npm run type-check
npm test
npm run test:migrations   # 临时目录中从 0001 应用全部 migration
npx wrangler deploy --dry-run
```

## Migration

Schema 变更只能新增有序 migration，禁止修改可能已经执行的文件。`0005_hardening_storage.sql` 以 additive 方式增加：

- `ingest_key`、`storage_state` 和大小/附件统计字段；
- attachment 存储状态；
- `cleanup_outbox`；
- 列表、FTS join、回收站和收件人筛选所需的复合索引。

`0006_activation_cleanup_coordination.sql` 继续以 additive 方式增加：

- `activation_seq` 与 activation event 表，保证按实际可见性提交顺序轮询；
- `storage_generation` 与 `ingestion_registry`，协调永久清理和同邮件重投；
- cleanup claim token/lease 及对应索引，保证整封邮件的对象清理不会和新一代对象竞争。

CI 会在隔离本地 D1 上分阶段应用全量 migration，并用旧 schema 数据验证回填、晚激活与 cleanup/reingest 行为。生产 migration 只能由 GitHub Actions 执行。

## 生产部署所有权

**GitHub Actions (`.github/workflows/ci-deploy.yml`) 是唯一生产部署所有者。** 合并到 `master` 后，工作流依次执行类型检查、测试、本地 migration 验证、dry-run、远程 additive migration 和 `domain-inbox` 部署。Cloudflare Git auto-deploy 应保持断开。

仓库内 `npm run deploy` 被刻意禁用，不能手工部署或执行远程 migration。`scripts/configure-domains.sh` 同样默认拒绝运行；它会启用 Email Routing 并替换现有 catch-all，只有核对账号、zone、Worker 与回滚方案后提供 `--confirm=REPLACE_EMAIL_ROUTING` 才会发起任何 API 请求。生产 environment 需要：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

不要把凭据、`.wrangler/`、备份或原始邮件提交到 Git。

## 备份与恢复

### 只读备份

```bash
npx tsx scripts/backup-prod.ts
# 可选：--output=/secure/path/backup.json
npx tsx scripts/restore-prod.ts --input=/secure/path/backup.json --validate-only
```

`backup-prod.ts` 只执行 `SELECT`，绝不删除或更新 D1/R2。输出通过权限 `0600` 的临时文件原子替换，完整包含 emails、attachments、cleanup outbox、ingestion registry、activation events 以及 `deleted_at`、generation、claim/lease 等所有字段。

### 生产恢复（破坏性）

恢复会替换生产 D1 元数据，可能导致服务不可用或 D1/R2 引用不一致；R2 本身不会被删除或覆盖。执行前必须核对 Cloudflare 账号、`inbox-db`、备份完整性和回滚备份。脚本默认拒绝运行，只有明确输入确认短语才会继续：

```bash
npx tsx scripts/restore-prod.ts \
  --input=/secure/path/backup.json \
  --confirm=REPLACE_PRODUCTION_MAIL_DB
```

恢复会在任何 Wrangler 调用前验证备份格式、全部字段、唯一键及 email/attachment/registry/activation/outbox 协调关系；大文本会按 UTF-8 边界拆成低于 D1 语句限制的更新。恢复完整保留 `deleted_at`、时间戳、状态、计数和 outbox 字段，使用权限受限的随机临时目录，并在成功或失败后清理。此操作不属于日常部署流程。

永久清理 API 同样要求 `X-Confirm-Destructive-Action` 明确确认；没有确认时返回 `409`。对账 API 是只读操作。所有维护端点仍必须经过 Cloudflare Access，不能为测试绕过 Access。

## 项目结构

```text
src/index.ts                 Worker email/fetch 入口与安全 API
src/db.ts                    D1 查询、复合 cursor、摄取状态和 outbox
src/mime.ts                  MIME 解析与有界流读取
src/sanitize.ts              HTML 清洗
src/frontend/                原生 HTML/CSS/JS 前端
migrations/                  只增不改的 D1 migrations
scripts/test-migrations.ts   隔离本地 migration 测试
scripts/backup-prod.ts       严格只读生产备份
scripts/restore-prod.ts      显式确认的隔离恢复
.github/workflows/           唯一生产部署流程
```

## License

MIT
