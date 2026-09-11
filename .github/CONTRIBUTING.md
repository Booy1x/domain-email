# 协作约定

本项目用 AI 协作开发,以下约定用于保持仓库整洁、部署稳定、纪律一致。

## 极简分支工作流

- **master**:唯一长寿命分支,生产部署源。push 到 master 触发 CI 部署到 Cloudflare Workers(见 `.github/workflows/ci-deploy.yml`)。
- **ai/&lt;task-id&gt;-&lt;slug&gt;**:每个任务一个短命分支,PR 合并后立即删除。

### 标准流程

1. 从最新 master 切分支:`git checkout master && git pull && git checkout -b ai/&lt;task-id&gt;-&lt;slug&gt;`
2. 在分支上提交改动,push 到远端
3. 在 GitHub 开 PR,自审后合并到 master
4. GitHub 自动删除分支(需在 Settings → General → Pull Requests 勾选 "Automatically delete head branches")
5. 合并触发 CI:测试 → D1 migration → `wrangler deploy`
6. 稳定后发版:`git tag vX.Y.Z && git push origin vX.Y.Z`(改 `package.json` version 不会发版)

### 分支命名

```
<agent>/<task-id>-<slug>
```

- `agent`:工具来源前缀,固定枚举之一,用于区分是哪个 AI 工具开的分支:
  - `trae` —— TRAE 系统自动开(默认前缀 `trae/agent-`)
  - `claudecode` —— Claude Code
  - `codex` —— OpenAI Codex
  - `cursor` —— Cursor
  - `devin` —— Devin
  - `ai` —— 其他未列出的 AI 工具(默认回退)
  - `human` —— 人工操作
- `task-id`:日期 + 简短英文描述,如 `20260911-fix-timestamp`
- `slug`:英文小写连字符,如 `fix-timestamp`、`add-reply-feature`
- 示例:
  - `trae/agent-20260911-fix-timestamp`(TRAE 自动开时保留其 `agent-` 中缀,不强制改写,合并后即删)
  - `claudecode/20260912-add-reply-feature`
  - `codex/20260913-refactor-mime`

### 紧急修复(hotfix)

不单独开 `hotfix/*` 分支,直接走标准流程。

## 可跳过 PR 直接 push master 的改动(白名单)

仅限以下场景,且不涉及代码逻辑:

1. `.github/*.md`(PR/Issue 模板、CONTRIBUTING 本身)
2. `README.md` 文档更新
3. 注释/格式化改动(不改逻辑)
4. `.gitignore` 更新

白名单外的所有改动必须走 `ai/*` 分支 + PR 流程。

## 安全不变量(摘自 AGENTS.md)

提交前自检,改动涉及以下方面必须勾选确认:

- 附件只按稳定 attachment ID 下载,任何 API 响应不得返回 `r2_key`
- HTML 邮件先 `sanitizeHtml` 再进无脚本 sandbox iframe
- iframe 高度用 `measureHeight` 全量测量(非 `scrollHeight`)
- 写 DOM 一律转义(`esc`/`escHtml`)
- 所有收件列表/轮询/域名树查询必须排除 `direction='out'`
- 发信只走 `send_email` binding(名 `EMAIL`)

## 本地验证

- `npm run type-check`
- `npm test`
- `npm run test:migrations`(若涉及 migration)
- 改完 `src/frontend/scripts.ts` 后用 `new Function(scripts)` 校验脚本字符串语法

## 版本号机制

- 首页侧栏 `.app-version` 显示 `APP_VERSION`(wrangler var,默认 `dev`)
- 版本号来源是 git tag:CI 在 deploy 时用 `git describe` 从 `vX.Y.Z` 语义化 tag 推导
- 发版 = 打 `vX.Y.Z` tag 并推送到远端
- 改 `package.json` 的 `version` 字段不会自动改线上版本,除非配合 tag
