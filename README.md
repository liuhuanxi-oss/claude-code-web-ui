# Claude Code Web UI

基于 Claude Code CLI 的 Web 界面，参考 [Hermes Web UI](https://github.com/EKKOLearnAI/hermes-web-ui) 架构设计。

## 功能

- **AI 聊天** - 实时流式对话，支持思考过程和工具调用展示
- **多会话管理** - 创建、切换、恢复、删除、搜索会话
- **用量分析** - Token 统计、成本追踪、30 天趋势图
- **文件浏览器** - 浏览项目文件、查看文件内容
- **Web 终端** - 浏览器内终端，执行 Shell 命令
- **定时任务** - Cron 调度自动执行 Claude Code 任务
- **模型选择** - Opus / Sonnet / Haiku 切换
- **Token 认证** - 自动生成 Token 保护 API

## 快速开始

### 安装

```bash
git clone https://github.com/<your-username>/claude-code-web-ui.git
cd claude-code-web-ui
npm install
```

### 构建前端

```bash
npx vite build
```

### 启动

```bash
# 直接启动（自动生成 auth token）
node bin/claude-code-web-ui.mjs start

# 开发模式（关闭认证）
AUTH_DISABLED=1 node bin/claude-code-web-ui.mjs start
```

打开 http://localhost:8648

### 环境变量

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | 8648 |
| `AUTH_TOKEN` | 认证 Token | 自动生成 |
| `AUTH_DISABLED` | 禁用认证 (设为 `1`) | - |
| `CLAUDE_BIN_PATH` | Claude CLI 路径 | `claude` |

## 架构

```
Browser → BFF (Koa 2, :8648) → Claude Code CLI (child_process spawn)
                                      ↓
                              ~/.claude/ (会话、历史、配置)
```

- **前端**: Vue 3 + TypeScript + Vite + Naive UI + Pinia
- **后端**: Koa 2 + better-sqlite3 + node-pty + ws
- **CLI 集成**: `claude --print --output-format stream-json`

## 开发

```bash
# 前端开发 (http://localhost:5173)
npx vite

# 后端开发 (http://localhost:8648)
AUTH_DISABLED=1 node packages/server/src/index.mjs
```

## License

MIT
