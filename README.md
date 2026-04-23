<p align="center">
  <strong>Claude Code Web UI</strong>
</p>

<p align="center">
  基于 Claude Code CLI 的全功能 Web 界面<br/>
  流式对话 · 会话管理 · 用量分析 · 文件浏览 · Web终端 · 定时任务
</p>

<p align="center">
  <code>git clone https://github.com/liuhuanxi-oss/claude-code-web-ui && cd claude-code-web-ui && npm install && npx vite build && node bin/claude-code-web-ui.mjs start</code>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.5-42b883?style=flat-square" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Koa-2-33D6A5?style=flat-square" alt="Koa 2" />
  <img src="https://img.shields.io/badge/Naive_UI-2-5fbd7e?style=flat-square" alt="Naive UI" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
</p>

---

## 为什么需要 Claude Code Web UI？

Claude Code 是 Anthropic 官方的终端 CLI 工具，但命令行界面在某些场景下并不方便：

- 想在**浏览器**中使用 Claude Code，不用开终端
- 需要**多会话并行**管理，方便切换上下文
- 想实时追踪**Token 用量和成本**，控制预算
- 需要定时让 Claude Code 自动执行任务（如每日代码审查）
- 想在**手机/平板**上远程使用 Claude Code

Claude Code Web UI 将 CLI 的全部能力搬到了 Web 界面，开箱即用。

## 功能一览

### 💬 AI 聊天

- 实时流式响应（逐 Token 渲染，打字效果）
- 思考过程（Thinking）可折叠查看
- 工具调用（Bash、文件读写、搜索等）以卡片形式展示，支持展开参数和结果
- Markdown 渲染 + 代码语法高亮
- 文件上传支持

### 📋 多会话管理

- 创建、切换、恢复、删除会话
- 基于已有会话 `--resume` 继续对话
- 全局搜索（Ctrl+K）搜索历史会话
- 会话按最近活跃时间排序

### 📊 用量分析

- 总 Token 用量（输入/输出）
- 费用追踪（USD）
- 30 天用量趋势图
- 按模型分布统计

### 📁 文件浏览器

- 浏览项目目录结构
- 查看任意文件内容（语法高亮）
- 路径导航面包屑

### ⌨️ Web 终端

- 浏览器内完整终端（基于 node-pty + WebSocket）
- 支持交互式 Shell 命令

### ⏰ 定时任务

- Cron 表达式调度
- 自动执行 Claude Code 提示词
- 手动触发、暂停、恢复
- 执行日志查看

### 🎛️ 模型选择

- 一键切换 Opus / Sonnet / Haiku
- 全局模型选择器

### 🔐 安全认证

- 首次启动自动生成 Token
- 可选禁用认证（本地开发）
- Token 认证保护所有 API

## 架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Browser   │────▶│  BFF (Koa 2)     │────▶│  Claude Code    │
│  Vue 3 SPA  │◀────│  :8648           │◀────│  CLI (spawn)    │
└─────────────┘     │                  │     └────────┬────────┘
                    │  • SSE 流式推送    │              │
                    │  • Session 管理   │     ┌────────▼────────┐
                    │  • SQLite 用量    │     │   ~/.claude/    │
                    │  • 文件 API       │     │  • sessions     │
                    │  • WebSocket 终端 │     │  • history      │
                    └──────────────────┘     │  • config       │
                                             └─────────────────┘
```

**技术栈：**

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Naive UI + Pinia + markdown-it |
| 后端 | Koa 2 + @koa/router + better-sqlite3 + ws + node-pty |
| CLI 集成 | `claude --print --output-format stream-json --verbose --include-partial-messages` |

## 快速开始

### 前置条件

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装并登录

### 安装

```bash
git clone https://github.com/liuhuanxi-oss/claude-code-web-ui.git
cd claude-code-web-ui
npm install
```

### 构建前端

```bash
npx vite build
```

### 启动

```bash
# 标准启动（自动生成 auth token）
node bin/claude-code-web-ui.mjs start

# 开发模式（关闭认证，方便调试）
AUTH_DISABLED=1 node bin/claude-code-web-ui.mjs start
```

打开 **http://localhost:8648**

### 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `8648` |
| `AUTH_TOKEN` | 认证 Token | 自动生成，存储在 `~/.claude-code-web-ui/.token` |
| `AUTH_DISABLED` | 禁用认证（设为 `1`） | - |
| `CLAUDE_BIN_PATH` | Claude CLI 可执行文件路径 | `claude` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 开发

```bash
# 前端开发服务器 (http://localhost:5173，自动代理 API 到 8648)
npx vite

# 后端开发服务器 (http://localhost:8648)
AUTH_DISABLED=1 node packages/server/src/index.mjs
```

## Docker

```bash
docker build -t claude-code-web-ui .
docker run -d -p 8648:8648 -e AUTH_DISABLED=1 claude-code-web-ui
```

## 项目结构

```
claude-code-web-ui/
├── bin/                           # CLI 入口
├── packages/
│   ├── client/src/                # Vue 3 前端
│   │   ├── api/claude/            # API 客户端
│   │   ├── components/claude/     # Claude 专用组件
│   │   │   ├── chat/              # 聊天（ChatInput, MessageItem, ToolCallBlock, ThinkingBlock...）
│   │   │   └── ...
│   │   ├── stores/claude/         # Pinia Store
│   │   ├── views/claude/          # 页面视图
│   │   └── shared/                # 流式解析器、消息映射
│   └── server/src/                # Koa 2 后端
│       ├── routes/claude/         # API 路由（chat, sessions, files, terminal, usage, jobs）
│       ├── services/claude/       # 核心服务（CLI 封装、流式解析、会话管理）
│       └── db/                    # SQLite（用量存储、任务存储）
├── vite.config.ts
└── package.json
```

## 致谢

- [Hermes Web UI](https://github.com/EKKOLearnAI/hermes-web-ui) — 架构设计参考
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic 官方 CLI
- [Naive UI](https://www.naiveui.com/) — Vue 3 组件库

## License

[MIT](./LICENSE)
