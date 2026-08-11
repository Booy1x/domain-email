# AGENTS.md

本项目协作约定。给 AI 编码 agent 的上下文:改动前先读这里,不要破坏以下不变量。

## 版本号机制(重要,勿删)

- 首页侧边栏底部(`.app-version`)显示 `APP_VERSION`(wrangler var,默认 `dev`),用途是让用户看到当前部署版本。
- **版本号来源是 git tag**:`.github/workflows/ci-deploy.yml` 在 deploy 时用 `git describe` 从 `vX.Y.Z` 语义化 tag 推导并注入:
  - HEAD 正好是 tag → `1.2.3`;
  - tag 之后有提交 → `1.2.3-N-g{sha}`;
  - 无 tag → `{package.json version}+{short sha}`。
- **发版 = 打 `vX.Y.Z` tag 并推送到远端**(`git tag v1.1.0 && git push origin v1.1.0`)。改 `package.json` 的 `version` 字段不会自动改线上版本,除非配合 tag。
- 重构 `src/frontend/index.ts` / `src/frontend/styles.ts` 时,**保留 `.app-version` 标识和 `inboxPage(domains, version)` 签名**,不要把它当无用样式删掉。

## 前端架构

- 前端是服务端拼字符串、单页内联渲染:`src/frontend/index.ts` 生成 HTML,`styles.ts`/`scripts.ts` 导出模板字符串内嵌进页面。**没有前端构建步骤/打包器。**
- `scripts.ts` 的纯逻辑(如 `esc`、`buildEmailSrcdoc`)写成模块顶部的导出函数,用 `${fn.toString()}` 注入浏览器脚本(见 `drainPollingPages` 的模式)。不要改回字符串内的大段裸 JS。
- 改完 `scripts.ts` 后,必须用 `new Function(scripts)` 校验生成的脚本字符串语法合法(测试会兜底一部分,但这是最快验证)。
- 测试:`src/frontend/scripts.test.ts` 同时做「字符串断言」和「直接调导出函数」;`src/frontend/index.test.ts` 断言 HTML 输出。新增行为要补测试。
- 主题机制:`<head>` 内联 `bootTheme()` IIFE 在绘制前按 localStorage / 系统偏好设置 `<html data-theme>`(防闪烁,勿删);侧栏 `#btn-theme` 切换并写 localStorage。CSS 只在 `:root[data-theme="dark"]` 覆写变量,**不要**再加 `@media (prefers-color-scheme)` 重复一套暗色变量。邮件 iframe 底色(`buildEmailSrcdoc` 的 `background:#ffffff` 与 `--paper`)故意不随主题变化,保证 HTML 邮件可读性。

## 安全不变量

- 附件只按稳定 attachment ID 下载,任何 API 响应不得返回 `r2_key`。
- HTML 邮件先 `sanitizeHtml` 再进无脚本 sandbox iframe;远程图片/字体默认被 CSP 阻止,仅用户点「加载远程图片和字体」后放行(`img-src`/`font-src` 加 `https: http:`,`media-src` 保持 `data:`)。
- iframe 高度必须用 `measureHeight`(遍历节点取 `getBoundingClientRect().bottom` 最大值)全量测量,邮件正文才显示完整。**不要改成只看 `scrollHeight`**——会低估绝对定位/float/margin 塌陷内容,导致正文截断(已踩过坑)。
- 写 DOM 一律转义(前端统一用 `esc`/`escHtml`),服务端 JSON 原样返回避免双重转义。
- 回复发送:`POST /api/emails/:id/reply` 只允许 `direction='in'` 的原信,`from` 强制等于原信 `rcpt_to`(信落进来的自己地址);线程头(`In-Reply-To`/`References`)来自 `emails.message_id` 列,收件 ingest 时必须把 `parsed.messageId` 落库。已发送行 `direction='out'`、`r2_key` 为空、`activation_seq` 为空——**所有收件列表/轮询/域名树查询都必须排除 `direction='out'`**。发信只走 `send_email` binding(名 `EMAIL`),错误码要映射成中文文案,`SEND_MAX_PER_HOUR` 限速复用 `checkRateLimit`。

## 后端与部署

- 生产部署唯一所有者是 `.github/workflows/ci-deploy.yml`(push 到 `master` 触发)。仓库内 `npm run deploy` 被刻意禁用;`scripts/configure-domains.sh` 默认拒绝。不要新增手工部署入口。
- D1 migration **只新增、不修改已应用文件**;生产 migration 只能由 CI 执行。
- 常用验证:`npm run type-check`、`npm test`、`npm run test:migrations`。
- 注意:本地 Windows 跑 `scripts/operations.test.ts` 会因 `npx` spawn 失败而挂,那是环境问题,CI(Ubuntu)会通过,不代表改动有问题。
