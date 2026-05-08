# Catch-All Mail

多域名邮件收件箱，基于 Cloudflare Workers + D1 + R2 构建。

接收你名下所有域名的邮件，在统一的 Web 界面中查看和管理。

本项目从需求分析、架构设计、代码实现到测试部署，全程由 **Claude Code** 驱动 **美团 LongCat-2.0-Preview** 模型完成，零人工手写代码。

## 功能

- **多域名 Catch-all** — 一个域名下所有收件人的邮件都能接收
- **邮件列表** — 按域名/收件人筛选，支持搜索和无限滚动
- **HTML 邮件渲染** — 安全沙箱内展示 HTML 邮件
- **附件下载** — 从 R2 下载邮件附件和原始 .eml 文件
- **软删除 + 回收站** — 支持恢复和永久删除
- **暗色/亮色主题** — 双主题切换

## 架构

```
邮件 → Cloudflare Email Routing → Worker
                                    ├─ postal-mime 解析邮件
                                    ├─ D1 存储邮件元数据
                                    └─ R2 存储原始邮件 + 附件
```

### 模型能力验证

本项目验证了大型语言模型在真实全栈开发中的以下能力：

| 能力维度 | 实践体现 |
|---------|---------|
| **端到端架构** | 从一句话需求输出完整的 Serverless 架构方案 |
| **上下文一致性** | 多轮对话增量开发，代码风格与接口定义保持统一 |
| **工程化思维** | 自动生成部署向导、环境检查、数据库迁移等生产级辅助脚本 |
| **安全考量** | 主动引入 HTML 沙箱、附件隔离存储、API Rate Limit 等防护机制 |
| **零框架前端** | 纯原生 JS 实现无限滚动、主题切换、移动端适配，无构建工具依赖 |
| **一键部署** | 单条命令自动完成 D1/R2 资源创建、Migration 执行、Worker 上线 |

**开发工具**：Claude Code + 美团 LongCat-2.0-Preview

## 前置条件

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- 一个 Cloudflare 账号
- 至少一个托管在 Cloudflare 上的域名

## 部署

### 1. 克隆项目

```bash
git clone https://github.com/Booy1x/domain-email.git
cd domain-email
npm install
```

### 2. 运行部署向导

```bash
npm run deploy
```

向导会引导你完成以下步骤：

1. **检查环境** — 确认 wrangler 已安装并登录
2. **创建 D1 数据库** — 自动创建 `mail-db` 并写入配置
3. **创建 R2 存储桶** — 自动创建 `mail-storage`
4. **初始化表结构** — 运行数据库 migrations
5. **部署 Worker** — 部署到 `xxx.catch-all-mail.workers.dev`
6. **配置 Email Routing** — （可选）批量为域名开启邮件路由

### 3. 完成

部署完成后，访问向导输出的 URL 即可使用。

## 本地开发

```bash
npm run dev
```

首次运行会自动检查环境（D1/R2 是否已创建），如果资源不存在会提示先运行 `npm run deploy`。

## 配置 Email Routing（可选）

如果部署向导中跳过了这步，可以稍后手动配置：

创建一个 `domains.txt`，每行一个域名：

```
example.com
example.org
```

然后运行：

```bash
./scripts/configure-domains.sh domains.txt
```

脚本会提示输入 Cloudflare API Token 和 Account ID。

或者通过环境变量：

```bash
export CF_API_TOKEN="your-api-token"
export CF_ACCOUNT_ID="your-account-id"
./scripts/configure-domains.sh domains.txt
```

> **获取 API Token**：前往 [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)，需要 `Zone:DNS:Edit` 和 `Account:Email Routing:Edit` 权限。

## 绑定自定义域名（可选）

编辑 `wrangler.jsonc`，添加 `routes` 配置：

```jsonc
{
  "routes": [
    {
      "pattern": "inbox.your-domain.com",
      "custom_domain": true
    }
  ]
}
```

然后重新部署：

```bash
npm run deploy
```

## 项目结构

```
├── src/
│   ├── index.ts        # Worker 入口（邮件处理 + HTTP API）
│   ├── db.ts           # D1 数据库查询
│   ├── mime.ts         # MIME 邮件解析
│   ├── frontend.ts     # 前端页面（纯 HTML/CSS/JS）
│   ├── types.ts        # TypeScript 类型定义
│   └── postal-mime.d.ts
├── scripts/
│   ├── deploy.ts       # 交互式部署向导
│   ├── check-env.ts    # 本地开发环境预检查
│   └── configure-domains.sh  # Email Routing 配置脚本
├── migrations/
│   ├── 0001_create_tables.sql
│   └── 0002_add_deleted_at.sql
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

## License

MIT
