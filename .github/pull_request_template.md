<!-- 协作约定见 .github/CONTRIBUTING.md(分支命名规范:<agent>/<task-id>-<slug>,agent ∈ {trae, claudecode, codex, cursor, devin, ai, human})。若本改动属于白名单(仅 .github/*.md / README.md / 注释 / .gitignore),可直接 push master,无需开 PR。 -->

## 改动说明

<!-- 一句话说明这个 PR 做了什么 -->

## 改动类型

<!-- 勾选适用的项 -->
- [ ] feat: 新增功能
- [ ] fix: 修复 bug
- [ ] refactor: 重构(不改行为)
- [ ] ci: CI/部署配置
- [ ] chore: 杂项/依赖更新
- [ ] migration: D1 schema 变更(只新增,不修改已应用文件)

## 安全/不变量自检

<!-- 涉及以下任一方面的必须勾选确认 -->
- [ ] 未泄露 `r2_key` 到 API 响应
- [ ] 收件列表/轮询/域名树查询已排除 `direction='out'`
- [ ] HTML 邮件经 `sanitizeHtml` 后进无脚本 sandbox iframe
- [ ] iframe 高度用 `measureHeight` 全量测量(非 `scrollHeight`)
- [ ] 写 DOM 已转义(`esc`/`escHtml`)
- [ ] 不适用(无安全相关改动)

## 本地验证

- [ ] `npm run type-check` 通过
- [ ] `npm test` 通过
- [ ] `npm run test:migrations` 通过(若涉及 migration)
- [ ] `new Function(scripts)` 语法合法(若改 `scripts.ts`)

## 发版判断

- [ ] 本 PR 不需要发版
- [ ] 本 PR 合并后需打 `vX.Y.Z` tag(请在下方填写版本号):

<!-- 若需发版,合并后执行:git tag vX.Y.Z && git push origin vX.Y.Z -->
